import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, deleteTenantData } from "./db.js";

// The routes that REPLACE a dealership's whole list (or the whole ledger)
// with what the request holds. They used to turn a missing or wrongly-typed
// body into [] and write it, answering 200: one broken request (a client
// bug, an old tab sending the wrong field, a body the JSON parser skipped)
// erased the dealer's real records. A replace is only safe when the caller
// really sent a list, so anything else must be a 400 that writes nothing,
// while a genuinely empty list stays valid.
//
// Table-driven: every route below gets every bad payload, and after each
// one the stored data must be exactly what it was before.

const runId = Date.now();
const cleanupEmails: string[] = [];
const cleanupDealershipIds: string[] = [];

afterAll(() => {
  try {
    const users = readCollection<any>("users");
    writeCollection("users", users.filter(u => !cleanupEmails.includes(u.email)));
    const dealerships = readCollection<any>("dealerships");
    writeCollection("dealerships", dealerships.filter(d => !cleanupDealershipIds.includes(d.id)));
    for (const id of cleanupDealershipIds) deleteTenantData(id);
  } catch (err) {
    console.error("Whole-list guard test cleanup failed:", err);
  }
});

async function signup(suffix: string) {
  const email = `whole-list-guard-${runId}-${suffix}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "wholelistguardpass123",
    name: `Whole List ${suffix}`,
    dealershipName: `Whole List Dealership ${suffix}`,
  });
  cleanupEmails.push(email);
  cleanupDealershipIds.push(res.body.user.dealershipId);
  return { token: res.body.token as string };
}

async function joinStaff(ownerToken: string, staffRole: "sales" | "finance" | "manager" | "general") {
  const inviteRes = await request(app)
    .post("/dealership/invite")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ inviteeName: "Joined Tester", staffRole });
  const email = `whole-list-guard-${runId}-joined-${staffRole}@test.local`;
  const joinRes = await request(app).post("/auth/join").send({
    token: inviteRes.body.token,
    name: "Joined Tester",
    email,
    password: "joinedguardpass123",
  });
  cleanupEmails.push(email);
  if (!joinRes.body.token) throw new Error(`joinStaff failed: ${JSON.stringify(joinRes.body)}`);
  return joinRes.body.token as string;
}

let ownerToken = "";
let salesToken = "";

beforeAll(async () => {
  ownerToken = (await signup("owner")).token;
  salesToken = await joinStaff(ownerToken, "sales");
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

type Attempt = { send: (req: request.Test) => request.Test };

// Every way a whole-list body can be wrong. Names read as behaviours.
const BAD_BODIES: [string, Attempt][] = [
  ["an empty object", { send: r => r.send({}) }],
  ["a body without an items field", { send: r => r.send({ list: [] }) }],
  ["items set to null", { send: r => r.send({ items: null }) }],
  ["items sent as text", { send: r => r.send({ items: "[]" }) }],
  ["items sent as an object", { send: r => r.send({ items: {} }) }],
  ["items sent as a number", { send: r => r.send({ items: 0 }) }],
  ["a list containing null", { send: r => r.send({ items: [null] }) }],
  ["a list containing text", { send: r => r.send({ items: ["oops"] }) }],
  ["a list containing a nested list", { send: r => r.send({ items: [[]] }) }],
  ["a bare array instead of an object", { send: r => r.send([]) }],
  [
    "valid JSON sent as text/plain, which the JSON parser skips",
    { send: r => r.set("Content-Type", "text/plain").send(JSON.stringify({ items: [] })) },
  ],
  ["malformed JSON", { send: r => r.set("Content-Type", "application/json").send('{"items": [') }],
  ["no body at all", { send: r => r }],
];

interface ListRoute {
  path: string;
  // A record that looks like the real thing for this collection.
  record: Record<string, unknown>;
  // Set when writing needs a manager (or finance) account, so an owner is used
  // and a sales account must be turned away with 403 before any body check.
  gated: boolean;
}

const stamp = new Date().toISOString();
const LIST_ROUTES: ListRoute[] = [
  { path: "/leads", gated: false, record: { id: "lead-1", name: "Sam Buyer", source: "web", createdAt: stamp } },
  {
    path: "/jobs",
    gated: false,
    record: { id: "job-1", title: "Book MOT", status: "todo", priority: "high", createdAt: stamp, createdByName: "Tester" },
  },
  { path: "/staff", gated: true, record: { id: "staff-1", name: "Alex Mechanic", role: "Technician" } },
  { path: "/contacts", gated: false, record: { id: "contact-1", name: "Parts R Us", category: "parts_supplier", updatedAt: stamp } },
  {
    path: "/consumables",
    gated: false,
    record: { id: "cons-1", name: "Screen wash", currentStock: 4, reorderThreshold: 2, updatedAt: stamp },
  },
  {
    path: "/customers",
    gated: false,
    record: {
      id: "cust-1",
      name: "Pat Customer",
      emailConsent: { status: "not_asked" },
      whatsappConsent: { status: "not_asked" },
      createdAt: stamp,
      createdByName: "Tester",
      updatedAt: stamp,
    },
  },
  {
    path: "/work-patterns",
    gated: true,
    record: {
      userId: "u1",
      userName: "Full Timer",
      employmentType: "full_time",
      targetWeeklyHours: 40,
      availableDays: ["mon", "tue"],
      holidayEntitlementDays: 28,
    },
  },
  {
    path: "/shifts",
    gated: true,
    record: {
      id: "shift-1",
      userId: "u1",
      userName: "Full Timer",
      date: "2030-01-07",
      start: "09:00",
      end: "17:00",
      autoGenerated: false,
      createdAt: stamp,
    },
  },
];

describe.each(LIST_ROUTES)("PUT $path replaces a whole list, so it refuses anything that is not a list", route => {
  async function seed() {
    const res = await request(app).put(route.path).set(auth(ownerToken)).send({ items: [route.record] });
    expect(res.status).toBe(200);
  }
  async function stored() {
    const res = await request(app).get(route.path).set(auth(ownerToken));
    expect(res.status).toBe(200);
    return res.body.items as unknown[];
  }

  it.each(BAD_BODIES)("answers 400 and keeps the stored records when it gets %s", async (_name, attempt) => {
    await seed();
    const res = await attempt.send(request(app).put(route.path).set(auth(ownerToken)));
    expect(res.status).toBe(400);
    expect(await stored()).toEqual([route.record]);
  });

  it("names the problem in the 400 body", async () => {
    await seed();
    const res = await request(app).put(route.path).set(auth(ownerToken)).send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(typeof res.body.error).toBe("string");
  });

  it("still accepts a genuinely empty list and stores it", async () => {
    await seed();
    const res = await request(app).put(route.path).set(auth(ownerToken)).send({ items: [] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, items: [] });
    expect(await stored()).toEqual([]);
  });

  it("still accepts a real list, echoes it back and stores it", async () => {
    const second = { ...route.record, ...(route.record.id ? { id: `${route.record.id}-b` } : { userId: "u2" }) };
    const res = await request(app).put(route.path).set(auth(ownerToken)).send({ items: [route.record, second] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, items: [route.record, second] });
    expect(await stored()).toEqual([route.record, second]);
  });

  if (route.gated) {
    it("still turns a sales account away with 403 (the role check runs before the body check)", async () => {
      await seed();
      const badBody = await request(app).put(route.path).set(auth(salesToken)).send({});
      expect(badBody.status).toBe(403);
      const goodBody = await request(app).put(route.path).set(auth(salesToken)).send({ items: [] });
      expect(goodBody.status).toBe(403);
      expect(await stored()).toEqual([route.record]);
    });
  }
});

describe("PUT /bookkeeping replaces the whole ledger, so it refuses anything that is not a whole ledger", () => {
  const LEDGER = {
    costs: [{ id: "cost-1", vehicleId: "car-1", amount: 120, date: "2030-01-05" }],
    purchases: [{ id: "purchase-1", vehicleId: "car-1", purchasePrice: 4000, date: "2030-01-01" }],
    sales: [{ id: "sale-1", vehicleId: "car-1", salePrice: 5200, date: "2030-02-01" }],
    transactions: [{ id: "tx-1", amount: 5200 }],
    suppliers: [{ id: "sup-1", name: "Auction House" }],
    categories: [{ id: "cat-1", name: "Parts" }],
  };
  const EMPTY_LEDGER = { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] };

  async function seed() {
    const res = await request(app).put("/bookkeeping").set(auth(ownerToken)).send(LEDGER);
    expect(res.status).toBe(200);
  }
  async function stored() {
    const res = await request(app).get("/bookkeeping").set(auth(ownerToken));
    expect(res.status).toBe(200);
    const { ok: _ok, ...doc } = res.body;
    return doc;
  }

  const BAD_LEDGERS: [string, Attempt][] = [
    ...BAD_BODIES.filter(([name]) => name !== "a body without an items field" && !name.startsWith("items ") && !name.startsWith("a list")),
    ["a body with only one of the six lists", { send: r => r.send({ costs: [LEDGER.costs[0]] }) }],
    ["a ledger missing categories", { send: r => r.send({ ...LEDGER, categories: undefined }) }],
    ["a ledger missing costs", { send: r => r.send({ ...LEDGER, costs: undefined }) }],
    ["a ledger with costs set to null", { send: r => r.send({ ...LEDGER, costs: null }) }],
    ["a ledger with sales sent as text", { send: r => r.send({ ...LEDGER, sales: "none" }) }],
    ["a ledger with purchases sent as an object", { send: r => r.send({ ...LEDGER, purchases: {} }) }],
    ["a ledger with a null cost in it", { send: r => r.send({ ...LEDGER, costs: [null] }) }],
    ["a ledger with a text supplier in it", { send: r => r.send({ ...LEDGER, suppliers: ["Auction House"] }) }],
    ["the old { items: [] } shape", { send: r => r.send({ items: [] }) }],
  ];

  it.each(BAD_LEDGERS)("answers 400 and keeps the stored ledger when it gets %s", async (_name, attempt) => {
    await seed();
    const res = await attempt.send(request(app).put("/bookkeeping").set(auth(ownerToken)));
    expect(res.status).toBe(400);
    expect(await stored()).toEqual(LEDGER);
  });

  it("names the problem in the 400 body", async () => {
    await seed();
    const res = await request(app).put("/bookkeeping").set(auth(ownerToken)).send({ costs: [] });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(typeof res.body.error).toBe("string");
  });

  it("still accepts a ledger where every list is genuinely empty and stores it", async () => {
    await seed();
    const res = await request(app).put("/bookkeeping").set(auth(ownerToken)).send(EMPTY_LEDGER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ...EMPTY_LEDGER });
    expect(await stored()).toEqual(EMPTY_LEDGER);
  });

  it("still accepts a full ledger, echoes it back and stores it", async () => {
    const changed = { ...LEDGER, costs: [...LEDGER.costs, { id: "cost-2", vehicleId: "car-1", amount: 30, date: "2030-01-06" }] };
    const res = await request(app).put("/bookkeeping").set(auth(ownerToken)).send(changed);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ...changed });
    expect(await stored()).toEqual(changed);
  });

  it("still turns a sales account away with 403 (the role check runs before the body check)", async () => {
    await seed();
    const badBody = await request(app).put("/bookkeeping").set(auth(salesToken)).send({});
    expect(badBody.status).toBe(403);
    expect(await stored()).toEqual(LEDGER);
  });
});
