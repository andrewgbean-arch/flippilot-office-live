import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "./app.js";
import * as authModule from "./auth.js";
import { isInviteRevoked, isStaffRoleDemotion, VALID_STAFF_ROLES } from "./auth.js";
import { readCollection, writeCollection } from "./db.js";

// An invite link is not tied to an email address and can be used more than
// once for its 7-day life. So before this, someone the owner had removed
// could walk straight back in with the link they originally used (getting the
// role baked into it), and someone the owner had just demoted could use a
// link carrying their old role to make a second account with it. Now
// removing a teammate, or moving one to a lower role, cancels every link
// shared before that moment; links made afterwards work as normal.

vi.setConfig({ testTimeout: 90_000 });

type StaffRole = "sales" | "finance" | "manager" | "general";
type StoredUserRow = { id: string; email: string; role: string; staffRole?: string; dealershipId: string };
type StoredDealershipRow = { id: string; inviteEpoch?: number };

const runId = Date.now();
const JOIN_PASSWORD = "joinedinvitepass123";
let counter = 0;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const storedUsers = () => readCollection<StoredUserRow>("users");
const storedDealership = (id: string) => readCollection<StoredDealershipRow>("dealerships").find(d => d.id === id);

const CANCELLED = "This invite link has been cancelled. Ask the dealership owner for a new link.";
const INVALID = "This invite link is invalid or has expired";

async function signup(tag: string) {
  counter += 1;
  const email = `invite-${runId}-${tag}-${counter}@test.local`;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email, password: "invitetestpass123", name: `Invite ${tag}`, dealershipName: `Invite Motors ${tag} ${counter}` });
  if (!res.body.token) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { email, token: res.body.token as string, user: res.body.user as { id: string; dealershipId: string } };
}

async function makeLink(ownerToken: string, staffRole: StaffRole = "general") {
  const res = await request(app)
    .post("/dealership/invite")
    .set(bearer(ownerToken))
    .send({ inviteeName: "Invite Joiner", staffRole });
  if (!res.body.token) throw new Error(`invite failed: ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

function join(link: string, email: string) {
  return request(app).post("/auth/join").send({ token: link, name: "Invite Joiner", email, password: JOIN_PASSWORD });
}

function preview(link: string) {
  return request(app).get(`/auth/invite/${encodeURIComponent(link)}`);
}

let emailCounter = 0;
const freshEmail = (tag: string) => `invite-${runId}-${tag}-${(emailCounter += 1)}@test.local`;

// A new staff account, made through a link. Returns the link too — the one
// thing the removed person still holds.
async function joinStaff(ownerToken: string, staffRole: StaffRole) {
  const link = await makeLink(ownerToken, staffRole);
  const email = freshEmail("joined");
  const res = await join(link, email);
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return { email, link, token: res.body.token as string, user: res.body.user as { id: string; dealershipId: string } };
}

const removeMember = (ownerToken: string, id: string) =>
  request(app).delete(`/dealership/team/${id}`).set(bearer(ownerToken));

const setRole = (ownerToken: string, id: string, staffRole: StaffRole) =>
  request(app).put(`/dealership/team/${id}`).set(bearer(ownerToken)).send({ staffRole });

// ---- counting and holding bcrypt -------------------------------------

// Every hash the app starts is counted, and while `holdHashes` is set each
// one waits at a gate the test controls (so a test can act while a join is
// stuck in the middle of hashing a password).
let hashCalls = 0;
let holdHashes: { arrived: () => void; released: Promise<void> } | null = null;

beforeAll(() => {
  const realHash = authModule.hashPassword;
  vi.spyOn(authModule, "hashPassword").mockImplementation(async password => {
    hashCalls += 1;
    if (holdHashes) {
      holdHashes.arrived();
      await holdHashes.released;
    }
    return realHash(password);
  });
});

afterEach(() => {
  holdHashes = null;
});

// ---- the pure rules ---------------------------------------------------

describe("isInviteRevoked", () => {
  it("lets a link through when the dealership is still on the generation the link was made under", () => {
    expect(isInviteRevoked({ inviteEpoch: 0 }, { inviteEpoch: 0 })).toBe(false);
    expect(isInviteRevoked({ inviteEpoch: 3 }, { inviteEpoch: 3 })).toBe(false);
  });

  it("cancels a link made under an earlier generation", () => {
    expect(isInviteRevoked({ inviteEpoch: 0 }, { inviteEpoch: 1 })).toBe(true);
    expect(isInviteRevoked({ inviteEpoch: 2 }, { inviteEpoch: 5 })).toBe(true);
  });

  it("treats a missing number as 0 on either side: old links and old dealerships keep working until the first removal", () => {
    expect(isInviteRevoked({}, {})).toBe(false);
    expect(isInviteRevoked({ inviteEpoch: 0 }, {})).toBe(false);
    expect(isInviteRevoked({}, { inviteEpoch: 0 })).toBe(false);
    expect(isInviteRevoked({}, { inviteEpoch: 1 })).toBe(true);
  });

  it("does not cancel a link from a LATER generation than the dealership's (can't normally happen)", () => {
    expect(isInviteRevoked({ inviteEpoch: 4 }, { inviteEpoch: 2 })).toBe(false);
  });
});

describe("isStaffRoleDemotion", () => {
  const down: Array<[StaffRole, StaffRole]> = [
    ["manager", "finance"],
    ["manager", "sales"],
    ["manager", "general"],
    ["finance", "sales"],
    ["finance", "general"],
    ["sales", "general"],
  ];

  it.each(down)("%s → %s is a step down", (from, to) => {
    expect(isStaffRoleDemotion(from, to)).toBe(true);
  });

  it.each(down.map(([from, to]) => [to, from] as [StaffRole, StaffRole]))("%s → %s is a step up, not a demotion", (from, to) => {
    expect(isStaffRoleDemotion(from, to)).toBe(false);
  });

  it.each(VALID_STAFF_ROLES)("%s staying the same is not a demotion", role => {
    expect(isStaffRoleDemotion(role, role)).toBe(false);
  });

  it("counts an account with no staffRole at all as general", () => {
    expect(isStaffRoleDemotion(undefined, "general")).toBe(false);
    expect(isStaffRoleDemotion(undefined, "sales")).toBe(false);
    expect(isStaffRoleDemotion(undefined, "manager")).toBe(false);
  });

  it("ranks every valid role: for any two different roles exactly one direction is a demotion", () => {
    for (const a of VALID_STAFF_ROLES) {
      for (const b of VALID_STAFF_ROLES) {
        if (a === b) continue;
        expect(isStaffRoleDemotion(a, b), `${a} → ${b}`).not.toBe(isStaffRoleDemotion(b, a));
      }
    }
  });
});

// ---- removal ----------------------------------------------------------

describe("removing a teammate cancels the invite links already shared", () => {
  it("the removed person can't come back with the link they used — same email or another", async () => {
    const owner = await signup("rejoin");
    const sarah = await joinStaff(owner.token, "manager");

    // Before removal the link is good: the join screen can read it.
    const before = await preview(sarah.link);
    expect(before.status).toBe(200);

    const removal = await removeMember(owner.token, sarah.user.id);
    expect(removal.status).toBe(200);
    expect(removal.body).toEqual({ ok: true }); // the response shape is unchanged
    expect((await request(app).get("/auth/me").set(bearer(sarah.token))).status).toBe(401);

    // The join screen's check now says the link is cancelled, and what to do.
    const after = await preview(sarah.link);
    expect(after.status).toBe(400);
    expect(after.body).toEqual({ ok: false, error: CANCELLED });

    // Same email, same link: refused (not "an account with that email already exists").
    const rejoin = await join(sarah.link, sarah.email);
    expect(rejoin.status).toBe(400);
    expect(rejoin.body).toEqual({ ok: false, error: CANCELLED });
    expect(rejoin.body.token).toBeUndefined();

    // The link isn't tied to an email, so someone else holding it is refused too.
    const other = freshEmail("holder");
    const stranger = await join(sarah.link, other);
    expect(stranger.status).toBe(400);
    expect(stranger.body.error).toBe(CANCELLED);

    expect(storedUsers().some(u => u.email === sarah.email || u.email === other)).toBe(false);
    const team = await request(app).get("/team").set(bearer(owner.token));
    expect(team.body.members.map((m: { email: string }) => m.email)).toEqual([owner.email]);
  });

  it("a link nobody has used yet is cancelled too — the owner has to send it again", async () => {
    const owner = await signup("pending");
    const leaver = await joinStaff(owner.token, "general");
    const pending = await makeLink(owner.token, "sales"); // meant for a new hire

    await removeMember(owner.token, leaver.user.id);

    expect((await preview(pending)).body.error).toBe(CANCELLED);
    expect((await join(pending, freshEmail("newhire"))).status).toBe(400);
  });

  it("a link made after the removal works, for the same person too if the owner chooses", async () => {
    const owner = await signup("fresh");
    const leaver = await joinStaff(owner.token, "manager");
    await removeMember(owner.token, leaver.user.id);

    const fresh = await makeLink(owner.token, "finance");
    expect((await preview(fresh)).status).toBe(200);

    const res = await join(fresh, leaver.email); // the owner decided to have them back
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: "staff", staffRole: "finance", dealershipId: owner.user.dealershipId });
    expect((await request(app).get("/auth/me").set(bearer(res.body.token))).status).toBe(200);
  });

  it("every removal cancels the links made before it, and none made after", async () => {
    const owner = await signup("twice");
    const first = await joinStaff(owner.token, "general");
    const second = await joinStaff(owner.token, "general");

    await removeMember(owner.token, first.user.id);
    const betweenRemovals = await makeLink(owner.token, "sales");
    expect((await preview(betweenRemovals)).status).toBe(200);

    await removeMember(owner.token, second.user.id);
    expect((await preview(betweenRemovals)).body.error).toBe(CANCELLED);

    const last = await makeLink(owner.token, "sales");
    expect((await join(last, freshEmail("last"))).status).toBe(200);
    expect(storedDealership(owner.user.dealershipId)?.inviteEpoch).toBe(2);
  });

  it("only the dealership that did the removing is affected", async () => {
    const ownerA = await signup("iso-a");
    const ownerB = await signup("iso-b");
    const linkForB = await makeLink(ownerB.token, "sales");
    const leaverA = await joinStaff(ownerA.token, "general");

    await removeMember(ownerA.token, leaverA.user.id);

    expect((await preview(linkForB)).status).toBe(200);
    expect((await join(linkForB, freshEmail("b-hire"))).status).toBe(200);
    expect(storedDealership(ownerB.user.dealershipId)?.inviteEpoch).toBeUndefined();
  });

  it("removals that don't happen don't cancel anything: a non-owner, an unknown id, the owner", async () => {
    const owner = await signup("noop");
    const manager = await joinStaff(owner.token, "manager");
    const target = await joinStaff(owner.token, "general");
    const link = await makeLink(owner.token, "sales");

    expect((await removeMember(manager.token, target.user.id)).status).toBe(403);
    expect((await removeMember(owner.token, "no-such-member")).status).toBe(404);
    expect((await removeMember(owner.token, owner.user.id)).status).toBe(400);

    expect((await preview(link)).status).toBe(200);
    expect(storedDealership(owner.user.dealershipId)?.inviteEpoch).toBeUndefined();
  });

  it("a link made in the same second as the removal is judged correctly, before it or after it", async () => {
    const owner = await signup("second");
    const leaver = await joinStaff(owner.token, "general");

    // A token's issue time only has whole-second resolution, so this
    // freezes the clock to put the link made just before the removal and
    // the link made just after it in the very same second.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date());
    let beforeRemoval: string;
    let afterRemoval: string;
    try {
      beforeRemoval = await makeLink(owner.token, "sales");
      expect((await removeMember(owner.token, leaver.user.id)).status).toBe(200);
      afterRemoval = await makeLink(owner.token, "sales");
    } finally {
      vi.useRealTimers();
    }

    const issued = (token: string) => (jwt.decode(token) as { iat: number }).iat;
    expect(issued(beforeRemoval)).toBe(issued(afterRemoval)); // really the same second

    expect((await preview(beforeRemoval)).body.error).toBe(CANCELLED);
    expect((await preview(afterRemoval)).status).toBe(200);
    expect((await join(afterRemoval, freshEmail("same-second"))).status).toBe(200);
  });

  it("the person can't get back in when the owner cancels the link while they are still typing their password", async () => {
    const owner = await signup("mid-join");
    const leaver = await joinStaff(owner.token, "general");
    const link = await makeLink(owner.token, "sales");
    const email = freshEmail("mid-join");

    let arrived!: () => void;
    let release!: () => void;
    const inBcrypt = new Promise<void>(resolve => (arrived = resolve));
    holdHashes = { arrived, released: new Promise<void>(resolve => (release = resolve)) };

    const joinPromise = Promise.resolve(join(link, email)); // passes the link check, then sits in the hash
    await inBcrypt;
    expect((await removeMember(owner.token, leaver.user.id)).status).toBe(200);
    release();

    const res = await joinPromise;
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: CANCELLED });
    expect(storedUsers().some(u => u.email === email)).toBe(false);
  });

  it("a cancelled link is refused before any password hashing is done", async () => {
    const owner = await signup("fastfail");
    const leaver = await joinStaff(owner.token, "general");
    await removeMember(owner.token, leaver.user.id);

    hashCalls = 0;
    const res = await join(leaver.link, freshEmail("fastfail"));
    expect(res.status).toBe(400);
    expect(hashCalls).toBe(0);
  });
});

// ---- links that were never affected -------------------------------------

describe("links and dealerships from before this existed", () => {
  const oldStyleLink = (dealershipId: string, dealershipName: string) =>
    jwt.sign(
      { purpose: "dealer-invite", dealershipId, dealershipName, role: "staff", staffRole: "general" },
      authModule.getJwtSecret(),
      { expiresIn: "7d" }
    );

  it("a link with no generation number works on a dealership that has never had a removal, and stops at the first one", async () => {
    const owner = await signup("legacy");
    expect(storedDealership(owner.user.dealershipId)?.inviteEpoch).toBeUndefined(); // no stamp yet
    const legacy = oldStyleLink(owner.user.dealershipId, "Legacy Motors");

    expect((await preview(legacy)).status).toBe(200);
    const email = freshEmail("legacy");
    const res = await join(legacy, email);
    expect(res.status).toBe(200);

    await removeMember(owner.token, res.body.user.id);
    expect((await preview(legacy)).body.error).toBe(CANCELLED);
  });

  it("a dealership record with the stamp written as 0 behaves the same as one with none", async () => {
    const owner = await signup("zero");
    writeCollection(
      "dealerships",
      readCollection<StoredDealershipRow>("dealerships").map(d =>
        d.id === owner.user.dealershipId ? { ...d, inviteEpoch: 0 } : d
      )
    );
    const link = await makeLink(owner.token, "general");
    expect((await preview(link)).status).toBe(200);
    expect((await join(link, freshEmail("zero"))).status).toBe(200);
  });

  it("garbage and expired tokens still get the old, generic message", async () => {
    expect((await preview("not-a-token")).body).toEqual({ ok: false, error: INVALID });
    const joined = await join("not-a-token", freshEmail("garbage"));
    expect(joined.status).toBe(400);
    expect(joined.body).toEqual({ ok: false, error: INVALID });

    const owner = await signup("expired");
    const expired = jwt.sign(
      { purpose: "dealer-invite", dealershipId: owner.user.dealershipId, dealershipName: "x", role: "staff", staffRole: "general" },
      authModule.getJwtSecret(),
      { expiresIn: -10 }
    );
    expect((await preview(expired)).body).toEqual({ ok: false, error: INVALID });
    expect((await join(expired, freshEmail("expired"))).body).toEqual({ ok: false, error: INVALID });
  });

  it("a link to a dealership that no longer exists can't create an account with nowhere to live", async () => {
    const owner = await signup("gone");
    const link = await makeLink(owner.token, "general");
    writeCollection(
      "dealerships",
      readCollection<StoredDealershipRow>("dealerships").filter(d => d.id !== owner.user.dealershipId)
    );

    expect((await preview(link)).body).toEqual({ ok: false, error: INVALID });
    const email = freshEmail("gone");
    const res = await join(link, email);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: INVALID });
    expect(storedUsers().some(u => u.email === email)).toBe(false);
  });
});

// ---- demotion -----------------------------------------------------------

describe("moving someone to a lower role also cancels the links already shared", () => {
  it("a step down cancels them; the same role, or a step up, leaves them alone", async () => {
    const owner = await signup("roles");
    const member = await joinStaff(owner.token, "finance");

    // [role to set, does it cancel the links that were out before?]
    const steps: Array<[StaffRole, boolean]> = [
      ["finance", false], // no change at all
      ["manager", false], // up
      ["finance", true], // manager → finance: down
      ["sales", true], // finance → sales: down
      ["finance", false], // sales → finance: up
      ["general", true], // finance → general: down
      ["sales", false], // general → sales: up
    ];

    for (const [role, cancels] of steps) {
      const link = await makeLink(owner.token, "manager"); // a link carrying a high role, out before the change
      expect((await preview(link)).status).toBe(200);

      const res = await setRole(owner.token, member.user.id, role);
      expect(res.status).toBe(200); // the change itself works as before
      expect(res.body.member.staffRole).toBe(role);
      expect(Object.keys(res.body).sort()).toEqual(["member", "ok"]);

      const after = await preview(link);
      if (cancels) {
        expect(after.status, `${role}: the link should be cancelled`).toBe(400);
        expect(after.body.error).toBe(CANCELLED);
      } else {
        expect(after.status, `${role}: the link should survive`).toBe(200);
      }
    }
  });

  it("the person just demoted can't use a link carrying their old role to make a second account", async () => {
    const owner = await signup("second-account");
    const manager = await joinStaff(owner.token, "manager");

    await setRole(owner.token, manager.user.id, "sales");

    const secondAccount = freshEmail("second-account");
    const res = await join(manager.link, secondAccount); // the manager-role link they were onboarded with
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CANCELLED);
    expect(storedUsers().some(u => u.email === secondAccount)).toBe(false);
  });

  it("a demotion that is refused (not the owner, not a valid role) cancels nothing", async () => {
    const owner = await signup("role-noop");
    const manager = await joinStaff(owner.token, "manager");
    const other = await joinStaff(owner.token, "manager");
    const link = await makeLink(owner.token, "sales");

    // a manager can't change roles; a made-up role is rejected; the owner can't be re-roled
    expect((await request(app).put(`/dealership/team/${other.user.id}`).set(bearer(manager.token)).send({ staffRole: "general" })).status).toBe(403);
    expect((await request(app).put(`/dealership/team/${other.user.id}`).set(bearer(owner.token)).send({ staffRole: "boss" })).status).toBe(400);
    expect((await setRole(owner.token, owner.user.id, "general")).status).toBe(400);

    expect((await preview(link)).status).toBe(200);
    expect(storedDealership(owner.user.dealershipId)?.inviteEpoch).toBeUndefined();
  });
});

// What the invite dialog tells the owner (src/dealer/settings/teamCopy.ts):
// anyone who holds the link can join, for 7 days, with the role chosen. These
// pin the two facts behind that wording, so the words can't drift from what
// the link really does.
describe("what an invite link really is, as the invite dialog describes it", () => {
  it("expires 7 days after it is made", async () => {
    const owner = await signup("lifetime");
    const link = await makeLink(owner.token, "general");
    const claims = jwt.decode(link) as { iat: number; exp: number };
    expect(claims.exp - claims.iat).toBe(7 * 24 * 60 * 60);
  });

  it("can be used by more than one person while it lasts, each getting the role it was made with", async () => {
    const owner = await signup("multi-use");
    const link = await makeLink(owner.token, "finance");

    const first = await join(link, freshEmail("multi-a"));
    const second = await join(link, freshEmail("multi-b"));

    for (const res of [first, second]) {
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ role: "staff", staffRole: "finance", dealershipId: owner.user.dealershipId });
    }
    expect(first.body.user.id).not.toBe(second.body.user.id);
  });
});

// The invite link's own token still carries what the join screen needs.
describe("a link made now carries the dealership's current generation", () => {
  it("is stamped 0 on a fresh dealership, and with the new number after a removal", async () => {
    const owner = await signup("stamp");
    const leaver = await joinStaff(owner.token, "general");

    expect((jwt.decode(leaver.link) as { inviteEpoch?: number }).inviteEpoch).toBe(0);
    await removeMember(owner.token, leaver.user.id);
    const later = await makeLink(owner.token, "general");
    expect((jwt.decode(later) as { inviteEpoch?: number }).inviteEpoch).toBe(1);
    // and the invite response shape is unchanged: just { ok, token }
    const res = await request(app).post("/dealership/invite").set(bearer(owner.token)).send({ staffRole: "general" });
    expect(Object.keys(res.body).sort()).toEqual(["ok", "token"]);
  });
});
