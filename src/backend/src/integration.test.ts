import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import {
  readCollection,
  writeCollection,
  writeTenantCollection,
  deleteTenantData,
  insertPhoto,
  countPhotos,
  getPhoto,
} from "./db.js";
import { buildBusinessSummary } from "./routes/pilotBrain.js";

// Real HTTP-level integration tests against the actual Express app —
// exactly the class of test that would have caught both bugs a manual
// security review found this session: GET /dvla missing from the auth
// gate entirely, and the syndication feed silently reading the wrong
// (global, not tenant-scoped) data source. Unit tests on pure functions
// don't exercise route wiring or middleware order at all; these do.
//
// Uses real throwaway accounts (unique per test run via Date.now()) and
// cleans them up in afterAll — same "create real data via the real
// flow, then delete it" pattern used for manual browser testing all
// session, just automated. Cleanup goes through the real db.ts
// functions (SQLite-backed) rather than touching files directly — this
// used to write straight to data/users.json /data/dealerships.json,
// which stopped meaning anything once storage moved to SQLite: the
// cleanup would silently no-op while leaving real rows behind.

const runId = Date.now();
const cleanupEmails: string[] = [];
const cleanupDealershipIds: string[] = [];

function trackUser(email: string) {
  cleanupEmails.push(email);
}
function trackDealership(id: string) {
  cleanupDealershipIds.push(id);
}

afterAll(() => {
  try {
    const users = readCollection<any>("users");
    writeCollection("users", users.filter(u => !cleanupEmails.includes(u.email)));

    const dealerships = readCollection<any>("dealerships");
    writeCollection("dealerships", dealerships.filter(d => !cleanupDealershipIds.includes(d.id)));

    for (const id of cleanupDealershipIds) {
      deleteTenantData(id);
    }
  } catch (err) {
    console.error("Integration test cleanup failed:", err);
  }
});

async function signup(suffix: string) {
  const email = `integration-test-${runId}-${suffix}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "integrationtestpass123",
    name: `Integration Test ${suffix}`,
    dealershipName: `Integration Test Dealership ${suffix}`,
  });
  trackUser(email);
  trackDealership(res.body.user.dealershipId);
  return { email, token: res.body.token as string, user: res.body.user };
}

// A new staff account inside an EXISTING dealership, via the real
// invite → join flow. A fresh invite + fresh email every call: reusing
// one email across joins would 409 ("account already exists") on every
// call after the first, leaving the token undefined and every later
// "authenticated" request silently unauthenticated instead.
let staffJoinCounter = 0;
async function joinStaff(
  ownerToken: string,
  staffRole: "sales" | "finance" | "manager" | "general"
) {
  staffJoinCounter += 1;
  const inviteRes = await request(app)
    .post("/dealership/invite")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ inviteeName: "Joined Tester", staffRole });
  const email = `integration-test-${runId}-joined-${staffJoinCounter}@test.local`;
  const joinRes = await request(app).post("/auth/join").send({
    token: inviteRes.body.token,
    name: "Joined Tester",
    email,
    password: "joinedtestpass123",
  });
  trackUser(email);
  if (!joinRes.body.token) {
    throw new Error(`joinStaff failed: ${JSON.stringify(joinRes.body)}`);
  }
  return { email, token: joinRes.body.token as string, user: joinRes.body.user };
}

describe("unauthenticated access is blocked on real data routes", () => {
  it.each([
    ["GET", "/inventory"],
    ["GET", "/leads"],
    ["GET", "/staff"],
    ["GET", "/bookkeeping"],
    ["GET", "/dvla?reg=AB12CDE"],
    ["GET", "/jobs"],
    ["GET", "/team"],
    ["GET", "/timekeeping"],
    ["GET", "/work-patterns"],
    ["GET", "/leave"],
    ["GET", "/rota-settings"],
    ["GET", "/shifts"],
    ["GET", "/notifications"],
    ["GET", "/feedback"],
    ["GET", "/consumables"],
    ["GET", "/appointments"],
  ])("%s %s returns 401 with no token", async (method, url) => {
    const res = await (request(app) as any)[method.toLowerCase()](url);
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("rejects a garbage Bearer token the same as no token", async () => {
    const res = await request(app).get("/inventory").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("syndication feed — deliberately unauthenticated, but tenant-scoped", () => {
  it("returns 200 with just a header row for a dealership with no vehicles, not an error", async () => {
    const { user } = await signup("synd");
    const res = await request(app).get(`/syndication/${user.dealershipId}/feed.csv`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Registration,Make,Model");
  });

  it("returns 200 with an empty-looking feed for a bogus dealershipId, not a crash or someone else's data", async () => {
    const res = await request(app).get("/syndication/00000000-not-a-real-id/feed.csv");
    expect(res.status).toBe(200);
    expect(res.text.split("\r\n").length).toBeLessThanOrEqual(2); // header only
  });
});

describe("signup → login → tenant isolation", () => {
  it("a fresh account can log in and read its own (empty) inventory", async () => {
    const { token } = await signup("iso-a");
    const res = await request(app).get("/inventory").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("one dealership's inventory writes are never visible to another", async () => {
    const dealerA = await signup("iso-b1");
    const dealerB = await signup("iso-b2");

    const vehicle = { id: "test-vehicle-1", make: "Ford", model: "Fiesta" };
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${dealerA.token}`)
      .send({ items: [vehicle] });

    const aRes = await request(app).get("/inventory").set("Authorization", `Bearer ${dealerA.token}`);
    const bRes = await request(app).get("/inventory").set("Authorization", `Bearer ${dealerB.token}`);

    expect(aRes.body.items).toHaveLength(1);
    expect(aRes.body.items[0].make).toBe("Ford");
    expect(bRes.body.items).toEqual([]); // dealer B sees none of dealer A's stock
  });
});

describe("jobs board — real persistence and /team, added same session as this test file", () => {
  it("a job written by one dealership never appears in another's board", async () => {
    const dealerA = await signup("jobs-a");
    const dealerB = await signup("jobs-b");

    const job = { id: "job-1", title: "Book MOT", status: "todo", priority: "high", createdAt: new Date().toISOString(), createdByName: "Tester" };
    await request(app)
      .put("/jobs")
      .set("Authorization", `Bearer ${dealerA.token}`)
      .send({ items: [job] });

    const aRes = await request(app).get("/jobs").set("Authorization", `Bearer ${dealerA.token}`);
    const bRes = await request(app).get("/jobs").set("Authorization", `Bearer ${dealerB.token}`);

    expect(aRes.body.items).toHaveLength(1);
    expect(bRes.body.items).toEqual([]);
  });

  it("/team lists only the caller's own dealership's real accounts, and never leaks a password hash", async () => {
    const dealerA = await signup("team-a");
    const dealerB = await signup("team-b");

    const aRes = await request(app).get("/team").set("Authorization", `Bearer ${dealerA.token}`);
    const bRes = await request(app).get("/team").set("Authorization", `Bearer ${dealerB.token}`);

    expect(aRes.body.members).toHaveLength(1);
    expect(aRes.body.members[0].email).toBe(dealerA.email);
    expect(aRes.body.members[0].passwordHash).toBeUndefined();
    expect(bRes.body.members.some((m: any) => m.email === dealerA.email)).toBe(false);
  });
});

describe("timekeeping — self-service clock in/out, server-derived identity and timestamps", () => {
  it("a dealer can clock in, shows up as open, then clock out closes it", async () => {
    const { token } = await signup("clock-a");

    const inRes = await request(app).post("/timekeeping/clock-in").set("Authorization", `Bearer ${token}`);
    expect(inRes.status).toBe(200);
    expect(inRes.body.entry.clockOut).toBeNull();

    const listAfterIn = await request(app).get("/timekeeping").set("Authorization", `Bearer ${token}`);
    expect(listAfterIn.body.items).toHaveLength(1);
    expect(listAfterIn.body.items[0].clockOut).toBeNull();

    const outRes = await request(app).post("/timekeeping/clock-out").set("Authorization", `Bearer ${token}`);
    expect(outRes.status).toBe(200);
    expect(outRes.body.items[0].clockOut).not.toBeNull();
  });

  it("cannot clock in twice without clocking out first", async () => {
    const { token } = await signup("clock-b");
    await request(app).post("/timekeeping/clock-in").set("Authorization", `Bearer ${token}`);
    const secondIn = await request(app).post("/timekeeping/clock-in").set("Authorization", `Bearer ${token}`);
    expect(secondIn.status).toBe(409);
  });

  it("cannot clock out without an open entry", async () => {
    const { token } = await signup("clock-c");
    const res = await request(app).post("/timekeeping/clock-out").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it("one dealership's time entries are never visible to another", async () => {
    const dealerA = await signup("clock-iso-a");
    const dealerB = await signup("clock-iso-b");

    await request(app).post("/timekeeping/clock-in").set("Authorization", `Bearer ${dealerA.token}`);

    const aRes = await request(app).get("/timekeeping").set("Authorization", `Bearer ${dealerA.token}`);
    const bRes = await request(app).get("/timekeeping").set("Authorization", `Bearer ${dealerB.token}`);

    expect(aRes.body.items).toHaveLength(1);
    expect(bRes.body.items).toEqual([]);
  });

  it("a non-manager cannot correct a time entry, but a manager/owner can", async () => {
    const owner = await signup("clock-owner");
    const clockInRes = await request(app)
      .post("/timekeeping/clock-in")
      .set("Authorization", `Bearer ${owner.token}`);
    const entryId = clockInRes.body.entry.id;

    const inviteRes = await request(app)
      .post("/dealership/invite")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ inviteeName: "Sales Tester", staffRole: "sales" });
    const joinRes = await request(app).post("/auth/join").send({
      token: inviteRes.body.token,
      name: "Sales Tester",
      email: `integration-test-${runId}-clock-sales@test.local`,
      password: "salestestpass123",
    });
    trackUser(`integration-test-${runId}-clock-sales@test.local`);
    const salesToken = joinRes.body.token as string;

    const blockedRes = await request(app)
      .put(`/timekeeping/${entryId}`)
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ clockOut: new Date().toISOString() });
    expect(blockedRes.status).toBe(403);

    const allowedRes = await request(app)
      .put(`/timekeeping/${entryId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ clockOut: new Date().toISOString() });
    expect(allowedRes.status).toBe(200);
  });
});

describe("planner — work patterns, leave requests, rota settings, auto-generated shifts", () => {
  let joinCounter = 0;
  async function inviteAndJoin(ownerToken: string, staffRole: string) {
    joinCounter += 1;
    const inviteRes = await request(app)
      .post("/dealership/invite")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ inviteeName: "Planner Tester", staffRole });
    const email = `integration-test-${runId}-planner-${joinCounter}@test.local`;
    const joinRes = await request(app).post("/auth/join").send({
      token: inviteRes.body.token,
      name: "Planner Tester",
      email,
      password: "plannertestpass123",
    });
    trackUser(email);
    if (!joinRes.body.token) {
      throw new Error(`inviteAndJoin failed: ${JSON.stringify(joinRes.body)}`);
    }
    return joinRes.body.token as string;
  }

  it("a non-manager cannot set work patterns, but the owner can", async () => {
    const owner = await signup("planner-wp-owner");
    const salesToken = await inviteAndJoin(owner.token, "sales");

    const blocked = await request(app)
      .put("/work-patterns")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ items: [] });
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .put("/work-patterns")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        items: [
          { userId: "u1", userName: "Full Timer", employmentType: "full_time", targetWeeklyHours: 40, availableDays: ["mon", "tue", "wed", "thu", "fri"] },
        ],
      });
    expect(allowed.status).toBe(200);
    expect(allowed.body.items).toHaveLength(1);
  });

  it("sick leave is auto-approved; holiday starts pending and needs a manager decision", async () => {
    const owner = await signup("planner-leave-owner");
    const salesToken = await inviteAndJoin(owner.token, "sales");

    const sickRes = await request(app)
      .post("/leave")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ type: "sick", startDate: "2030-02-04", endDate: "2030-02-04" });
    expect(sickRes.status).toBe(200);
    expect(sickRes.body.entry.status).toBe("approved");

    const holidayRes = await request(app)
      .post("/leave")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ type: "holiday", startDate: "2030-03-01", endDate: "2030-03-05" });
    expect(holidayRes.status).toBe(200);
    expect(holidayRes.body.entry.status).toBe("pending");

    const blockedApprove = await request(app)
      .put(`/leave/${holidayRes.body.entry.id}`)
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ status: "approved" });
    expect(blockedApprove.status).toBe(403);

    const approve = await request(app)
      .put(`/leave/${holidayRes.body.entry.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "approved" });
    expect(approve.status).toBe(200);
    const updated = approve.body.items.find((l: any) => l.id === holidayRes.body.entry.id);
    expect(updated.status).toBe("approved");
    expect(updated.decidedByName).toBe(owner.user.name);
  });

  it("a staff member can withdraw their own pending request but not once it's approved", async () => {
    const owner = await signup("planner-cancel-owner");
    const salesToken = await inviteAndJoin(owner.token, "sales");

    const holidayRes = await request(app)
      .post("/leave")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ type: "holiday", startDate: "2030-04-01", endDate: "2030-04-02" });
    const id = holidayRes.body.entry.id;

    await request(app)
      .put(`/leave/${id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "approved" });

    const blockedDelete = await request(app)
      .delete(`/leave/${id}`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect(blockedDelete.status).toBe(403);

    const holiday2 = await request(app)
      .post("/leave")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ type: "holiday", startDate: "2030-05-01", endDate: "2030-05-02" });
    const ownDelete = await request(app)
      .delete(`/leave/${holiday2.body.entry.id}`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect(ownDelete.status).toBe(200);
  });

  it("rota settings default sensibly and can be updated by a manager", async () => {
    const { token } = await signup("planner-settings");
    const defaults = await request(app).get("/rota-settings").set("Authorization", `Bearer ${token}`);
    expect(defaults.body.settings.openDays).toContain("mon");

    const updateRes = await request(app)
      .put("/rota-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ openDays: ["mon", "tue"], openTime: "08:00", closeTime: "16:00" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.settings.closeTime).toBe("16:00");
  });

  it("auto-generate builds shifts from work patterns, skips approved leave, and never double-books an existing shift", async () => {
    const owner = await signup("planner-generate");
    const dealershipId = owner.user.dealershipId;

    await request(app)
      .put("/work-patterns")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        items: [
          {
            userId: owner.user.id,
            userName: owner.user.name,
            employmentType: "part_time",
            targetWeeklyHours: 10,
            availableDays: ["mon", "tue", "wed"],
          },
        ],
      });

    // Approved leave on the Tuesday of the target week should be skipped.
    const leaveRes = await request(app)
      .post("/leave")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ type: "sick", startDate: "2030-01-08", endDate: "2030-01-08" });
    expect(leaveRes.body.entry.status).toBe("approved");

    const generateRes = await request(app)
      .post("/shifts/generate")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ weekStart: "2030-01-07" }); // Mon 2030-01-07 .. Sun 2030-01-13
    expect(generateRes.status).toBe(200);

    const dates = generateRes.body.generated.map((s: any) => s.date);
    expect(dates).toContain("2030-01-07"); // Monday
    expect(dates).not.toContain("2030-01-08"); // Tuesday — on leave
    expect(dates).toContain("2030-01-09"); // Wednesday
    expect(dates).not.toContain("2030-01-10"); // Thursday — not an available day

    // Re-running for the same week must not create duplicate shifts for
    // days already filled.
    const secondRun = await request(app)
      .post("/shifts/generate")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ weekStart: "2030-01-07" });
    expect(secondRun.body.generated).toEqual([]);

    const finalShifts = await request(app).get("/shifts").set("Authorization", `Bearer ${owner.token}`);
    expect(finalShifts.body.items.filter((s: any) => s.date === "2030-01-07")).toHaveLength(1);
    trackDealership(dealershipId);
  });
});

describe("notifications — a real per-recipient inbox, not just a local UI store", () => {
  it("a notification sent to one user is invisible to another, even in the same dealership", async () => {
    const owner = await signup("notif-a");
    const sender = await signup("notif-b");

    const sendRes = await request(app)
      .post("/notifications")
      .set("Authorization", `Bearer ${sender.token}`)
      .send({ userId: owner.user.id, title: "Rota published", message: "Mon: 09:00-17:00", type: "info" });
    expect(sendRes.status).toBe(200);

    // Sent to owner.user.id, but from a DIFFERENT dealership than the
    // owner's — never visible to anyone since it can never match a
    // GET filter scoped to the owner's own dealership's collection.
    const ownerInbox = await request(app).get("/notifications").set("Authorization", `Bearer ${owner.token}`);
    expect(ownerInbox.body.items).toEqual([]);

    const senderInbox = await request(app).get("/notifications").set("Authorization", `Bearer ${sender.token}`);
    expect(senderInbox.body.items).toEqual([]); // sender isn't the recipient either
  });

  it("a notification actually reaches its recipient's own inbox within the same dealership", async () => {
    const owner = await signup("notif-c");
    const salesToken = await (async () => {
      const inviteRes = await request(app)
        .post("/dealership/invite")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ inviteeName: "Notif Sales", staffRole: "sales" });
      const email = `integration-test-${runId}-notif-sales@test.local`;
      const joinRes = await request(app).post("/auth/join").send({
        token: inviteRes.body.token,
        name: "Notif Sales",
        email,
        password: "notiftestpass123",
      });
      trackUser(email);
      return joinRes.body.token as string;
    })();

    const meRes = await request(app).get("/team").set("Authorization", `Bearer ${salesToken}`);
    const salesUserId = meRes.body.members.find((m: any) => m.email.includes("notif-sales")).id;

    const sendRes = await request(app)
      .post("/notifications")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: salesUserId, title: "New shift added", message: "2026-09-14: 09:00–17:00", type: "info" });
    expect(sendRes.status).toBe(200);

    const salesInbox = await request(app).get("/notifications").set("Authorization", `Bearer ${salesToken}`);
    expect(salesInbox.body.items).toHaveLength(1);
    expect(salesInbox.body.items[0].title).toBe("New shift added");

    const ownerInbox = await request(app).get("/notifications").set("Authorization", `Bearer ${owner.token}`);
    expect(ownerInbox.body.items).toEqual([]); // the owner sent it, doesn't also receive it
  });

  it("only the recipient can mark their own notification read or dismiss it", async () => {
    const owner = await signup("notif-d");

    // A colleague in the SAME dealership — the 403 (not you) path only
    // makes sense when the notification is visible in that
    // dealership's own collection at all; a different dealership
    // entirely hits 404 first (see the isolation test above).
    const inviteRes = await request(app)
      .post("/dealership/invite")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ inviteeName: "Notif Colleague", staffRole: "sales" });
    const colleagueEmail = `integration-test-${runId}-notif-colleague@test.local`;
    const joinRes = await request(app).post("/auth/join").send({
      token: inviteRes.body.token,
      name: "Notif Colleague",
      email: colleagueEmail,
      password: "notiftestpass123",
    });
    trackUser(colleagueEmail);
    const other = { token: joinRes.body.token as string };

    const sendRes = await request(app)
      .post("/notifications")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: owner.user.id, title: "Test", message: "Test", type: "info" });
    const id = sendRes.body.entry.id;

    const blockedRead = await request(app)
      .put(`/notifications/${id}/read`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(blockedRead.status).toBe(403);

    const blockedDelete = await request(app)
      .delete(`/notifications/${id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(blockedDelete.status).toBe(403);

    const okRead = await request(app)
      .put(`/notifications/${id}/read`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(okRead.status).toBe(200);

    const okDelete = await request(app)
      .delete(`/notifications/${id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(okDelete.status).toBe(200);

    const finalInbox = await request(app).get("/notifications").set("Authorization", `Bearer ${owner.token}`);
    expect(finalInbox.body.items).toEqual([]);
  });
});

describe("feedback — internal suggestion box, anonymous means genuinely unlinkable", () => {
  it("a named submission carries the real submitter, an anonymous one carries neither id nor name", async () => {
    const { token, user } = await signup("feedback-a");

    const namedRes = await request(app).post("/feedback").set("Authorization", `Bearer ${token}`).send({
      message: "More parking for customers would help.",
    });
    expect(namedRes.status).toBe(200);
    expect(namedRes.body.entry.userId).toBe(user.id);
    expect(namedRes.body.entry.userName).toBe(user.name);
    expect(namedRes.body.entry.status).toBe("new");

    const anonRes = await request(app)
      .post("/feedback")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Break room could use a new kettle.", anonymous: true });
    expect(anonRes.status).toBe(200);
    expect(anonRes.body.entry.userId).toBeNull();
    expect(anonRes.body.entry.userName).toBeNull();
  });

  it("a non-manager cannot change a suggestion's status, but a manager/owner can", async () => {
    const owner = await signup("feedback-b");
    const inviteRes = await request(app)
      .post("/dealership/invite")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ inviteeName: "Feedback Sales", staffRole: "sales" });
    const email = `integration-test-${runId}-feedback-sales@test.local`;
    const joinRes = await request(app).post("/auth/join").send({
      token: inviteRes.body.token,
      name: "Feedback Sales",
      email,
      password: "feedbacktestpass123",
    });
    trackUser(email);
    const salesToken = joinRes.body.token as string;

    const postRes = await request(app)
      .post("/feedback")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ message: "Test suggestion" });
    const id = postRes.body.entry.id;

    const blocked = await request(app)
      .put(`/feedback/${id}/status`)
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ status: "reviewed" });
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .put(`/feedback/${id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "reviewed" });
    expect(allowed.status).toBe(200);
    expect(allowed.body.items.find((f: any) => f.id === id).status).toBe("reviewed");
  });
});

describe("consumables — open to any authenticated staff, tenant-scoped", () => {
  it("any staff can add and read consumables, but never another dealership's", async () => {
    const dealerA = await signup("consumables-a");
    const dealerB = await signup("consumables-b");

    const addRes = await request(app)
      .post("/consumables")
      .set("Authorization", `Bearer ${dealerA.token}`)
      .send({ name: "Screen wash", supplierEmail: "orders@supplier.test", currentStock: 2, reorderThreshold: 5 });
    expect(addRes.status).toBe(200);
    expect(addRes.body.entry.name).toBe("Screen wash");

    const aList = await request(app).get("/consumables").set("Authorization", `Bearer ${dealerA.token}`);
    const bList = await request(app).get("/consumables").set("Authorization", `Bearer ${dealerB.token}`);
    expect(aList.body.items).toHaveLength(1);
    expect(bList.body.items).toEqual([]);
  });

  it("can be deleted by any authenticated staff", async () => {
    const { token } = await signup("consumables-c");
    const addRes = await request(app)
      .post("/consumables")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Oil filters", currentStock: 10, reorderThreshold: 3 });
    const id = addRes.body.entry.id;

    const delRes = await request(app).delete(`/consumables/${id}`).set("Authorization", `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    const list = await request(app).get("/consumables").set("Authorization", `Bearer ${token}`);
    expect(list.body.items).toEqual([]);
  });
});

describe("public booking — the one part of the app reachable with no account at all", () => {
  it("info and vehicles 404 for a dealership that doesn't exist, rather than leaking anything", async () => {
    const infoRes = await request(app).get("/public/00000000-not-real/info");
    expect(infoRes.status).toBe(404);

    const vehiclesRes = await request(app).get("/public/00000000-not-real/vehicles");
    expect(vehiclesRes.status).toBe(404);
  });

  it("available-slots respects opening days/hours and excludes an already-booked time", async () => {
    const owner = await signup("public-slots");
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ items: [{ id: "veh-slots", make: "Renault", model: "Clio" }] });

    // Default settings: Mon–Sat, 09:00–18:00, 30-minute slots. 2030-01-06
    // is a Sunday (closed), 2030-01-07 a Monday (open).
    const closedDayRes = await request(app).get(`/public/${owner.user.dealershipId}/available-slots?date=2030-01-06`);
    expect(closedDayRes.status).toBe(200);
    expect(closedDayRes.body.slots).toEqual([]);

    const openDayRes = await request(app).get(`/public/${owner.user.dealershipId}/available-slots?date=2030-01-07`);
    expect(openDayRes.status).toBe(200);
    expect(openDayRes.body.slots[0]).toBe("09:00");
    expect(openDayRes.body.slots).toContain("10:00");
    expect(openDayRes.body.slots).not.toContain("18:00"); // a slot starting exactly at close doesn't fit

    await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      vehicleId: "veh-slots",
      customerName: "Slot Test",
      customerPhone: "07700900002",
      type: "viewing",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });

    const afterBookingRes = await request(app).get(`/public/${owner.user.dealershipId}/available-slots?date=2030-01-07`);
    expect(afterBookingRes.body.slots).not.toContain("10:00");
    expect(afterBookingRes.body.slots).toContain("10:30");
  });

  it("rejects a booking for a time that isn't actually available (closed day or already taken)", async () => {
    const owner = await signup("public-slot-reject");
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ items: [{ id: "veh-reject", make: "Nissan", model: "Micra" }] });

    const closedDayBooking = await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      vehicleId: "veh-reject",
      customerName: "Sunday Test",
      customerPhone: "07700900003",
      type: "viewing",
      requestedDate: "2030-01-06", // Sunday — closed by default
      requestedTime: "10:00",
    });
    expect(closedDayBooking.status).toBe(409);

    const outsideHoursBooking = await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      vehicleId: "veh-reject",
      customerName: "Too Early Test",
      customerPhone: "07700900004",
      type: "viewing",
      requestedDate: "2030-01-07",
      requestedTime: "07:00", // before opening
    });
    expect(outsideHoursBooking.status).toBe(409);
  });

  it("only a manager/owner can change booking-availability settings, and the change takes effect for customers", async () => {
    const owner = await signup("public-settings-change");
    const inviteRes = await request(app)
      .post("/dealership/invite")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ inviteeName: "Settings Sales", staffRole: "sales" });
    const email = `integration-test-${runId}-settings-sales@test.local`;
    const joinRes = await request(app).post("/auth/join").send({
      token: inviteRes.body.token,
      name: "Settings Sales",
      email,
      password: "settingstestpass123",
    });
    trackUser(email);
    const salesToken = joinRes.body.token as string;

    const blocked = await request(app)
      .put("/booking-settings")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ openDays: ["mon"], openTime: "09:00", closeTime: "17:00", slotMinutes: 60 });
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .put("/booking-settings")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ openDays: ["mon"], openTime: "09:00", closeTime: "17:00", slotMinutes: 60 });
    expect(allowed.status).toBe(200);

    // 2030-01-08 is a Tuesday — no longer an open day under the new settings.
    const tuesdayRes = await request(app).get(`/public/${owner.user.dealershipId}/available-slots?date=2030-01-08`);
    expect(tuesdayRes.body.slots).toEqual([]);

    // Monday now uses 60-minute slots instead of the default 30.
    const mondayRes = await request(app).get(`/public/${owner.user.dealershipId}/available-slots?date=2030-01-07`);
    expect(mondayRes.body.slots).toEqual(["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]);
  });

  it("a one-off closed date (bank holiday) overrides an otherwise-open weekday", async () => {
    const owner = await signup("public-closed-date");
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ items: [{ id: "veh-closed-date", make: "Vauxhall", model: "Corsa" }] });

    // 2030-01-07 is a Monday, open by default.
    const beforeClosure = await request(app).get(`/public/${owner.user.dealershipId}/available-slots?date=2030-01-07`);
    expect(beforeClosure.body.slots.length).toBeGreaterThan(0);

    const setRes = await request(app)
      .put("/booking-settings")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ openDays: ["mon", "tue", "wed", "thu", "fri", "sat"], openTime: "09:00", closeTime: "18:00", slotMinutes: 30, closedDates: ["2030-01-07"] });
    expect(setRes.status).toBe(200);

    const afterClosure = await request(app).get(`/public/${owner.user.dealershipId}/available-slots?date=2030-01-07`);
    expect(afterClosure.body.slots).toEqual([]);

    // A different open Monday is unaffected.
    const otherMonday = await request(app).get(`/public/${owner.user.dealershipId}/available-slots?date=2030-01-14`);
    expect(otherMonday.body.slots.length).toBeGreaterThan(0);

    const bookAttempt = await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      vehicleId: "veh-closed-date",
      customerName: "Bank Holiday Test",
      customerPhone: "07700900007",
      type: "viewing",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });
    expect(bookAttempt.status).toBe(409);
  });

  it("books an MOT against the customer's own reg, not dealer stock — no vehicleId, no DVSA lookup needed", async () => {
    const owner = await signup("public-mot");

    const missingReg = await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      customerName: "No Reg Given",
      customerPhone: "07700900005",
      type: "mot",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });
    expect(missingReg.status).toBe(400);

    const bookRes = await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      customerVehicleReg: "ab12 cde",
      customerName: "MOT Customer",
      customerPhone: "07700900006",
      type: "mot",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });
    expect(bookRes.status).toBe(200);
    expect(bookRes.body.appointment.vehicleId).toBeUndefined();
    expect(bookRes.body.appointment.customerVehicleReg).toBe("AB12CDE");
    expect(bookRes.body.appointment.vehicleLabel).toBe("AB12CDE");

    const staffView = await request(app).get("/appointments").set("Authorization", `Bearer ${owner.token}`);
    const motAppt = staffView.body.items.find((a: any) => a.id === bookRes.body.appointment.id);
    expect(motAppt.type).toBe("mot");
    expect(motAppt.customerVehicleReg).toBe("AB12CDE");
  });

  it("returns only the requested dealership's own name and vehicles, never another's", async () => {
    const dealerA = await signup("public-a");
    const dealerB = await signup("public-b");

    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${dealerA.token}`)
      .send({ items: [{ id: "veh-a", make: "Ford", model: "Fiesta", reg: "AB12CDE", year: 2020, mileage: 30000, priceRetail: 7000 }] });

    const infoRes = await request(app).get(`/public/${dealerA.user.dealershipId}/info`);
    expect(infoRes.status).toBe(200);
    expect(infoRes.body.name).toBe("Integration Test Dealership public-a");

    const vehiclesA = await request(app).get(`/public/${dealerA.user.dealershipId}/vehicles`);
    const vehiclesB = await request(app).get(`/public/${dealerB.user.dealershipId}/vehicles`);
    expect(vehiclesA.body.items).toHaveLength(1);
    expect(vehiclesA.body.items[0].make).toBe("Ford");
    expect(vehiclesB.body.items).toEqual([]);

    // Never leaks internal-only fields a customer shouldn't see.
    expect(vehiclesA.body.items[0]).not.toHaveProperty("buyPrice");
    expect(vehiclesA.body.items[0]).not.toHaveProperty("purchasePrice");
  });

  it("a real booking creates a real appointment, matches/creates a real lead, and notifies real staff", async () => {
    const owner = await signup("public-booking");
    const dealershipId = owner.user.dealershipId;

    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ items: [{ id: "veh-booking", make: "Vauxhall", model: "Corsa", reg: "BD19XYZ" }] });

    const bookRes = await request(app).post(`/public/${dealershipId}/appointments`).send({
      vehicleId: "veh-booking",
      customerName: "Test Customer",
      customerEmail: "test.customer@example.test",
      type: "test_drive",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });
    expect(bookRes.status).toBe(200);
    expect(bookRes.body.appointment.status).toBe("pending");
    expect(bookRes.body.appointment.vehicleLabel).toContain("Corsa");

    const appointmentsRes = await request(app).get("/appointments").set("Authorization", `Bearer ${owner.token}`);
    expect(appointmentsRes.body.items).toHaveLength(1);

    const leadsRes = await request(app).get("/leads").set("Authorization", `Bearer ${owner.token}`);
    expect(leadsRes.body.items).toHaveLength(1);
    expect(leadsRes.body.items[0].status).toBe("test_drive");
    expect(leadsRes.body.items[0].email).toBe("test.customer@example.test");

    // The owner gets a real notification in their own inbox — same
    // cross-account delivery mechanism as the rota planner, not just a
    // row sitting in a collection nobody's told about.
    const notifRes = await request(app).get("/notifications").set("Authorization", `Bearer ${owner.token}`);
    expect(notifRes.body.items.some((n: any) => n.title.includes("test drive"))).toBe(true);
  });

  it("rejects a booking for a vehicle that doesn't belong to that dealership", async () => {
    const dealerA = await signup("public-cross-a");
    const dealerB = await signup("public-cross-b");

    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${dealerB.token}`)
      .send({ items: [{ id: "veh-b-only", make: "Audi", model: "A3" }] });

    const res = await request(app).post(`/public/${dealerA.user.dealershipId}/appointments`).send({
      vehicleId: "veh-b-only",
      customerName: "Test Customer",
      customerEmail: "cross@example.test",
      type: "viewing",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });
    expect(res.status).toBe(400);
  });

  it("requires at least a phone or an email so the dealer can actually confirm the booking", async () => {
    const owner = await signup("public-no-contact");
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ items: [{ id: "veh-no-contact", make: "Kia", model: "Picanto" }] });

    const res = await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      vehicleId: "veh-no-contact",
      customerName: "No Contact",
      type: "viewing",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });
    expect(res.status).toBe(400);
  });

  it("only an authenticated staff member can confirm or decline an appointment", async () => {
    const owner = await signup("public-decide");
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ items: [{ id: "veh-decide", make: "Seat", model: "Ibiza" }] });

    const bookRes = await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      vehicleId: "veh-decide",
      customerName: "Decide Test",
      customerPhone: "07700900000",
      type: "viewing",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });
    const id = bookRes.body.appointment.id;

    const unauthedRes = await request(app).put(`/appointments/${id}`).send({ status: "confirmed" });
    expect(unauthedRes.status).toBe(401);

    const confirmRes = await request(app)
      .put(`/appointments/${id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "confirmed" });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.items[0].status).toBe("confirmed");
  });

  it("a dealer can reschedule an appointment to a different time before confirming it", async () => {
    const owner = await signup("public-reschedule");
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ items: [{ id: "veh-reschedule", make: "Skoda", model: "Fabia" }] });

    const bookRes = await request(app).post(`/public/${owner.user.dealershipId}/appointments`).send({
      vehicleId: "veh-reschedule",
      customerName: "Reschedule Test",
      customerPhone: "07700900001",
      type: "viewing",
      requestedDate: "2030-01-07",
      requestedTime: "10:00",
    });
    const id = bookRes.body.appointment.id;

    // Save a new time without deciding yet — stays pending.
    const rescheduleRes = await request(app)
      .put(`/appointments/${id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ requestedDate: "2030-01-08", requestedTime: "14:00" });
    expect(rescheduleRes.status).toBe(200);
    const rescheduled = rescheduleRes.body.items.find((a: any) => a.id === id);
    expect(rescheduled.requestedDate).toBe("2030-01-08");
    expect(rescheduled.requestedTime).toBe("14:00");
    expect(rescheduled.status).toBe("pending");

    // Then confirm the new time in a separate call.
    const confirmRes = await request(app)
      .put(`/appointments/${id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "confirmed" });
    const confirmed = confirmRes.body.items.find((a: any) => a.id === id);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.requestedDate).toBe("2030-01-08"); // the rescheduled time, not the original request
  });
});

describe("RBAC — the exact scenario manually verified live earlier this session, now automated", () => {
  let ownerToken: string;
  let dealershipId: string;

  beforeAll(async () => {
    const owner = await signup("rbac-owner");
    ownerToken = owner.token;
    dealershipId = owner.user.dealershipId;
  });

  let salesJoinCounter = 0;

  // A fresh invite + fresh email every call — reusing one email across
  // multiple joins would 409 ("account already exists") on every call
  // after the first, leaving the token undefined and every subsequent
  // "authenticated" request silently unauthenticated instead.
  async function joinAsSales() {
    salesJoinCounter += 1;
    const inviteRes = await request(app)
      .post("/dealership/invite")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ inviteeName: "Sales Tester", staffRole: "sales" });
    const inviteToken = inviteRes.body.token;

    const email = `integration-test-${runId}-sales-${salesJoinCounter}@test.local`;
    const joinRes = await request(app).post("/auth/join").send({
      token: inviteToken,
      name: "Sales Tester",
      email,
      password: "salestestpass123",
    });
    trackUser(email);
    if (!joinRes.body.token) {
      throw new Error(`joinAsSales failed: ${JSON.stringify(joinRes.body)}`);
    }
    return joinRes.body.token as string;
  }

  it("owner can generate an invite carrying a real staffRole", async () => {
    const res = await request(app)
      .post("/dealership/invite")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ inviteeName: "Test", staffRole: "sales" });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("a non-owner cannot generate an invite at all", async () => {
    const salesToken = await joinAsSales();
    const res = await request(app)
      .post("/dealership/invite")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ inviteeName: "Should Fail", staffRole: "manager" });
    expect(res.status).toBe(403);
  });

  it("a sales-role account is blocked from writing bookkeeping (403) but can still read it (200)", async () => {
    const salesToken = await joinAsSales();

    const writeRes = await request(app)
      .put("/bookkeeping")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] });
    expect(writeRes.status).toBe(403);

    const readRes = await request(app).get("/bookkeeping").set("Authorization", `Bearer ${salesToken}`);
    expect(readRes.status).toBe(200);
  });

  it("a sales-role account is blocked from managing staff", async () => {
    const salesToken = await joinAsSales();
    const res = await request(app)
      .put("/staff")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ items: [] });
    expect(res.status).toBe(403);
  });

  it("a sales-role account CAN write leads — no restriction added there", async () => {
    const salesToken = await joinAsSales();
    const res = await request(app)
      .put("/leads")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ items: [] });
    expect(res.status).toBe(200);
  });

  it("the owner's own writes are never blocked by any staffRole check", async () => {
    const res = await request(app)
      .put("/bookkeeping")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] });
    expect(res.status).toBe(200);
  });
});

// The new-dealership approval gate. Every OTHER test in this file signs up
// under NODE_ENV=test, where signup auto-approves (see routes/auth.ts) so
// the rest of the suite isn't forced to approve dozens of throwaway
// dealerships — this block explicitly opts back in to the real "pending"
// behavior with requireApproval: true to exercise the actual gate.
describe("new-dealership approval gate", () => {
  async function signupPending(suffix: string) {
    const email = `integration-test-${runId}-${suffix}@test.local`;
    const res = await request(app).post("/auth/signup").send({
      email,
      password: "integrationtestpass123",
      name: `Integration Test ${suffix}`,
      dealershipName: `Integration Test Dealership ${suffix}`,
      requireApproval: true,
    });
    trackUser(email);
    trackDealership(res.body.user.dealershipId);
    return { email, token: res.body.token as string, user: res.body.user, signupRes: res };
  }

  it("a fresh signup that opts into the real gate starts pending, and says so in the response", async () => {
    const { signupRes } = await signupPending("appr-a");
    expect(signupRes.body.approvalStatus).toBe("pending");
  });

  it("a pending dealership is blocked (403) from real business data routes", async () => {
    const { token } = await signupPending("appr-b");
    for (const url of ["/inventory", "/leads", "/bookkeeping", "/diary", "/customers"]) {
      const res = await request(app).get(url).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.approvalStatus).toBe("pending");
    }
  });

  it("a pending dealership can still reach /dealership/me so a client can show its real status", async () => {
    const { token } = await signupPending("appr-c");
    const res = await request(app).get("/dealership/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.dealership.approvalStatus).toBe("pending");
  });

  it("login reports the real approval status for a pending dealership", async () => {
    const { email } = await signupPending("appr-d");
    const res = await request(app).post("/auth/login").send({ email, password: "integrationtestpass123" });
    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe("pending");
  });

  it("a non-admin cannot approve a dealership (403)", async () => {
    const pending = await signupPending("appr-e1");
    const other = await signup("appr-e2");
    const res = await request(app)
      .post(`/admin/dealerships/${pending.user.dealershipId}/approve`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(403);
  });

  it("the platform admin can approve it, after which its own routes open up", async () => {
    const pending = await signupPending("appr-f1");
    const admin = await signup("appr-f2");

    const prevAdminEmail = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = admin.email;
    try {
      const approveRes = await request(app)
        .post(`/admin/dealerships/${pending.user.dealershipId}/approve`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.dealership.approvalStatus).toBe("approved");
    } finally {
      if (prevAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = prevAdminEmail;
    }

    const afterRes = await request(app).get("/inventory").set("Authorization", `Bearer ${pending.token}`);
    expect(afterRes.status).toBe(200);
  });

  it("a dealership with no approvalStatus at all (predates the gate) is grandfathered in, not locked out", async () => {
    const { token, user } = await signup("appr-g");
    const dealerships = readCollection<any>("dealerships");
    writeCollection(
      "dealerships",
      dealerships.map(d => {
        if (d.id !== user.dealershipId) return d;
        const { approvalStatus, ...rest } = d;
        return rest;
      })
    );
    const res = await request(app).get("/inventory").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// requireAuth used to trust the claims baked into the JWT and never look
// the account up, so an employee the owner removed kept full access to
// the dealership's leads/customers/bookkeeping until their 7-day token
// expired, and a role change (manager demoted to sales) did nothing
// until they happened to log in again. These edit the `users`
// collection directly (the owner-facing routes that do the same thing
// are covered in the next block) and assert the very next request on
// the SAME old token sees the change.
describe("requireAuth checks the stored account on every request, not the token's baked-in claims", () => {
  let ownerToken: string;

  beforeAll(async () => {
    const owner = await signup("stored-owner");
    ownerToken = owner.token;
  });

  function editStoredUser(id: string, patch: Record<string, unknown>) {
    const users = readCollection<any>("users");
    writeCollection("users", users.map(u => (u.id === id ? { ...u, ...patch } : u)));
  }

  function removeStoredUser(id: string) {
    const users = readCollection<any>("users");
    writeCollection("users", users.filter(u => u.id !== id));
  }

  it("the normal signup → request flow is unaffected, and /auth/me returns exactly the public account (no password hash, no token-only claims like iat/exp)", async () => {
    const { token, user } = await signup("stored-normal");

    const inventoryRes = await request(app).get("/inventory").set("Authorization", `Bearer ${token}`);
    expect(inventoryRes.status).toBe(200);

    const meRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user).toEqual(user);
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });

  it("a staff account joined from an invite works, then a user deleted from `users` gets 401 everywhere with their old, still-valid token", async () => {
    const staff = await joinStaff(ownerToken, "general");
    const urls = ["/auth/me", "/dealership/me", "/inventory", "/team"];

    // The token is genuinely good before removal, so the 401s below can
    // only be down to the removal itself.
    for (const url of urls) {
      const res = await request(app).get(url).set("Authorization", `Bearer ${staff.token}`);
      expect(res.status, `before removal: GET ${url}`).toBe(200);
    }

    removeStoredUser(staff.user.id);

    for (const url of urls) {
      const res = await request(app).get(url).set("Authorization", `Bearer ${staff.token}`);
      expect(res.status, `after removal: GET ${url}`).toBe(401);
      expect(res.body).toEqual({ ok: false, error: "Invalid or expired session" });
    }

    // Writes are blocked too, not just reads.
    const writeRes = await request(app)
      .put("/leads")
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ items: [] });
    expect(writeRes.status).toBe(401);

    // Removing one person leaves everyone else in the dealership alone.
    const ownerRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${ownerToken}`);
    expect(ownerRes.status).toBe(200);
  });

  it("demoting a manager to sales takes effect on their very next request, without re-login", async () => {
    const staff = await joinStaff(ownerToken, "manager");
    const manageStaff = () =>
      request(app).put("/staff").set("Authorization", `Bearer ${staff.token}`).send({ items: [] });

    expect((await manageStaff()).status).toBe(200); // manager-only route, fine as a manager

    editStoredUser(staff.user.id, { staffRole: "sales" });

    expect((await manageStaff()).status).toBe(403); // same token, now blocked

    // /auth/me is what the web client reads to decide what to show, so
    // it has to report the current role too, not the one in the token.
    const meRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${staff.token}`);
    expect(meRes.body.user.staffRole).toBe("sales");
  });

  it("promoting a general account to manager takes effect immediately too", async () => {
    const staff = await joinStaff(ownerToken, "general");
    const manageStaff = () =>
      request(app).put("/staff").set("Authorization", `Bearer ${staff.token}`).send({ items: [] });

    expect((await manageStaff()).status).toBe(403);

    editStoredUser(staff.user.id, { staffRole: "manager" });

    expect((await manageStaff()).status).toBe(200);
  });

  it("demoting an owner to staff closes owner-only routes on their next request", async () => {
    const owner = await signup("stored-demote-owner");
    const invite = () =>
      request(app)
        .post("/dealership/invite")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ staffRole: "sales" });

    expect((await invite()).status).toBe(200);

    editStoredUser(owner.user.id, { role: "staff", staffRole: "general" });

    expect((await invite()).status).toBe(403);
  });

  // The one place the app removes users today: the platform admin
  // deleting a whole dealership. Before this, an owner whose dealership
  // was deleted could still call /auth/me (and any route outside the
  // subscription gate) with a 200 for the rest of the token's life.
  it("when a platform admin deletes a whole dealership, its sessions die with it", async () => {
    const doomed = await signup("stored-del-owner");
    const admin = await signup("stored-del-admin");

    const beforeRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${doomed.token}`);
    expect(beforeRes.status).toBe(200);

    const prevAdminEmail = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = admin.email;
    try {
      const deleteRes = await request(app)
        .delete(`/admin/dealerships/${doomed.user.dealershipId}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(deleteRes.status).toBe(200);
    } finally {
      if (prevAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = prevAdminEmail;
    }

    const afterRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${doomed.token}`);
    expect(afterRes.status).toBe(401);

    // The admin's own session is untouched.
    const adminRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${admin.token}`);
    expect(adminRes.status).toBe(200);
  });
});

// The owner-facing way to do what the block above does by editing the
// database: change a teammate's role, or remove them. Until these
// existed, the only way to cut off a departing employee was to edit the
// `users` collection by hand.
describe("owner-managed team — change a role, remove a member", () => {
  let owner: Awaited<ReturnType<typeof signup>>;

  beforeAll(async () => {
    owner = await signup("team-mgmt-owner");
  });

  const asOwner = () => ({ Authorization: `Bearer ${owner.token}` });

  it("an owner can change a member's role, and it takes effect on that member's very next request", async () => {
    const member = await joinStaff(owner.token, "general");
    const manageStaff = () =>
      request(app).put("/staff").set("Authorization", `Bearer ${member.token}`).send({ items: [] });

    expect((await manageStaff()).status).toBe(403); // a general account can't manage staff

    const res = await request(app)
      .put(`/dealership/team/${member.user.id}`)
      .set(asOwner())
      .send({ staffRole: "manager" });
    expect(res.status).toBe(200);
    expect(res.body.member.staffRole).toBe("manager");
    expect(res.body.member.passwordHash).toBeUndefined();

    expect((await manageStaff()).status).toBe(200); // same token, now a manager
  });

  it("rejects a role that isn't one of the four staff roles — including 'owner' — and leaves the account alone", async () => {
    const member = await joinStaff(owner.token, "sales");

    for (const bad of ["owner", "admin", "", undefined, 5]) {
      const res = await request(app)
        .put(`/dealership/team/${member.user.id}`)
        .set(asOwner())
        .send({ staffRole: bad });
      expect(res.status, `staffRole ${JSON.stringify(bad)}`).toBe(400);
    }

    const meRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${member.token}`);
    expect(meRes.body.user.staffRole).toBe("sales");
    expect(meRes.body.user.role).toBe("staff");
  });

  it("an owner can remove a member: their old token dies, they leave /team, and they can't log back in", async () => {
    const member = await joinStaff(owner.token, "general");
    const bystander = await joinStaff(owner.token, "general");

    const before = await request(app).get("/inventory").set("Authorization", `Bearer ${member.token}`);
    expect(before.status).toBe(200);

    const res = await request(app).delete(`/dealership/team/${member.user.id}`).set(asOwner());
    expect(res.status).toBe(200);

    const after = await request(app).get("/inventory").set("Authorization", `Bearer ${member.token}`);
    expect(after.status).toBe(401);

    const teamRes = await request(app).get("/team").set(asOwner());
    const ids = teamRes.body.members.map((m: any) => m.id);
    expect(ids).not.toContain(member.user.id);
    expect(ids).toContain(bystander.user.id);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: member.email, password: "joinedtestpass123" });
    expect(loginRes.status).toBe(401);

    // Everyone else is untouched.
    const bystanderRes = await request(app).get("/inventory").set("Authorization", `Bearer ${bystander.token}`);
    expect(bystanderRes.status).toBe(200);
  });

  it("no staff account can remove or re-role anyone — not even a manager", async () => {
    const manager = await joinStaff(owner.token, "manager");
    const target = await joinStaff(owner.token, "general");
    const managerAuth = { Authorization: `Bearer ${manager.token}` };

    const roleRes = await request(app)
      .put(`/dealership/team/${target.user.id}`)
      .set(managerAuth)
      .send({ staffRole: "manager" });
    expect(roleRes.status).toBe(403);

    const removeRes = await request(app).delete(`/dealership/team/${target.user.id}`).set(managerAuth);
    expect(removeRes.status).toBe(403);

    const targetRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${target.token}`);
    expect(targetRes.status).toBe(200);
    expect(targetRes.body.user.staffRole).toBe("general");
  });

  it("requires a login at all", async () => {
    const member = await joinStaff(owner.token, "general");
    expect((await request(app).delete(`/dealership/team/${member.user.id}`)).status).toBe(401);
    expect(
      (await request(app).put(`/dealership/team/${member.user.id}`).send({ staffRole: "manager" })).status
    ).toBe(401);
  });

  it("the owner account can't be removed or re-roled — which also means an owner can't remove themselves", async () => {
    const removeRes = await request(app).delete(`/dealership/team/${owner.user.id}`).set(asOwner());
    expect(removeRes.status).toBe(400);

    const roleRes = await request(app)
      .put(`/dealership/team/${owner.user.id}`)
      .set(asOwner())
      .send({ staffRole: "general" });
    expect(roleRes.status).toBe(400);

    const meRes = await request(app).get("/auth/me").set(asOwner());
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.role).toBe("owner");
  });

  it("an owner can't touch another dealership's people — 404, indistinguishable from an id that doesn't exist", async () => {
    const otherOwner = await signup("team-mgmt-other");
    const victim = await joinStaff(otherOwner.token, "general");

    const removeRes = await request(app).delete(`/dealership/team/${victim.user.id}`).set(asOwner());
    expect(removeRes.status).toBe(404);

    const roleRes = await request(app)
      .put(`/dealership/team/${victim.user.id}`)
      .set(asOwner())
      .send({ staffRole: "manager" });
    expect(roleRes.status).toBe(404);

    const unknownRes = await request(app).delete("/dealership/team/not-a-real-id").set(asOwner());
    expect(unknownRes.status).toBe(404);
    expect(unknownRes.body).toEqual(removeRes.body);

    const victimRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${victim.token}`);
    expect(victimRes.status).toBe(200);
    expect(victimRes.body.user.staffRole).toBe("general");
  });

  // Deliberately outside the subscription gate, like /dealership/invite:
  // an owner must always be able to cut off a departing employee, even
  // with a lapsed trial.
  it("still works when the dealership's trial has lapsed and the data routes are closed (402)", async () => {
    const lapsedOwner = await signup("team-mgmt-lapsed");
    const member = await joinStaff(lapsedOwner.token, "general");

    const dealerships = readCollection<any>("dealerships");
    writeCollection(
      "dealerships",
      dealerships.map(d =>
        d.id === lapsedOwner.user.dealershipId
          ? { ...d, subscriptionStatus: "canceled", trialEndsAt: new Date(0).toISOString() }
          : d
      )
    );

    const gated = await request(app).get("/team").set("Authorization", `Bearer ${lapsedOwner.token}`);
    expect(gated.status).toBe(402); // sanity: the dealership really is locked out of data routes

    const res = await request(app)
      .delete(`/dealership/team/${member.user.id}`)
      .set("Authorization", `Bearer ${lapsedOwner.token}`);
    expect(res.status).toBe(200);

    const after = await request(app).get("/auth/me").set("Authorization", `Bearer ${member.token}`);
    expect(after.status).toBe(401);
  });

  it("removing someone also stops the rota and job board acting for them, while keeping the records of work already done", async () => {
    const boss = await signup("team-mgmt-cascade");
    const bossAuth = { Authorization: `Bearer ${boss.token}` };
    const staff = await joinStaff(boss.token, "sales");

    // A time entry that must survive (pay records).
    const clockIn = await request(app)
      .post("/timekeeping/clock-in")
      .set("Authorization", `Bearer ${staff.token}`);
    expect(clockIn.status).toBe(200);

    const pattern = (u: any) => ({
      userId: u.id,
      userName: u.name,
      employmentType: "full_time",
      targetWeeklyHours: 40,
      availableDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      holidayEntitlementDays: 28,
    });
    await request(app)
      .put("/work-patterns")
      .set(bossAuth)
      .send({ items: [pattern(staff.user), pattern(boss.user)] });

    const shift = (id: string, u: any, date: string) => ({
      id,
      userId: u.id,
      userName: u.name,
      date,
      start: "09:00",
      end: "17:00",
      autoGenerated: false,
      createdAt: new Date().toISOString(),
    });
    await request(app)
      .put("/shifts")
      .set(bossAuth)
      .send({
        items: [
          shift("past-shift", staff.user, "2000-01-03"),
          shift("future-shift", staff.user, "2999-01-04"),
          shift("owner-future-shift", boss.user, "2999-01-04"),
        ],
      });

    const job = (id: string, u: any | null, status: string) => ({
      id,
      title: id,
      status,
      priority: "low",
      createdAt: new Date().toISOString(),
      createdByName: boss.user.name,
      assignedToUserId: u?.id ?? null,
      assignedToName: u?.name ?? null,
    });
    await request(app)
      .put("/jobs")
      .set(bossAuth)
      .send({
        items: [
          job("open-todo", staff.user, "todo"),
          job("open-in-progress", staff.user, "in_progress"),
          job("finished", staff.user, "done"),
          job("owners-job", boss.user, "todo"),
        ],
      });

    const removeRes = await request(app).delete(`/dealership/team/${staff.user.id}`).set(bossAuth);
    expect(removeRes.status).toBe(200);

    // Work pattern gone, so the generator can't keep scheduling them.
    const patterns = await request(app).get("/work-patterns").set(bossAuth);
    expect(patterns.body.items.map((p: any) => p.userId)).toEqual([boss.user.id]);

    const generated = await request(app)
      .post("/shifts/generate")
      .set(bossAuth)
      .send({ weekStart: "2999-01-06" });
    expect(generated.status).toBe(200);
    expect(generated.body.generated.length).toBeGreaterThan(0);
    expect(generated.body.generated.every((s: any) => s.userId === boss.user.id)).toBe(true);

    // Future shifts gone; the past one (a record of a day already worked) stays.
    const shifts = await request(app).get("/shifts").set(bossAuth);
    const shiftIds = shifts.body.items.map((s: any) => s.id);
    expect(shiftIds).toContain("past-shift");
    expect(shiftIds).toContain("owner-future-shift");
    expect(shiftIds).not.toContain("future-shift");

    // Open jobs are unassigned; a finished job keeps its history; other
    // people's jobs are untouched.
    const jobs = await request(app).get("/jobs").set(bossAuth);
    const byId = Object.fromEntries(jobs.body.items.map((j: any) => [j.id, j]));
    expect(byId["open-todo"].assignedToUserId).toBeNull();
    expect(byId["open-todo"].assignedToName).toBeNull();
    expect(byId["open-in-progress"].assignedToUserId).toBeNull();
    expect(byId["finished"].assignedToUserId).toBe(staff.user.id);
    expect(byId["finished"].assignedToName).toBe(staff.user.name);
    expect(byId["owners-job"].assignedToUserId).toBe(boss.user.id);

    // Timekeeping is a pay record: kept, and still names who it was.
    const time = await request(app).get("/timekeeping").set(bossAuth);
    expect(time.body.items).toHaveLength(1);
    expect(time.body.items[0].userId).toBe(staff.user.id);
    expect(time.body.items[0].userName).toBe(staff.user.name);
  });
});

// The web app used to seed 8 "In Stock" demo cars (ids ULTRA-001..005,
// DM-001..003) into every new dealership's real stock, which the two
// anonymous public routes below then published as the dealer's own
// cars. New accounts no longer get them, but existing ones still hold
// them, so these routes must never publish them.
describe("public store page and stock feed never publish the old seeded demo cars", () => {
  const car = (id: string, make: string, model: string) => ({
    id,
    make,
    model,
    year: 2018,
    mileage: 40000,
    priceRetail: 5000,
    condition: "Good",
    status: "In Stock",
  });

  it("publishes a dealer's real stock but nothing carrying a demo id — on both the storefront route and the feed", async () => {
    const dealer = await signup("sample-vehicles");
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${dealer.token}`)
      .send({
        items: [
          car("ULTRA-001", "BMW", "M2 Competition"),
          car("ULTRA-005", "Ford", "Focus RS"),
          car("DM-002", "Peugeot", "208 Active"),
          car("real-vehicle-1", "Vauxhall", "Astra Real"),
        ],
      });

    const storefront = await request(app).get(`/public/${dealer.user.dealershipId}/vehicles`);
    expect(storefront.status).toBe(200);
    expect(storefront.body.items.map((v: any) => v.model)).toEqual(["Astra Real"]);

    const feed = await request(app).get(`/syndication/${dealer.user.dealershipId}/feed.csv`);
    expect(feed.status).toBe(200);
    expect(feed.text).toContain("Astra Real");
    for (const demoModel of ["M2 Competition", "Focus RS", "208 Active"]) {
      expect(feed.text).not.toContain(demoModel);
    }
  });

  it("the dealer's own signed-in view of their stock is untouched — the demo ids are only hidden from the public", async () => {
    const dealer = await signup("sample-vehicles-own-view");
    await request(app)
      .put("/inventory")
      .set("Authorization", `Bearer ${dealer.token}`)
      .send({ items: [car("ULTRA-002", "Audi", "RS3 Sportback")] });

    const own = await request(app).get("/inventory").set("Authorization", `Bearer ${dealer.token}`);
    expect(own.body.items.map((v: any) => v.id)).toEqual(["ULTRA-002"]);
  });
});

// "completed" only said an appointment was closed out — nothing recorded
// whether the customer turned up, or bought, so Pilot Brain could see
// "appointment booked" and never where deals actually broke down.
describe("appointment outcomes — what actually happened, not just that it was booked", () => {
  let owner: Awaited<ReturnType<typeof signup>>;
  let slot = 0;

  // A distinct 30-minute slot each time (09:00, 09:30, ...) on one open
  // Monday, since a taken slot can't be booked twice.
  function nextTime() {
    const mins = 9 * 60 + 30 * slot++;
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }

  const asOwner = () => ({ Authorization: `Bearer ${owner.token}` });

  beforeAll(async () => {
    owner = await signup("appt-outcome");
    await request(app)
      .put("/inventory")
      .set(asOwner())
      .send({ items: [{ id: "veh-outcome", make: "Ford", model: "Focus" }] });
  });

  async function book(type: "viewing" | "test_drive" | "mot") {
    const res = await request(app)
      .post(`/public/${owner.user.dealershipId}/appointments`)
      .send({
        ...(type === "mot" ? { customerVehicleReg: "ab12 cde" } : { vehicleId: "veh-outcome" }),
        customerName: `Outcome ${type} ${slot}`,
        customerPhone: "07700900123",
        type,
        requestedDate: "2030-01-07",
        requestedTime: nextTime(),
      });
    if (res.status !== 200) throw new Error(`booking failed: ${JSON.stringify(res.body)}`);
    return res.body.appointment.id as string;
  }

  async function bookAndConfirm(type: "viewing" | "test_drive" | "mot") {
    const id = await book(type);
    await request(app).put(`/appointments/${id}`).set(asOwner()).send({ status: "confirmed" });
    return id;
  }

  const put = (id: string, body: object) => request(app).put(`/appointments/${id}`).set(asOwner()).send(body);
  const find = (res: any, id: string) => res.body.items.find((a: any) => a.id === id);

  it("recording an outcome closes a confirmed appointment as completed and stamps when it was recorded", async () => {
    const id = await bookAndConfirm("viewing");

    const res = await put(id, { outcome: "purchased" });
    expect(res.status).toBe(200);
    const saved = find(res, id);
    expect(saved.status).toBe("completed");
    expect(saved.outcome).toBe("purchased");
    expect(Number.isNaN(Date.parse(saved.outcomeAt))).toBe(false);

    const list = await request(app).get("/appointments").set(asOwner());
    expect(find(list, id).outcome).toBe("purchased"); // persisted, not just echoed
  });

  it("the outcome can be corrected by recording a different one", async () => {
    const id = await bookAndConfirm("test_drive");
    await put(id, { outcome: "no_show" });
    const res = await put(id, { outcome: "showed" });
    expect(res.status).toBe(200);
    expect(find(res, id).outcome).toBe("showed");
  });

  it("an appointment already marked completed (before outcomes existed) can have one recorded later", async () => {
    const id = await bookAndConfirm("viewing");
    await put(id, { status: "completed" });

    const res = await put(id, { outcome: "showed" });
    expect(res.status).toBe(200);
    expect(find(res, id).outcome).toBe("showed");
  });

  it("rejects anything that isn't showed / purchased / no_show", async () => {
    const id = await bookAndConfirm("viewing");
    for (const bad of ["bought", "attended", "", 5, null]) {
      const res = await put(id, { outcome: bad });
      expect(res.status, `outcome ${JSON.stringify(bad)}`).toBe(400);
    }
    const list = await request(app).get("/appointments").set(asOwner());
    expect(find(list, id).outcome).toBeUndefined();
    expect(find(list, id).status).toBe("confirmed"); // a rejected outcome changes nothing
  });

  it("a pending or declined request can't have an outcome — it never happened", async () => {
    const pendingId = await book("viewing");
    expect((await put(pendingId, { outcome: "showed" })).status).toBe(400);

    const declinedId = await book("viewing");
    await put(declinedId, { status: "declined" });
    expect((await put(declinedId, { outcome: "no_show" })).status).toBe(400);
  });

  it("an MOT booking can be showed or no_show, but never purchased — it's the customer's own car", async () => {
    const id = await bookAndConfirm("mot");
    expect((await put(id, { outcome: "purchased" })).status).toBe(400);
    expect((await put(id, { outcome: "showed" })).status).toBe(200);
  });

  it("an outcome can't be combined with a different status, but can with 'completed'", async () => {
    const id = await bookAndConfirm("viewing");
    expect((await put(id, { outcome: "showed", status: "pending" })).status).toBe(400);
    const res = await put(id, { outcome: "showed", status: "completed" });
    expect(res.status).toBe(200);
    expect(find(res, id).outcome).toBe("showed");
  });

  it("moving a completed appointment back to another status drops its outcome instead of leaving it hanging", async () => {
    const id = await bookAndConfirm("viewing");
    await put(id, { outcome: "no_show" });

    const res = await put(id, { status: "confirmed" });
    expect(res.status).toBe(200);
    expect(find(res, id).outcome).toBeUndefined();
    expect(find(res, id).outcomeAt).toBeUndefined();
  });

  it("only signed-in staff of the same dealership can record one", async () => {
    const id = await bookAndConfirm("viewing");
    expect((await request(app).put(`/appointments/${id}`).send({ outcome: "showed" })).status).toBe(401);

    const other = await signup("appt-outcome-other");
    const cross = await request(app)
      .put(`/appointments/${id}`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ outcome: "showed" });
    expect(cross.status).toBe(404); // not found in THEIR dealership, so no probing across tenants
  });

  it("outcomes show up in Pilot Brain's business snapshot, and it says so plainly when there are none", async () => {
    const dealer = await signup("appt-outcome-snapshot");
    const id = dealer.user.dealershipId;
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const past = (n: number, patch: object) => ({
      id: `snap-${n}`,
      vehicleLabel: "Ford Focus",
      customerName: `Snapshot ${n}`,
      type: "viewing",
      requestedDate: daysAgo(n),
      requestedTime: "10:00",
      status: "completed",
      createdAt: new Date().toISOString(),
      ...patch,
    });

    writeTenantCollection(id, "appointments", [past(5, { status: "confirmed" })]);
    const before = buildBusinessSummary(id);
    expect(before).toContain("Appointment outcomes (last 90 days): none recorded yet");
    expect(before).toContain("1 past appointment in that window still has no recorded outcome");

    writeTenantCollection(id, "appointments", [
      past(5, { outcome: "purchased" }),
      past(6, { outcome: "showed" }),
      past(7, { outcome: "no_show" }),
    ]);
    const after = buildBusinessSummary(id);
    expect(after).toContain("3 recorded");
    expect(after).toContain("2 attended (1 showed, 1 bought), 1 no-show");
    expect(after).toContain("show rate 67%");
    expect(after).toContain("too few to call a trend");
  });
});

// Pay summary — gross pay for clocked hours at an owner-set rate. This is
// other people's wages, so the tests are mostly about who can see what:
// rates are owner-only (and deliberately NOT on the work pattern, which
// every staff member can read), and a staff member only ever sees their
// own summary. The arithmetic itself is unit-tested in payEngine.test.ts.
describe("pay summary — access control and wiring", () => {
  const PERIOD = "start=2026-09-14&end=2026-09-20";

  // A fresh dealership per test — signup() reuses an email if the suffix
  // repeats, which would 409 every call after the first.
  let setupCounter = 0;
  async function setup() {
    setupCounter += 1;
    const owner = await signup(`pay-owner-${setupCounter}`);
    const staff = await joinStaff(owner.token, "sales");
    const colleague = await joinStaff(owner.token, "general");
    const dealershipId = owner.user.dealershipId as string;

    // 8h30m for staff and 4h for the colleague, both on Mon 14 Sept.
    writeTenantCollection(dealershipId, "timekeeping", [
      { id: "t1", userId: staff.user.id, userName: "Staff", clockIn: "2026-09-14T08:00:00Z", clockOut: "2026-09-14T16:30:00Z" },
      { id: "t2", userId: colleague.user.id, userName: "Colleague", clockIn: "2026-09-14T08:00:00Z", clockOut: "2026-09-14T12:00:00Z" },
    ]);
    return { owner, staff, colleague, dealershipId };
  }

  const setRate = (ownerToken: string, userId: string, hourlyRate: unknown) =>
    request(app).put(`/pay/rates/${userId}`).set("Authorization", `Bearer ${ownerToken}`).send({ hourlyRate });

  it("the owner can set a rate and read it back", async () => {
    const { owner, staff } = await setup();
    const res = await setRate(owner.token, staff.user.id, 12.5);
    expect(res.status).toBe(200);
    expect(res.body.rate.hourlyRate).toBe(12.5);

    const list = await request(app).get("/pay/rates").set("Authorization", `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].userId).toBe(staff.user.id);
  });

  it("staff can't read the rates list, set a rate, or clear one", async () => {
    const { owner, staff, colleague } = await setup();
    await setRate(owner.token, colleague.user.id, 14);

    expect((await request(app).get("/pay/rates").set("Authorization", `Bearer ${staff.token}`)).status).toBe(403);
    expect((await setRate(staff.token, staff.user.id, 99)).status).toBe(403);
    expect(
      (await request(app).delete(`/pay/rates/${colleague.user.id}`).set("Authorization", `Bearer ${staff.token}`)).status
    ).toBe(403);

    // and the colleague's rate is untouched
    const list = await request(app).get("/pay/rates").set("Authorization", `Bearer ${owner.token}`);
    expect(list.body.items[0].hourlyRate).toBe(14);
  });

  it("rejects nonsense rates instead of quietly saving them as someone's wage", async () => {
    const { owner, staff } = await setup();
    for (const bad of [0, -5, "12.50", null, 501, 12.345]) {
      expect((await setRate(owner.token, staff.user.id, bad)).status).toBe(400);
    }
    // ...but ordinary penny-precision rates are fine, floating-point noise and all
    expect((await setRate(owner.token, staff.user.id, 11.44)).status).toBe(200);
  });

  it("can't set a rate for someone in a different dealership", async () => {
    const { owner } = await setup();
    const other = await signup("pay-other-dealer");
    const res = await setRate(owner.token, other.user.id, 12);
    expect(res.status).toBe(404);
  });

  it("a staff member sees their own summary — hours, their rate, and the gross worked out from them", async () => {
    const { owner, staff } = await setup();
    await setRate(owner.token, staff.user.id, 12.5);

    const res = await request(app).get(`/pay/summary?${PERIOD}`).set("Authorization", `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.totalHours).toBe(8.5);
    expect(res.body.summary.hourlyRate).toBe(12.5);
    expect(res.body.summary.grossPay).toBe(106.25);
    expect(res.body.summary.days).toHaveLength(1);
  });

  it("with no rate set, the hours still show but there's no pay figure", async () => {
    const { staff } = await setup();
    const res = await request(app).get(`/pay/summary?${PERIOD}`).set("Authorization", `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.totalHours).toBe(8.5);
    expect(res.body.summary.hourlyRate).toBeNull();
    expect(res.body.summary.grossPay).toBeNull();
  });

  it("clearing a rate takes the pay figure away again", async () => {
    const { owner, staff } = await setup();
    await setRate(owner.token, staff.user.id, 12.5);
    await request(app).delete(`/pay/rates/${staff.user.id}`).set("Authorization", `Bearer ${owner.token}`);
    const res = await request(app).get(`/pay/summary?${PERIOD}`).set("Authorization", `Bearer ${staff.token}`);
    expect(res.body.summary.grossPay).toBeNull();
  });

  it("a staff member can't view a colleague's summary — or the owner's — and learns nothing about who exists", async () => {
    const { owner, staff, colleague } = await setup();
    await setRate(owner.token, colleague.user.id, 30);

    const ofColleague = await request(app)
      .get(`/pay/summary?${PERIOD}&userId=${colleague.user.id}`)
      .set("Authorization", `Bearer ${staff.token}`);
    expect(ofColleague.status).toBe(403);
    expect(JSON.stringify(ofColleague.body)).not.toContain("30");

    const ofOwner = await request(app)
      .get(`/pay/summary?${PERIOD}&userId=${owner.user.id}`)
      .set("Authorization", `Bearer ${staff.token}`);
    expect(ofOwner.status).toBe(403);

    // a made-up id gets the same answer as a real one (no probing who exists)
    const ofNobody = await request(app)
      .get(`/pay/summary?${PERIOD}&userId=does-not-exist`)
      .set("Authorization", `Bearer ${staff.token}`);
    expect(ofNobody.status).toBe(403);
  });

  it("the owner can view a staff member's summary; an unknown or other-dealership id is a 404", async () => {
    const { owner, staff } = await setup();
    await setRate(owner.token, staff.user.id, 12.5);

    const ok = await request(app)
      .get(`/pay/summary?${PERIOD}&userId=${staff.user.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.summary.grossPay).toBe(106.25);

    const unknown = await request(app)
      .get(`/pay/summary?${PERIOD}&userId=does-not-exist`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(unknown.status).toBe(404);

    const otherDealer = await signup("pay-other-dealer-2");
    const crossTenant = await request(app)
      .get(`/pay/summary?${PERIOD}&userId=${otherDealer.user.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(crossTenant.status).toBe(404);
  });

  it("the team overview is owner-only, covers everyone including people with no rate, and stays totals-only", async () => {
    const { owner, staff, colleague } = await setup();
    await setRate(owner.token, staff.user.id, 12.5);

    expect((await request(app).get(`/pay/team-summary?${PERIOD}`).set("Authorization", `Bearer ${staff.token}`)).status).toBe(403);

    const res = await request(app).get(`/pay/team-summary?${PERIOD}`).set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.summaries).toHaveLength(3); // owner + 2 staff
    const byId = Object.fromEntries(res.body.summaries.map((s: any) => [s.userId, s]));
    expect(byId[staff.user.id].grossPay).toBe(106.25);
    expect(byId[colleague.user.id].totalHours).toBe(4);
    expect(byId[colleague.user.id].grossPay).toBeNull(); // no rate set — shown as needing one, not guessed
    expect(byId[owner.user.id].role).toBe("owner");
    expect(byId[staff.user.id].days).toBeUndefined();
  });

  it("validates the period instead of computing something silly", async () => {
    const { staff } = await setup();
    const get = (qs: string) => request(app).get(`/pay/summary?${qs}`).set("Authorization", `Bearer ${staff.token}`);
    expect((await get("")).status).toBe(400);
    expect((await get("start=2026-09-14")).status).toBe(400);
    expect((await get("start=14/09/2026&end=20/09/2026")).status).toBe(400);
    expect((await get("start=2026-02-31&end=2026-03-01")).status).toBe(400);
    expect((await get("start=2026-09-20&end=2026-09-14")).status).toBe(400);
    expect((await get("start=2020-01-01&end=2026-09-14")).status).toBe(400); // far too long
  });

  it("is behind the same login wall as everything else", async () => {
    expect((await request(app).get(`/pay/summary?${PERIOD}`)).status).toBe(401);
    expect((await request(app).get("/pay/rates")).status).toBe(401);
  });

  it("a pending (unapproved) dealership can't use it either", async () => {
    const email = `integration-test-${runId}-pay-pending@test.local`;
    const res = await request(app).post("/auth/signup").send({
      email,
      password: "integrationtestpass123",
      name: "Pending Pay",
      dealershipName: "Pending Pay Motors",
      requireApproval: true,
    });
    trackUser(email);
    trackDealership(res.body.user.dealershipId);
    const summary = await request(app).get(`/pay/summary?${PERIOD}`).set("Authorization", `Bearer ${res.body.token}`);
    expect(summary.status).toBe(403);
    expect(summary.body.approvalStatus).toBe("pending");
  });
});

// Vehicle photos: the picture is stored on the server and the vehicle only
// carries a URL. What matters here is that a photo is public only when it
// should be, can't be attached to or removed from someone else's stock,
// can't be a disguised non-image, and — the subtle one — survives a save
// from a web screen that hadn't seen it yet, without ever resurrecting a
// deleted one.
describe("vehicle photos — hosted storage", () => {
  const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
  const fakeJpeg = (length = 200) => {
    const buf = Buffer.alloc(length);
    Buffer.from(JPEG_HEAD).copy(buf);
    return buf;
  };
  const jpegDataUrl = (bytes: Buffer = fakeJpeg()) => `data:image/jpeg;base64,${bytes.toString("base64")}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const car = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    make: "Ford",
    model: "Fiesta",
    images: null,
    status: "in stock",
    priceRetail: 5000,
    ...extra,
  });

  let photoSetupCounter = 0;
  async function setup(vehicleIds: string[] = ["car-1", "car-2"]) {
    photoSetupCounter += 1;
    const owner = await signup(`photo-owner-${photoSetupCounter}`);
    const dealershipId = owner.user.dealershipId as string;
    const put = await request(app)
      .put("/inventory")
      .set(auth(owner.token))
      .send({ items: vehicleIds.map(id => car(id)) });
    expect(put.status).toBe(200);
    return { owner, dealershipId };
  }

  const upload = (token: string, vehicleId: string, dataUrl: unknown) =>
    request(app).post(`/inventory/${vehicleId}/photos`).set(auth(token)).send({ dataUrl });
  const stock = async (token: string) =>
    (await request(app).get("/inventory").set(auth(token))).body.items as any[];
  const savePut = (token: string, items: unknown[]) =>
    request(app).put("/inventory").set(auth(token)).send({ items });

  function seedPhoto(dealershipId: string, refId: string, opts: { createdAt?: string; kind?: "vehicle" | "message" } = {}) {
    const id = crypto.randomUUID();
    insertPhoto({
      id,
      dealershipId,
      kind: opts.kind ?? "vehicle",
      refId,
      uploadedBy: null,
      mime: "image/jpeg",
      size: 3,
      data: Buffer.from([0xff, 0xd8, 0xff]),
      createdAt: opts.createdAt ?? new Date().toISOString(),
    });
    return id;
  }

  it("stores an uploaded photo, adds it to the vehicle, and serves it publicly with the right headers", async () => {
    const { owner } = await setup();
    const bytes = fakeJpeg(300);
    const res = await upload(owner.token, "car-1", jpegDataUrl(bytes));
    expect(res.status).toBe(200);

    const url: string = res.body.photo.url;
    expect(url).toMatch(/\/photos\/[0-9a-f-]{36}\.jpg$/);
    expect(res.body.images).toEqual([url]);

    const items = await stock(owner.token);
    expect(items[0].images).toEqual([url]);
    expect(items[1].images).toBeNull();

    // No login: a portal or a browser showing the shop window has none.
    const img = await request(app).get(new URL(url).pathname);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/jpeg");
    expect(img.headers["cache-control"]).toContain("immutable");
    expect(img.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(Buffer.compare(img.body as Buffer, bytes)).toBe(0);
  });

  it("builds the URL from the proxy's forwarded protocol, or from PUBLIC_API_URL when that is set", async () => {
    const { owner } = await setup();
    const viaProxy = await request(app)
      .post("/inventory/car-1/photos")
      .set(auth(owner.token))
      .set("X-Forwarded-Proto", "https")
      .send({ dataUrl: jpegDataUrl() });
    expect(viaProxy.body.photo.url).toMatch(/^https:\/\//);

    process.env.PUBLIC_API_URL = "https://api.example.test/";
    try {
      const pinned = await upload(owner.token, "car-1", jpegDataUrl());
      expect(pinned.body.photo.url.startsWith("https://api.example.test/photos/")).toBe(true);
    } finally {
      delete process.env.PUBLIC_API_URL;
    }
  });

  it("refuses anything that isn't a real image, or is too big, and stores nothing", async () => {
    const { owner, dealershipId } = await setup();
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
    const html = Buffer.from("<!doctype html><script>alert(1)</script>");

    for (const bad of [
      undefined,
      "hello",
      `data:image/jpeg;base64,${svg.toString("base64")}`,
      `data:image/png;base64,${html.toString("base64")}`,
      "data:text/html;base64,PGgxPg==",
    ]) {
      expect((await upload(owner.token, "car-1", bad)).status).toBe(400);
    }
    expect((await upload(owner.token, "car-1", jpegDataUrl(fakeJpeg(1_600_000)))).status).toBe(413);

    expect(countPhotos(dealershipId, "vehicle")).toBe(0);
    expect((await stock(owner.token))[0].images).toBeNull();
  });

  it("only accepts photos for a vehicle in your own dealership", async () => {
    const a = await setup(["car-1", "a-only"]);
    const b = await setup(["car-1"]);

    expect((await upload(a.owner.token, "does-not-exist", jpegDataUrl())).status).toBe(404);

    // B guessing A's vehicle id learns nothing and changes nothing.
    expect((await upload(b.owner.token, "a-only", jpegDataUrl())).status).toBe(404);
    expect(countPhotos(a.dealershipId, "vehicle")).toBe(0);
    expect(countPhotos(b.dealershipId, "vehicle")).toBe(0);
  });

  it("needs a login, and is closed to a dealership still awaiting approval", async () => {
    expect((await request(app).post("/inventory/car-1/photos").send({ dataUrl: jpegDataUrl() })).status).toBe(401);
    expect((await request(app).delete("/inventory/car-1/photos/x")).status).toBe(401);

    const email = `integration-test-${runId}-photo-pending@test.local`;
    const signupRes = await request(app).post("/auth/signup").send({
      email,
      password: "integrationtestpass123",
      name: "Pending Photos",
      dealershipName: "Pending Photos Motors",
      requireApproval: true,
    });
    trackUser(email);
    trackDealership(signupRes.body.user.dealershipId);
    const res = await upload(signupRes.body.token, "car-1", jpegDataUrl());
    expect(res.status).toBe(403);
    expect(res.body.approvalStatus).toBe("pending");
  });

  it("caps photos per vehicle and per dealership", async () => {
    const { owner, dealershipId } = await setup();
    for (let i = 0; i < 40; i++) seedPhoto(dealershipId, "car-1");

    const full = await upload(owner.token, "car-1", jpegDataUrl());
    expect(full.status).toBe(409);
    expect(full.body.error).toContain("40");
    // ...but another vehicle is unaffected
    expect((await upload(owner.token, "car-2", jpegDataUrl())).status).toBe(200);

    // A whole-dealership ceiling protects the server's disk.
    for (let i = 0; i < 2000; i++) seedPhoto(dealershipId, `filler-${i % 100}`);
    const limit = await upload(owner.token, "car-2", jpegDataUrl());
    expect(limit.status).toBe(409);
    expect(limit.body.error).toContain("storage limit");
  });

  it("any signed-in staff member can add and remove photos, like editing stock", async () => {
    const { owner } = await setup();
    const staff = await joinStaff(owner.token, "sales");
    const up = await upload(staff.token, "car-1", jpegDataUrl());
    expect(up.status).toBe(200);
    const del = await request(app)
      .delete(`/inventory/car-1/photos/${up.body.photo.id}`)
      .set(auth(staff.token));
    expect(del.status).toBe(200);
  });

  it("a save from a web screen that hadn't seen the photo yet does not wipe it out", async () => {
    const { owner } = await setup();
    const photoId: string = (await upload(owner.token, "car-1", jpegDataUrl())).body.photo.id;

    // The web's copy predates the phone photo (images: null) and edits the price.
    const stale = await savePut(owner.token, [car("car-1", { priceRetail: 5750 }), car("car-2")]);
    expect(stale.status).toBe(200);
    const items = await stock(owner.token);
    expect(items[0].priceRetail).toBe(5750);
    // Compared by photo id: the link is rebuilt from the saving request's
    // address (supertest uses a new port per request; in real use it's the
    // same host every time).
    expect(items[0].images).toHaveLength(1);
    expect(items[0].images[0]).toContain(`/photos/${photoId}.jpg`);
  });

  it("keeps legacy inline pictures and the client's own ordering, without duplicating hosted ones", async () => {
    const { owner } = await setup();
    const first: string = (await upload(owner.token, "car-1", jpegDataUrl())).body.photo.url;
    const second: string = (await upload(owner.token, "car-1", jpegDataUrl(fakeJpeg(300)))).body.photo.url;
    const legacy = "data:image/jpeg;base64,/9j/AAAA";

    // Client reordered (second is now the cover) and holds an old inline picture.
    await savePut(owner.token, [car("car-1", { images: [second, legacy, first] }), car("car-2")]);
    expect((await stock(owner.token))[0].images).toEqual([second, legacy, first]);

    // A link to the same photo from a different address still counts as present.
    const secondId = second.match(/\/photos\/([0-9a-f-]{36})/)![1];
    const elsewhere = `https://other.example/photos/${secondId}.jpg`;
    await savePut(owner.token, [car("car-1", { images: [elsewhere, first] }), car("car-2")]);
    const images = (await stock(owner.token))[0].images as string[];
    expect(images).toHaveLength(2);
    expect(images[0]).toBe(elsewhere);
  });

  it("leaves an ordinary save alone when there are no hosted photos, and tolerates junk entries", async () => {
    const { owner } = await setup();
    const items = [car("car-1", { images: ["data:image/jpeg;base64,/9j/AAAA"] }), car("car-2")];
    const res = await savePut(owner.token, items);
    expect(res.body.items).toEqual(items);

    await upload(owner.token, "car-1", jpegDataUrl());
    const messy = await savePut(owner.token, [null, "text", 5, { note: "no id" }, car("car-1"), car("car-2")]);
    expect(messy.status).toBe(200);
  });

  it("deleting a photo removes it from the vehicle and from the public address, and a stale save can't bring it back", async () => {
    const { owner, dealershipId } = await setup();
    const up = await upload(owner.token, "car-1", jpegDataUrl());
    const { id, url } = up.body.photo as { id: string; url: string };

    const del = await request(app).delete(`/inventory/car-1/photos/${id}`).set(auth(owner.token));
    expect(del.status).toBe(200);
    expect(del.body.images).toBeNull();
    expect(countPhotos(dealershipId, "vehicle")).toBe(0);
    expect((await request(app).get(new URL(url).pathname)).status).toBe(404);
    expect((await stock(owner.token))[0].images).toBeNull();

    // A screen that loaded before the delete still holds the old link and saves it back.
    await savePut(owner.token, [car("car-1", { images: [url] }), car("car-2")]);
    expect((await stock(owner.token))[0].images).toBeNull();

    // Deleting something already gone is a clean 404.
    expect((await request(app).delete(`/inventory/car-1/photos/${id}`).set(auth(owner.token))).status).toBe(404);
  });

  it("another dealership can't delete your photo, and a wrong vehicle id doesn't match it", async () => {
    const a = await setup(["car-1", "car-2"]);
    const b = await setup(["car-1"]);
    const up = await upload(a.owner.token, "car-1", jpegDataUrl());
    const { id, url } = up.body.photo as { id: string; url: string };

    expect((await request(app).delete(`/inventory/car-1/photos/${id}`).set(auth(b.owner.token))).status).toBe(404);
    expect((await request(app).delete(`/inventory/car-2/photos/${id}`).set(auth(a.owner.token))).status).toBe(404);
    expect((await request(app).get(new URL(url).pathname)).status).toBe(200);
  });

  it("tidies up pictures whose vehicle is gone, but only old ones, and never on an empty save", async () => {
    const { owner, dealershipId } = await setup(["car-1"]);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const oldOrphan = seedPhoto(dealershipId, "gone-1", { createdAt: twoDaysAgo });
    const freshOrphan = seedPhoto(dealershipId, "gone-2");
    const oldButLive = seedPhoto(dealershipId, "car-1", { createdAt: twoDaysAgo });

    // A broken/empty save must never turn into a mass delete.
    await savePut(owner.token, []);
    expect(getPhoto(oldOrphan)).not.toBeNull();

    await savePut(owner.token, [car("car-1")]);
    expect(getPhoto(oldOrphan)).toBeNull(); // old, and its vehicle is gone
    expect(getPhoto(freshOrphan)).not.toBeNull(); // young: might just be a stale screen
    expect(getPhoto(oldButLive)).not.toBeNull(); // its vehicle still exists
  });

  it("the public address only serves listing photos, by real id, and reports the true image type", async () => {
    const { owner, dealershipId } = await setup();
    const url: string = (await upload(owner.token, "car-1", jpegDataUrl())).body.photo.url;
    const id = url.match(/\/photos\/([0-9a-f-]{36})/)![1];

    expect((await request(app).get("/photos/not-a-uuid.jpg")).status).toBe(404);
    expect((await request(app).get(`/photos/${crypto.randomUUID()}.jpg`)).status).toBe(404);

    // Whatever extension is asked for, the response says what it really is.
    const asPng = await request(app).get(`/photos/${id}.png`);
    expect(asPng.status).toBe(200);
    expect(asPng.headers["content-type"]).toBe("image/jpeg");

    // A private (message) photo must never be reachable through the public route.
    const privateId = seedPhoto(dealershipId, "some-message", { kind: "message" });
    expect((await request(app).get(`/photos/${privateId}.jpg`)).status).toBe(404);
  });

  it("closing a dealership removes its photos too", async () => {
    const { owner, dealershipId } = await setup();
    const id: string = (await upload(owner.token, "car-1", jpegDataUrl())).body.photo.id;
    expect(getPhoto(id)).not.toBeNull();
    deleteTenantData(dealershipId);
    expect(getPhoto(id)).toBeNull();
    expect(countPhotos(dealershipId, "vehicle")).toBe(0);
  });
});
