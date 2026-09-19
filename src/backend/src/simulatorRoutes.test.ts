import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// This file gets its OWN private database inside the run's private test folder,
// like the other route tests that write a lot. Runs before the imports below,
// because db.ts reads DATA_DIR the moment it is loaded.
vi.hoisted(() => {
  const shared = process.env.DATA_DIR;
  if (!shared) throw new Error("DATA_DIR is not set: run these tests through vitest.config.ts so they use the private test database");
  process.env.DATA_DIR = `${shared}/simulator-routes-${process.pid}`;
});

import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, writeTenantCollection, writeTenantDoc, deleteTenantData } from "./db.js";
import { createDecision, getDecision, mutateDecision, validateDraft, listDecisions } from "./decisionStore.js";
import { MAX_SIMULATIONS, type Decision } from "./decisionTypes.js";

// The Simulator's routes, at the level a real request reaches them: who may call
// them, what they refuse, that a simulation never writes anything to the business,
// and the rules for attaching one to a decision. Owners and managers only: the
// Pilot Brain roadmap's rule 2. No outside service is involved (a simulation is
// arithmetic on the dealership's own records), so nothing here is stubbed.

const runId = Date.now();
const cleanupEmails: string[] = [];
const cleanupDealershipIds: string[] = [];
const DAY = 86400000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

afterAll(() => {
  try {
    const users = readCollection<any>("users");
    writeCollection("users", users.filter(u => !cleanupEmails.includes(u.email)));
    const dealerships = readCollection<any>("dealerships");
    writeCollection("dealerships", dealerships.filter(d => !cleanupDealershipIds.includes(d.id)));
    for (const id of cleanupDealershipIds) deleteTenantData(id);
  } catch (err) {
    console.error("simulatorRoutes cleanup failed:", err);
  }
});

async function signup(suffix: string) {
  const email = `simulator-routes-${runId}-${suffix}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "integrationtestpass123",
    name: `Sim Test ${suffix}`,
    dealershipName: `Sim Test Dealership ${suffix}`,
  });
  cleanupEmails.push(email);
  cleanupDealershipIds.push(res.body.user.dealershipId);
  return { token: res.body.token as string, user: res.body.user, dealershipId: res.body.user.dealershipId as string };
}

let joinCounter = 0;
async function joinStaff(ownerToken: string, staffRole: "sales" | "finance" | "manager" | "general") {
  joinCounter += 1;
  const invite = await request(app).post("/dealership/invite").set("Authorization", `Bearer ${ownerToken}`).send({ inviteeName: "Sim Staff", staffRole });
  const email = `simulator-routes-${runId}-staff-${joinCounter}@test.local`;
  const joined = await request(app).post("/auth/join").send({ token: invite.body.token, name: `Sim Staff ${staffRole}`, email, password: "joinedtestpass123" });
  cleanupEmails.push(email);
  if (!joined.body.token) throw new Error(`joinStaff failed: ${JSON.stringify(joined.body)}`);
  return { token: joined.body.token as string, user: joined.body.user };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const run = (token: string, body: unknown) => request(app).post("/pilot-brain/simulator/run").set(auth(token)).send(body as object);
const attach = (token: string, decisionId: string, body: unknown) =>
  request(app).post(`/pilot-brain/decisions/${decisionId}/simulations`).set(auth(token)).send(body as object);

const STOCK = { kind: "stock_investment", params: { amountGbp: 40000 } };
const CUT = { kind: "price_cut_aged_stock", params: {} };

/* ------------------------------------------------------------------ */
/* A second look at the whole database, to prove what did not change    */
/* ------------------------------------------------------------------ */

// A separate read-only connection to the same test database file, so that a
// route cannot hide a write from the check: this reads every row the dealership
// has, whatever the route was supposed to touch, plus the shared users and
// dealerships tables and the photo count.
let raw: DatabaseSync;
beforeAll(() => {
  raw = new DatabaseSync(path.join(process.env.DATA_DIR!, "app.db"), { readOnly: true });
});
afterAll(() => {
  raw?.close();
});

interface Dump {
  tenant: Record<string, string>;
  global: Record<string, string>;
  photos: number;
}
function dump(dealershipId: string): Dump {
  const tenant: Record<string, string> = {};
  for (const row of raw.prepare("SELECT collection, data FROM tenant_data WHERE dealership_id = ? ORDER BY collection").all(dealershipId) as { collection: string; data: string }[]) {
    tenant[row.collection] = row.data;
  }
  const global: Record<string, string> = {};
  for (const row of raw.prepare("SELECT collection, data FROM global_data ORDER BY collection").all() as { collection: string; data: string }[]) {
    global[row.collection] = row.data;
  }
  const photos = (raw.prepare("SELECT COUNT(*) AS n FROM photos WHERE dealership_id = ?").get(dealershipId) as { n: number }).n;
  return { tenant, global, photos };
}
// The names of every tenant collection that is different (added, removed or changed).
function changed(before: Dump, after: Dump): string[] {
  const names = new Set([...Object.keys(before.tenant), ...Object.keys(after.tenant)]);
  return [...names].filter(n => before.tenant[n] !== after.tenant[n]).sort();
}

/* ------------------------------------------------------------------ */
/* A dealership with something to simulate                              */
/* ------------------------------------------------------------------ */
//
// Dates are relative to today (the routes read the real clock), and kept well
// away from the 60 and 90 day lines so a test cannot flake at midnight.
//   8 cars sold in the last 90 days, each bought for £8,000, sold for £10,000, £500 of costs:
//     profit £1,500 a car, known for all 8; 8 / 3 months = 2.67 sales a month.
//   8 cars in stock: aged 5, 20, 40, 75, 100, 130 and 200 days by purchase date, and one
//     with no ledger entry added 90 days ago. So 5 cars are 60 days or more.
// £40,000 into stock: 5 extra cars; 5 x ((8/3) / 8) = 1.67 extra sales a month; profit
//   1.67 x 1,500 = £2,500 a month; payback 40,000 / 2,500 = 16 months.
// Default price cut (£500 off cars of 60+ days): given up 5 x 500 = £2,500; profit after
//   the cut 1,500 - 500 = £1,000; break-even 2,500 / 1,000 = 2.5 extra cars.
function seedDealership(dealershipId: string) {
  const vehicles: unknown[] = [];
  const purchases: unknown[] = [];
  const sales: unknown[] = [];
  const costs: unknown[] = [];
  for (let i = 0; i < 8; i++) {
    const id = `sold${i}`;
    vehicles.push({ id, make: "Ford", model: "Fiesta", status: "sold", createdAt: new Date(Date.now() - 120 * DAY).toISOString() });
    purchases.push({ vehicleId: id, purchasePrice: 8000, date: daysAgo(70 + i) });
    sales.push({ vehicleId: id, salePrice: 10000, date: daysAgo(10 + i * 6) });
    costs.push({ vehicleId: id, amount: 500, date: daysAgo(60) });
  }
  [5, 20, 40, 75, 100, 130, 200].forEach((age, i) => {
    vehicles.push({ id: `k${i}`, make: "BMW", model: "3 Series", status: "in stock", createdAt: new Date().toISOString() });
    purchases.push({ vehicleId: `k${i}`, purchasePrice: 9000, date: daysAgo(age) });
  });
  vehicles.push({ id: "k7", make: "Audi", model: "A3", status: "in stock", createdAt: new Date(Date.now() - 90 * DAY).toISOString() });

  writeTenantCollection(dealershipId, "vehicles", vehicles);
  writeTenantDoc(dealershipId, "bookkeeping", { purchases, sales, costs, transactions: [{ id: "t1", type: "income", category: "x", amount: 5, date: daysAgo(3) }] });
  writeTenantCollection(dealershipId, "leads", [
    { id: "l1", name: "A Lead", source: "AutoTrader", status: "won", createdAt: new Date(Date.now() - 20 * DAY).toISOString() },
    { id: "l2", name: "B Lead", source: "Website", status: "new", createdAt: new Date(Date.now() - 5 * DAY).toISOString() },
  ]);
  // other parts of the business, so "nothing else changed" has real content to compare
  writeTenantCollection(dealershipId, "appointments", [{ id: "a1", status: "pending", createdAt: new Date().toISOString() }]);
  writeTenantCollection(dealershipId, "jobs", [{ id: "j1", title: "MOT", status: "todo", priority: "low", createdAt: new Date().toISOString() }]);
  writeTenantCollection(dealershipId, "staff", [{ id: "st1", name: "Pat" }]);
  writeTenantCollection(dealershipId, "contacts", [{ id: "c1", name: "Supplier" }]);
  writeTenantCollection(dealershipId, "consumables", [{ id: "cn1", name: "Oil", quantity: 4 }]);
  writeTenantDoc(dealershipId, "pilotBrainSecurity", { events: [], blocked: 0 });
}

function newDecision(dealershipId: string, actor = { id: "u-test", name: "Test Owner" }): Decision {
  const v = validateDraft({ question: "Put more money into SUVs?", context: "Enquiries are up.", options: ["No change", "Add £40k"] });
  if (!v.ok) throw new Error(v.error);
  const made = createDecision(dealershipId, v.draft, actor);
  if (!made.ok) throw new Error(made.error);
  return made.decision;
}

const decide = (dealershipId: string, id: string) =>
  mutateDecision(dealershipId, id, { id: "u-test", name: "Test Owner" }, "decided", d => {
    d.bossDecision = { optionKey: "a", reasoning: "Held off.", decidedAt: new Date().toISOString(), decidedByUserId: "u-test", decidedByName: "Test Owner" };
  });

let owner: Awaited<ReturnType<typeof signup>>;
let other: Awaited<ReturnType<typeof signup>>;
let manager: Awaited<ReturnType<typeof joinStaff>>;
const lowRoles = {} as Record<"sales" | "finance" | "general", Awaited<ReturnType<typeof joinStaff>>>;

beforeAll(async () => {
  owner = await signup("owner");
  other = await signup("other");
  manager = await joinStaff(owner.token, "manager");
  for (const role of ["sales", "finance", "general"] as const) lowRoles[role] = await joinStaff(owner.token, role);
  seedDealership(owner.dealershipId);
});

/* ------------------------------------------------------------------ */
/* Who may use it                                                       */
/* ------------------------------------------------------------------ */

describe("only owners and managers can use the Simulator", () => {
  it("turns away a request with no login", async () => {
    expect((await request(app).post("/pilot-brain/simulator/run").send(STOCK)).status).toBe(401);
    expect((await request(app).post("/pilot-brain/decisions/x/simulations").send(STOCK)).status).toBe(401);
  });

  it.each(["sales", "finance", "general"] as const)("says no to a %s account on both routes, and changes nothing", async role => {
    const decision = newDecision(owner.dealershipId);
    const before = dump(owner.dealershipId);
    const r1 = await run(lowRoles[role].token, STOCK);
    expect(r1.status).toBe(403);
    expect(r1.body.ok).toBe(false);
    expect(r1.body.error).toContain("doesn't have access");
    expect(r1.body.simulation).toBeUndefined();
    const r2 = await attach(lowRoles[role].token, decision.id, STOCK);
    expect(r2.status).toBe(403);
    expect(r2.body.decision).toBeUndefined();
    expect(dump(owner.dealershipId)).toEqual(before);
    expect(getDecision(owner.dealershipId, decision.id)!.simulations).toEqual([]);
  });

  it("lets a manager run one and attach one", async () => {
    const decision = newDecision(owner.dealershipId);
    expect((await run(manager.token, STOCK)).status).toBe(200);
    const attached = await attach(manager.token, decision.id, STOCK);
    expect(attached.status).toBe(201);
    expect(attached.body.decision.simulations).toHaveLength(1);
  });

  it("lets the owner run one and attach one", async () => {
    const decision = newDecision(owner.dealershipId);
    expect((await run(owner.token, CUT)).status).toBe(200);
    expect((await attach(owner.token, decision.id, CUT)).status).toBe(201);
  });
});

/* ------------------------------------------------------------------ */
/* What it refuses                                                      */
/* ------------------------------------------------------------------ */

describe("the routes refuse anything that is not a real, in-range number, in plain words", () => {
  const bad: [string, unknown, string][] = [
    ["no body at all", {}, "Choose a simulation"],
    ["an unknown kind", { kind: "buy_a_shop", params: {} }, "not available"],
    ["a stock amount of nothing", { kind: "stock_investment", params: {} }, "How much would you put into stock"],
    ["a stock amount as text", { kind: "stock_investment", params: { amountGbp: "50000" } }, "How much would you put into stock"],
    ["a stock amount of 0", { kind: "stock_investment", params: { amountGbp: 0 } }, "How much would you put into stock"],
    ["a stock amount over a million", { kind: "stock_investment", params: { amountGbp: 1000001 } }, "£1,000,000"],
    ["a null amount", { kind: "stock_investment", params: { amountGbp: null } }, "How much would you put into stock"],
    ["a cut of -1", { kind: "price_cut_aged_stock", params: { cutGbp: -1 } }, "The price cut"],
    ["a cut over £10,000", { kind: "price_cut_aged_stock", params: { cutGbp: 10001 } }, "The price cut"],
    ["6 days", { kind: "price_cut_aged_stock", params: { daysThreshold: 6 } }, "Days in stock"],
    ["366 days", { kind: "price_cut_aged_stock", params: { daysThreshold: 366 } }, "Days in stock"],
    ["-1 extra sales", { kind: "price_cut_aged_stock", params: { extraSalesFromCut: -1 } }, "Extra cars sold by the cut"],
    ["501 extra sales", { kind: "price_cut_aged_stock", params: { extraSalesFromCut: 501 } }, "Extra cars sold by the cut"],
    ["params that are a list", { kind: "price_cut_aged_stock", params: [1, 2] }, "must be sent as an object"],
  ];

  it.each(bad)("run: %s", async (_name, body, message) => {
    const res = await run(owner.token, body);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain(message);
    expect(res.body.simulation).toBeUndefined();
  });

  it.each(bad)("attach: %s", async (_name, body, message) => {
    const decision = newDecision(owner.dealershipId);
    const res = await attach(owner.token, decision.id, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain(message);
    expect(getDecision(owner.dealershipId, decision.id)!.simulations).toEqual([]);
  });

  it("accepts every number right on its limit", async () => {
    for (const body of [
      { kind: "stock_investment", params: { amountGbp: 1 } },
      { kind: "stock_investment", params: { amountGbp: 1000000 } },
      { kind: "price_cut_aged_stock", params: { cutGbp: 0, daysThreshold: 7, extraSalesFromCut: 0 } },
      { kind: "price_cut_aged_stock", params: { cutGbp: 10000, daysThreshold: 365, extraSalesFromCut: 500 } },
    ]) {
      const res = await run(owner.token, body);
      expect(res.status, JSON.stringify(body)).toBe(200);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Running one                                                          */
/* ------------------------------------------------------------------ */

describe("running a simulation", () => {
  it("returns the result, labelled as a simulation, with its assumptions and a confidence that is a word", async () => {
    const res = await run(owner.token, STOCK);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const sim = res.body.simulation;
    expect(sim.kind).toBe("stock_investment");
    expect(sim.title).toBe("Put £40,000 into stock");
    expect(sim.note).toBe("Simulation, not a forecast: arithmetic on your own recent history and the assumptions listed. Change an assumption and the answer changes.");
    expect(sim.id).toBeUndefined(); // nothing is saved, so nothing has an id yet
    expect(sim.confidence).toBe("medium");
    expect(sim.confidenceReasons.join(" ")).toContain("does not earn HIGH confidence");
    expect(sim.assumptions.map((a: any) => a.key)).toContain("amount");
    const rise = sim.scenarios.find((s: any) => s.key === "add_sales_rise");
    const payback = rise.figures.find((f: any) => f.label === "Months to earn the extra money back");
    expect(payback).toMatchObject({ value: 16, unit: "months", kind: "predicted" });
    expect(rise.figures.find((f: any) => f.label === "Extra cars bought").value).toBe(5);
  });

  it("works the price cut out from the dealership's own stock and ledger", async () => {
    const res = await run(owner.token, CUT);
    const cut = res.body.simulation.scenarios.find((s: any) => s.key === "cut");
    const get = (label: string) => cut.figures.find((f: any) => f.label === label);
    expect(get("Aged cars in stock").value).toBe(5);
    expect(get("Margin given up")).toMatchObject({ value: 2500, kind: "known" });
    expect(get("Average profit per car").value).toBe(1000);
    expect(get("Extra cars needed to pay for the cut").value).toBe(2.5);
    expect(get("Extra cars the cut would sell")).toMatchObject({ value: null, kind: "unknown" });
  });

  it("uses only the caller's own dealership: another dealership with no records gets unknowns, not these numbers", async () => {
    const res = await run(other.token, STOCK);
    expect(res.status).toBe(200);
    const rise = res.body.simulation.scenarios.find((s: any) => s.key === "add_sales_rise");
    expect(rise.figures.find((f: any) => f.label === "Extra cars bought")).toMatchObject({ value: null, kind: "unknown" });
    expect(res.body.simulation.confidence).toBe("low");
  });

  it("writes NOTHING to the business: every collection, the users, the dealerships and the photos are the same afterwards", async () => {
    const before = dump(owner.dealershipId);
    // it really is a busy dealership, not an empty one that trivially "did not change"
    for (const name of ["vehicles", "leads", "bookkeeping", "appointments", "jobs", "staff", "contacts", "consumables", "pilotBrainSecurity"]) {
      expect(before.tenant[name], name).toBeDefined();
    }
    expect(Object.keys(before.global)).toEqual(expect.arrayContaining(["users", "dealerships"]));

    for (const body of [
      STOCK,
      CUT,
      { kind: "price_cut_aged_stock", params: { daysThreshold: 30, cutGbp: 250, extraSalesFromCut: 4 } },
      { kind: "stock_investment", params: { amountGbp: 1000000 } },
    ]) {
      expect((await run(owner.token, body)).status).toBe(200);
    }
    const after = dump(owner.dealershipId);
    expect(changed(before, after)).toEqual([]);
    expect(after).toEqual(before);
    expect(after.tenant["pilotBrainDecisions"] ?? "[]").toBe(before.tenant["pilotBrainDecisions"] ?? "[]"); // it did not even create the decisions collection
  });

  it("does not write when a request is refused either", async () => {
    const before = dump(owner.dealershipId);
    expect((await run(owner.token, { kind: "stock_investment", params: { amountGbp: -5 } })).status).toBe(400);
    expect(dump(owner.dealershipId)).toEqual(before);
  });
});

/* ------------------------------------------------------------------ */
/* Attaching one to a decision                                          */
/* ------------------------------------------------------------------ */

describe("attaching a simulation to a decision", () => {
  it("adds the snapshot and an event, and touches nothing else in the business", async () => {
    const decision = newDecision(owner.dealershipId);
    const before = dump(owner.dealershipId);
    const res = await attach(owner.token, decision.id, STOCK);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const stored = getDecision(owner.dealershipId, decision.id)!;
    expect(stored.simulations).toHaveLength(1);
    const snap = stored.simulations[0]!;
    expect(snap.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(snap.kind).toBe("stock_investment");
    expect(snap.title).toBe("Put £40,000 into stock");
    expect(snap.scenarios.map(s => s.key)).toEqual(["keep", "add_sales_flat", "add_sales_rise"]);
    expect(snap.confidence).toBe("medium");
    expect(res.body.simulation).toEqual(snap); // what came back is what was saved
    expect(res.body.decision).toEqual(stored);

    // the record explains itself: who added it and what it was
    const event = stored.events.at(-1)!;
    expect(event).toMatchObject({ action: "simulation", byUserId: owner.user.id, byName: owner.user.name, note: "Simulation added: Put £40,000 into stock" });
    expect(stored.events).toHaveLength(2);
    expect(stored.updatedAt >= decision.updatedAt).toBe(true);
    // everything else on the decision is as it was
    expect({ ...stored, simulations: [], events: [], updatedAt: "" }).toEqual({ ...decision, simulations: [], events: [], updatedAt: "" });

    // and the only collection that changed anywhere is the decisions themselves
    expect(changed(before, dump(owner.dealershipId))).toEqual(["pilotBrainDecisions"]);
    expect(dump(owner.dealershipId).global).toEqual(before.global);
  });

  it("works the simulation out itself, from the numbers only: a snapshot, confidence or id in the request is ignored", async () => {
    const decision = newDecision(owner.dealershipId);
    const forged = {
      id: "forged-id",
      ranAt: "1999-01-01T00:00:00.000Z",
      kind: "stock_investment",
      title: "FORGED TITLE",
      assumptions: [],
      scenarios: [{ key: "keep", label: "FORGED", figures: [{ label: "FORGED", value: 1e9, unit: "gbp", kind: "known", basis: "FORGED" }] }],
      confidence: "high",
      confidenceReasons: ["FORGED"],
      note: "FORGED",
    };
    const res = await attach(owner.token, decision.id, { ...STOCK, snapshot: forged, simulation: forged, confidence: "high", confidenceReasons: ["FORGED"], id: "forged-id" });
    expect(res.status).toBe(201);
    const snap = getDecision(owner.dealershipId, decision.id)!.simulations[0]!;
    expect(JSON.stringify(getDecision(owner.dealershipId, decision.id))).not.toContain("FORGED");
    expect(snap.id).not.toBe("forged-id");
    expect(snap.confidence).toBe("medium");
    expect(snap.ranAt.startsWith("1999")).toBe(false);
    const rise = snap.scenarios.find(s => s.key === "add_sales_rise")!;
    expect(rise.figures.find(f => f.label === "Months to earn the extra money back")!.value).toBe(16);
  });

  it("gives the same answer as running it without saving", async () => {
    const decision = newDecision(owner.dealershipId);
    const ran = (await run(owner.token, CUT)).body.simulation;
    const kept = (await attach(owner.token, decision.id, CUT)).body.simulation;
    const { id: _id, ranAt: _a, ...keptRest } = kept;
    const { ranAt: _b, ...ranRest } = ran;
    expect(keptRest).toEqual(ranRest);
  });

  it(`holds at most ${MAX_SIMULATIONS} simulations, and refuses the next one without changing anything`, async () => {
    const decision = newDecision(owner.dealershipId);
    for (let i = 0; i < MAX_SIMULATIONS; i++) {
      const res = await attach(owner.token, decision.id, { kind: "stock_investment", params: { amountGbp: 10000 * (i + 1) } });
      expect(res.status, `simulation ${i + 1}`).toBe(201);
    }
    const before = dump(owner.dealershipId);
    const over = await attach(owner.token, decision.id, STOCK);
    expect(over.status).toBe(409);
    expect(over.body.ok).toBe(false);
    expect(over.body.error).toContain(`at most ${MAX_SIMULATIONS} simulations`);
    expect(dump(owner.dealershipId)).toEqual(before);
    const stored = getDecision(owner.dealershipId, decision.id)!;
    expect(stored.simulations).toHaveLength(MAX_SIMULATIONS);
    expect(stored.events.filter(e => e.action === "simulation")).toHaveLength(MAX_SIMULATIONS);
    // running one WITHOUT saving is still fine
    expect((await run(owner.token, STOCK)).status).toBe(200);
  });

  it("only while the decision is open: once Boss has decided, a simulation cannot be added", async () => {
    const decision = newDecision(owner.dealershipId);
    expect((await attach(owner.token, decision.id, STOCK)).status).toBe(201);
    expect(decide(owner.dealershipId, decision.id).ok).toBe(true);
    const before = dump(owner.dealershipId);
    const res = await attach(owner.token, decision.id, CUT);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("already been made");
    expect(dump(owner.dealershipId)).toEqual(before);
    const stored = getDecision(owner.dealershipId, decision.id)!;
    expect(stored.simulations).toHaveLength(1); // the one saved while it was open is untouched
    expect(stored.bossDecision?.optionKey).toBe("a");
  });

  it("nor once an outcome has been recorded", async () => {
    const decision = newDecision(owner.dealershipId);
    mutateDecision(owner.dealershipId, decision.id, { id: "u", name: "n" }, "outcome", d => {
      d.outcome = { recordedAt: new Date().toISOString(), recordedByUserId: "u", recordedByName: "n", actuals: [], notes: "", lessons: { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" } };
    });
    const res = await attach(owner.token, decision.id, STOCK);
    expect(res.status).toBe(409);
    expect(getDecision(owner.dealershipId, decision.id)!.simulations).toEqual([]);
  });

  it("says a decision that does not exist was not found, and writes nothing", async () => {
    const before = dump(owner.dealershipId);
    const res = await attach(owner.token, "no-such-decision", STOCK);
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(dump(owner.dealershipId)).toEqual(before);
  });

  it("never reaches another dealership's decision", async () => {
    const mine = newDecision(owner.dealershipId);
    const before = dump(owner.dealershipId);
    const res = await attach(other.token, mine.id, STOCK);
    expect(res.status).toBe(404);
    expect(dump(owner.dealershipId)).toEqual(before);
    expect(listDecisions(other.dealershipId)).toEqual([]);
  });
});
