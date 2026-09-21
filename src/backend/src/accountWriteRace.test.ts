import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "./app.js";
import * as authModule from "./auth.js";
import { readCollection } from "./db.js";

// The account routes that write to the global `users` collection (signup,
// join, change password, reset password) all sit behind a bcrypt hash that
// takes most of a second, and every one of them used to read `users` first,
// wait for bcrypt, then write the WHOLE list back — so anything another
// request changed in the meantime (a removal, a role change, a brand-new
// account) was silently undone. These tests make that overlap happen on
// purpose and check nothing is lost.
//
// Each scenario runs two ways:
//  - "instrumented": bcrypt is held at a gate the test controls, so the second
//    request runs at exactly the moment the first is stuck inside it. Nothing
//    depends on how fast the machine is.
//  - "real timing": no instrumentation, just real bcrypt with the requests
//    staggered by a short delay, repeated for a couple of rounds — how the
//    audit found the problem in the first place.

vi.setConfig({ testTimeout: 90_000 });

type Res = request.Response;
type StoredUserRow = {
  id: string;
  email: string;
  role: string;
  staffRole?: string;
  dealershipId: string;
  passwordHash: string;
};
type StoredDealershipRow = { id: string; ownerId: string; name: string };
type StaffRole = "sales" | "finance" | "manager" | "general";

const runId = Date.now();
const OWNER_PASSWORD = "racetestpass123";
const JOIN_PASSWORD = "joinedracepass123";
let counter = 0;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const storedUsers = () => readCollection<StoredUserRow>("users");
const storedDealerships = () => readCollection<StoredDealershipRow>("dealerships");

async function signup(tag: string) {
  counter += 1;
  const email = `race-${runId}-${tag}-${counter}@test.local`;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email, password: OWNER_PASSWORD, name: `Race ${tag}`, dealershipName: `Race Motors ${tag} ${counter}` });
  if (!res.body.token) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { email, token: res.body.token as string, user: res.body.user as { id: string; dealershipId: string } };
}

async function inviteLink(ownerToken: string, staffRole: StaffRole) {
  const res = await request(app)
    .post("/dealership/invite")
    .set(bearer(ownerToken))
    .send({ inviteeName: "Race Joiner", staffRole });
  if (!res.body.token) throw new Error(`invite failed: ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

async function joinStaff(ownerToken: string, staffRole: StaffRole) {
  counter += 1;
  const email = `race-${runId}-joined-${counter}@test.local`;
  const res = await request(app)
    .post("/auth/join")
    .send({ token: await inviteLink(ownerToken, staffRole), name: "Race Joiner", email, password: JOIN_PASSWORD });
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return { email, token: res.body.token as string, user: res.body.user as { id: string; dealershipId: string } };
}

// ---- the gate ---------------------------------------------------------

type Gate = { checkIn(): Promise<void>; allArrived: Promise<void>; release(): void };

function newGate(callsToWaitFor: number): Gate {
  let arrived = 0;
  let release!: () => void;
  let allIn!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  const allArrived = new Promise<void>(resolve => (allIn = resolve));
  return {
    async checkIn() {
      arrived += 1;
      if (arrived === callsToWaitFor) allIn();
      await released;
    },
    allArrived,
    release,
  };
}

// While a gate is set, every bcrypt hash/compare the app runs first reports
// in and then waits until the test lets it go — and only then runs the real
// bcrypt. With no gate set they are plain pass-throughs.
let gate: Gate | null = null;

beforeAll(() => {
  const realHash = authModule.hashPassword;
  const realVerify = authModule.verifyPassword;
  vi.spyOn(authModule, "hashPassword").mockImplementation(async password => {
    await gate?.checkIn();
    return realHash(password);
  });
  vi.spyOn(authModule, "verifyPassword").mockImplementation(async (password, hash) => {
    await gate?.checkIn();
    return realVerify(password, hash);
  });
});

afterEach(() => {
  gate?.release(); // never leave a request hanging if a test failed half way
  gate = null;
});

async function waitForGate(g: Gate) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("the request never reached bcrypt, so the overlap this test needs never happened")),
      20_000
    );
  });
  try {
    await Promise.race([g.allArrived, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ---- lining requests up ----------------------------------------------

const LINEUPS = ["instrumented", "real timing"] as const;
type Lineup = (typeof LINEUPS)[number];
const roundsFor = (lineup: Lineup) => (lineup === "real timing" ? 2 : 1);
// A short tag to keep the throwaway emails and passwords of the two lineups apart.
const tagFor = (lineup: Lineup) => (lineup === "real timing" ? "t" : "i");

// Runs `slow` (a request that spends a while inside bcrypt) and, while it is
// in there, `quick` (a fast request that changes the same accounts), then
// lets `slow` finish. Instrumented: `quick` goes the moment `slow`'s first
// bcrypt call is waiting at the gate. Real timing: 100ms after `slow` starts,
// which is well inside a hash that takes hundreds of milliseconds.
async function overlap(
  lineup: Lineup,
  slow: () => PromiseLike<Res>,
  quick: () => PromiseLike<Res>
) {
  let slowDoneAt = 0;
  let quickDoneAt = 0;
  const g = lineup === "instrumented" ? newGate(1) : null;
  gate = g;

  const slowPromise = Promise.resolve(slow()).then(res => {
    slowDoneAt = performance.now();
    return res;
  });
  if (g) await waitForGate(g);
  else await sleep(100);

  const quickRes = await quick();
  quickDoneAt = performance.now();
  g?.release();

  const slowRes = await slowPromise;
  return { slowRes, quickRes, quickFinishedFirst: quickDoneAt < slowDoneAt };
}

// Starts all of `requests` at once (instrumented: all held in bcrypt until
// every one is inside; real timing: a short stagger between starts).
async function startTogether(lineup: Lineup, requests: Array<() => PromiseLike<Res>>) {
  const g = lineup === "instrumented" ? newGate(requests.length) : null;
  gate = g;
  const all = Promise.all(requests.map((start, i) => sleep(lineup === "real timing" ? i * 20 : 0).then(start)));
  if (g) {
    await waitForGate(g);
    g.release();
  }
  return all;
}

// ---- E2a: removed while their own password change is in flight --------

describe.each(LINEUPS)("a password change in flight while the owner removes that person (%s)", lineup => {
  it("they stay removed: old token 401, login 401, gone from /team", async () => {
    const owner = await signup("e2a");

    for (let round = 1; round <= roundsFor(lineup); round++) {
      const staff = await joinStaff(owner.token, "manager");
      const newPassword = `changedpass-${round}-${tagFor(lineup)}`;

      const { slowRes, quickRes, quickFinishedFirst } = await overlap(
        lineup,
        () =>
          request(app)
            .put("/auth/password")
            .set(bearer(staff.token))
            .send({ currentPassword: JOIN_PASSWORD, newPassword }),
        () => request(app).delete(`/dealership/team/${staff.user.id}`).set(bearer(owner.token))
      );

      expect(quickFinishedFirst, "the removal has to land while the password change is still running").toBe(true);
      expect(quickRes.status).toBe(200);
      // The password change finds the account gone and says so, cleanly.
      expect(slowRes.status).toBe(401);
      expect(slowRes.body.ok).toBe(false);

      expect(storedUsers().some(u => u.id === staff.user.id)).toBe(false);
      expect((await request(app).get("/auth/me").set(bearer(staff.token))).status).toBe(401);
      const login = await request(app).post("/auth/login").send({ email: staff.email, password: newPassword });
      expect(login.status).toBe(401);
      const team = await request(app).get("/team").set(bearer(owner.token));
      expect(team.body.members.map((m: { id: string }) => m.id)).not.toContain(staff.user.id);
    }
  });
});

// ---- E2b: role changed while an unrelated password change is in flight -

describe.each(LINEUPS)("a role change while someone else changes their password (%s)", lineup => {
  it("the role change sticks, and the password change still lands", async () => {
    const owner = await signup("e2b");

    for (let round = 1; round <= roundsFor(lineup); round++) {
      const manager = await joinStaff(owner.token, "manager");
      const other = await joinStaff(owner.token, "general");
      const newPassword = `otherchanged-${round}-${tagFor(lineup)}`;

      const { slowRes, quickRes, quickFinishedFirst } = await overlap(
        lineup,
        () =>
          request(app)
            .put("/auth/password")
            .set(bearer(other.token))
            .send({ currentPassword: JOIN_PASSWORD, newPassword }),
        () =>
          request(app)
            .put(`/dealership/team/${manager.user.id}`)
            .set(bearer(owner.token))
            .send({ staffRole: "sales" })
      );

      expect(quickFinishedFirst, "the role change has to land while the password change is still running").toBe(true);
      expect(quickRes.status).toBe(200);
      expect(slowRes.status).toBe(200);

      // The demotion is still there…
      const me = await request(app).get("/auth/me").set(bearer(manager.token));
      expect(me.body.user.staffRole).toBe("sales");
      expect((await request(app).put("/staff").set(bearer(manager.token)).send({ items: [] })).status).toBe(403);

      // …and the other person's password really did change.
      const row = storedUsers().find(u => u.id === other.user.id);
      expect(row).toBeDefined();
      expect(await bcrypt.compare(newPassword, row!.passwordHash)).toBe(true);
      expect(await bcrypt.compare(JOIN_PASSWORD, row!.passwordHash)).toBe(false);
    }
  });
});

// ---- E3: many signups at once ----------------------------------------

describe.each(LINEUPS)("several signups at the same moment (%s)", lineup => {
  it("every one of them ends up with a working account of its own", async () => {
    const COUNT = 4;

    for (let round = 1; round <= roundsFor(lineup); round++) {
      const emails = Array.from(
        { length: COUNT },
        (_, i) => `race-${runId}-e3-${tagFor(lineup)}-${round}-${i}@test.local`
      );
      const results = await startTogether(
        lineup,
        emails.map(
          (email, i) => () =>
            request(app)
              .post("/auth/signup")
              .send({ email, password: OWNER_PASSWORD, name: `Racer ${i}`, dealershipName: `Racer Motors ${round}-${i}` })
        )
      );

      results.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
      });

      // Each token belongs to a real, stored account — its own.
      for (const [i, res] of results.entries()) {
        const me = await request(app).get("/auth/me").set(bearer(res.body.token));
        expect(me.status, `signup ${i}'s own token`).toBe(200);
        expect(me.body.user.email).toBe(emails[i]);
      }

      const stored = storedUsers();
      const dealerships = storedDealerships();
      for (const email of emails) {
        const row = stored.find(u => u.email === email);
        expect(row, `${email} is stored`).toBeDefined();
        const dealership = dealerships.find(d => d.id === row!.dealershipId);
        expect(dealership, `${email}'s dealership is stored`).toBeDefined();
        expect(dealership!.ownerId).toBe(row!.id);
      }

      // The audit checked logging in too; two per batch keeps well inside the
      // login rate limit (10 per 15 minutes) that stays switched on in tests.
      if (lineup === "instrumented") {
        for (const email of [emails[0]!, emails[COUNT - 1]!]) {
          const login = await request(app).post("/auth/login").send({ email, password: OWNER_PASSWORD });
          expect(login.status, `login for ${email}`).toBe(200);
        }
      }
    }
  });

  it("two signups for the same email: one account, the other is told it exists", async () => {
    const email = `race-${runId}-dupe-${tagFor(lineup)}@test.local`;
    const results = await startTogether(
      lineup,
      [0, 1].map(
        i => () =>
          request(app)
            .post("/auth/signup")
            .send({ email, password: OWNER_PASSWORD, name: `Twin ${i}`, dealershipName: `Twin Motors ${lineup} ${i}` })
      )
    );

    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(storedUsers().filter(u => u.email === email)).toHaveLength(1);
    // The loser must not leave a dealership behind with nobody in it.
    expect(storedDealerships().filter(d => d.name.startsWith(`Twin Motors ${lineup}`))).toHaveLength(1);
  });
});

// ---- join --------------------------------------------------------------

describe.each(LINEUPS)("joining a dealership while other account changes are happening (%s)", lineup => {
  it("two people joining at the same moment both get accounts", async () => {
    const owner = await signup("join-pair");
    const link = await inviteLink(owner.token, "sales");
    const emails = [0, 1].map(i => `race-${runId}-pair-${tagFor(lineup)}-${i}@test.local`);

    const results = await startTogether(
      lineup,
      emails.map(
        email => () =>
          request(app).post("/auth/join").send({ token: link, name: "Pair", email, password: JOIN_PASSWORD })
      )
    );

    results.forEach(res => expect(res.status).toBe(200));
    for (const res of results) {
      expect((await request(app).get("/auth/me").set(bearer(res.body.token))).status).toBe(200);
    }
    const team = await request(app).get("/team").set(bearer(owner.token));
    expect(team.body.members.map((m: { email: string }) => m.email).sort()).toEqual([owner.email, ...emails].sort());
  });

  it("two joins with the same email: one account, the other is told it exists", async () => {
    const owner = await signup("join-twin");
    const link = await inviteLink(owner.token, "sales");
    const email = `race-${runId}-jtwin-${tagFor(lineup)}@test.local`;

    const results = await startTogether(
      lineup,
      [0, 1].map(
        () => () => request(app).post("/auth/join").send({ token: link, name: "Twin", email, password: JOIN_PASSWORD })
      )
    );

    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(storedUsers().filter(u => u.email === email)).toHaveLength(1);
  });

  it("a join in flight does not undo a promotion the owner makes meanwhile", async () => {
    const owner = await signup("join-promo");
    const member = await joinStaff(owner.token, "general");
    const link = await inviteLink(owner.token, "sales");
    const joinerEmail = `race-${runId}-promo-${tagFor(lineup)}@test.local`;

    const { slowRes, quickRes, quickFinishedFirst } = await overlap(
      lineup,
      () => request(app).post("/auth/join").send({ token: link, name: "Late Joiner", email: joinerEmail, password: JOIN_PASSWORD }),
      // A promotion, not a demotion: a demotion also cancels invite links
      // (see inviteRevocation.test.ts), which would stop this join and
      // hide what is being tested here.
      () => request(app).put(`/dealership/team/${member.user.id}`).set(bearer(owner.token)).send({ staffRole: "manager" })
    );

    expect(quickFinishedFirst, "the promotion has to land while the join is still running").toBe(true);
    expect(quickRes.status).toBe(200);
    expect(slowRes.status).toBe(200);
    expect(storedUsers().find(u => u.email === joinerEmail)).toBeDefined();
    const me = await request(app).get("/auth/me").set(bearer(member.token));
    expect(me.body.user.staffRole).toBe("manager");
  });
});

// ---- reset password ---------------------------------------------------

describe.each(LINEUPS)("a password reset in flight while the owner removes that person (%s)", lineup => {
  it("they stay removed, and the reset is told the account no longer exists", async () => {
    const owner = await signup("reset");
    const staff = await joinStaff(owner.token, "general");
    const resetToken = authModule.signPasswordResetToken(storedUsers().find(u => u.id === staff.user.id)!);

    const { slowRes, quickRes, quickFinishedFirst } = await overlap(
      lineup,
      () => request(app).post("/auth/reset-password").send({ token: resetToken, newPassword: "resetbyattacker123" }),
      () => request(app).delete(`/dealership/team/${staff.user.id}`).set(bearer(owner.token))
    );

    expect(quickFinishedFirst, "the removal has to land while the reset is still running").toBe(true);
    expect(quickRes.status).toBe(200);
    expect(slowRes.status).toBe(404);
    expect(slowRes.body.error).toBe("Account no longer exists");
    expect(storedUsers().some(u => u.id === staff.user.id)).toBe(false);
    expect((await request(app).get("/auth/me").set(bearer(staff.token))).status).toBe(401);
  });
});

// ---- the normal paths are unchanged -------------------------------------

describe("normal (no overlap) password routes still behave as before", () => {
  it("changing a password: wrong current password 401, right one 200, then the new password works", async () => {
    const owner = await signup("plain-pw");

    const wrong = await request(app)
      .put("/auth/password")
      .set(bearer(owner.token))
      .send({ currentPassword: "not-the-password", newPassword: "brandnewpass123" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe("Current password is incorrect");

    const right = await request(app)
      .put("/auth/password")
      .set(bearer(owner.token))
      .send({ currentPassword: OWNER_PASSWORD, newPassword: "brandnewpass123" });
    expect(right.status).toBe(200);
    expect(right.body).toEqual({ ok: true });

    const row = storedUsers().find(u => u.id === owner.user.id);
    expect(await bcrypt.compare("brandnewpass123", row!.passwordHash)).toBe(true);
  });

  it("resetting a password: a good token 200, and a token for an account that never existed 404", async () => {
    const owner = await signup("plain-reset");

    const ok = await request(app)
      .post("/auth/reset-password")
      .send({ token: authModule.signPasswordResetToken(storedUsers().find(u => u.id === owner.user.id)!), newPassword: "resetpassword123" });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true });
    const row = storedUsers().find(u => u.id === owner.user.id);
    expect(await bcrypt.compare("resetpassword123", row!.passwordHash)).toBe(true);

    const ghost = await request(app)
      .post("/auth/reset-password")
      .send({ token: authModule.signPasswordResetToken({ id: "no-such-account", passwordHash: "no-hash" }), newPassword: "resetpassword123" });
    expect(ghost.status).toBe(404);
    expect(ghost.body).toEqual({ ok: false, error: "Account no longer exists" });
  });

  it("signup and join keep their response shape", async () => {
    const owner = await signup("plain-shape");
    const res = await request(app)
      .post("/auth/join")
      .send({
        token: await inviteLink(owner.token, "finance"),
        name: "Shape Check",
        email: `race-${runId}-shape@test.local`,
        password: JOIN_PASSWORD,
      });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["approvalStatus", "ok", "token", "user"]);
    expect(res.body.approvalStatus).toBe("approved");
    expect(res.body.user).toMatchObject({ role: "staff", staffRole: "finance", dealershipId: owner.user.dealershipId });
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});
