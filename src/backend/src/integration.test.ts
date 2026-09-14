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
