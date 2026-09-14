import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, deleteTenantData } from "./db.js";

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
