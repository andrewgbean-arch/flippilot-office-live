import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";

// Who may see and change what (roleAccess.ts), checked through the real
// routes with real accounts: an owner and one of each staff role, joined
// through the real invite flow.
//
// Its own private database, like brainUntrustedText.test.ts: SQLite has no
// busy timeout, so two test files writing one database file at once fail.
vi.hoisted(() => {
  const shared = process.env.DATA_DIR;
  if (!shared) throw new Error("DATA_DIR is not set — run these tests through vitest.config.ts so they use the private test database");
  process.env.DATA_DIR = `${shared}/role-gates-${process.pid}`;
});

import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, readTenantCollection, writeTenantCollection, writeTenantDoc, deleteTenantData } from "./db.js";
import { withSystemText } from "./pilotBrainPrompt.js";
import { NO_MONEY_LINE } from "./routes/pilotBrain.js";

const runId = Date.now();
const cleanupEmails: string[] = [];
const cleanupDealershipIds: string[] = [];

afterAll(() => {
  const users = readCollection<any>("users");
  writeCollection("users", users.filter(u => !cleanupEmails.includes(u.email)));
  const dealerships = readCollection<any>("dealerships");
  writeCollection("dealerships", dealerships.filter(d => !cleanupDealershipIds.includes(d.id)));
  for (const id of cleanupDealershipIds) deleteTenantData(id);
});

type Role = "sales" | "finance" | "manager" | "general";
interface Account {
  token: string;
  id: string;
  dealershipId: string;
}

async function signup(suffix: string): Promise<Account> {
  const email = `role-gates-${runId}-${suffix}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "rolegatestestpass123",
    name: `Owner ${suffix}`,
    dealershipName: `Role Gates ${suffix}`,
  });
  cleanupEmails.push(email);
  cleanupDealershipIds.push(res.body.user.dealershipId);
  return { token: res.body.token, id: res.body.user.id, dealershipId: res.body.user.dealershipId };
}

let joined = 0;
async function joinAs(owner: Account, staffRole: Role): Promise<Account> {
  joined += 1;
  const invite = await request(app)
    .post("/dealership/invite")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ inviteeName: `Staff ${joined}`, staffRole });
  const email = `role-gates-${runId}-staff-${joined}@test.local`;
  const res = await request(app).post("/auth/join").send({
    token: invite.body.token,
    name: `${staffRole} person`,
    email,
    password: "rolegatesjoinpass123",
  });
  cleanupEmails.push(email);
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, id: res.body.user.id, dealershipId: owner.dealershipId };
}

const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });

// One dealership with an owner and one of each staff role, shared by the tests.
let owner: Account;
const staff = {} as Record<Role, Account>;
beforeAll(async () => {
  owner = await signup("shop");
  for (const role of ["sales", "finance", "manager", "general"] as Role[]) staff[role] = await joinAs(owner, role);
});

const car = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  make: "Ford",
  model: "Focus",
  year: 2019,
  status: "in stock",
  priceRetail: 9995,
  priceTrade: 7200,
  buyPrice: 7000,
  purchasePrice: 7000,
  expectedSale: 9800,
  costs: ["c1"],
  createdAt: new Date().toISOString(),
  mot: { expiry: "2030-01-01", advisories: [], history: [] },
  ...extra,
});
const MONEY_FIELDS = ["buyPrice", "purchasePrice", "priceTrade", "expectedSale", "costs"];

describe("the books", () => {
  it("are read only by the owner, managers and finance", async () => {
    expect((await request(app).get("/bookkeeping").set(auth(owner))).status).toBe(200);
    expect((await request(app).get("/bookkeeping").set(auth(staff.manager))).status).toBe(200);
    expect((await request(app).get("/bookkeeping").set(auth(staff.finance))).status).toBe(200);
    expect((await request(app).get("/bookkeeping").set(auth(staff.sales))).status).toBe(403);
    expect((await request(app).get("/bookkeeping").set(auth(staff.general))).status).toBe(403);
  });
});

describe("stock", () => {
  it("is sent to everyone, but what each car cost only to the owner, managers and finance", async () => {
    writeTenantCollection(owner.dealershipId, "vehicles", [car("s1")]);
    for (const who of [staff.sales, staff.general]) {
      const got = (await request(app).get("/inventory").set(auth(who))).body.items[0];
      expect(got.priceRetail).toBe(9995);
      for (const field of MONEY_FIELDS) expect(got, field).not.toHaveProperty(field);
    }
    for (const who of [owner, staff.manager, staff.finance]) {
      const got = (await request(app).get("/inventory").set(auth(who))).body.items[0];
      expect(got.buyPrice).toBe(7000);
      expect(got.priceTrade).toBe(7200);
    }
  });

  it("keeps what a car cost when sales staff save the whole car, blank or with a made-up figure", async () => {
    writeTenantCollection(owner.dealershipId, "vehicles", [car("s2")]);
    const { buyPrice: _b, purchasePrice: _p, priceTrade: _t, expectedSale: _e, costs: _c, ...seen } = car("s2");

    const blank = await request(app).put("/inventory").set(auth(staff.sales)).send({ items: [{ ...seen, colour: "Red" }] });
    expect(blank.status).toBe(200);
    for (const field of MONEY_FIELDS) expect(blank.body.items[0], field).not.toHaveProperty(field);

    await request(app).put("/inventory").set(auth(staff.sales)).send({ items: [{ ...seen, colour: "Red", priceTrade: 1, buyPrice: 1 }] });

    const stored = readTenantCollection<any>(owner.dealershipId, "vehicles").find(v => v.id === "s2");
    expect(stored.colour).toBe("Red");
    expect(stored).toMatchObject({ buyPrice: 7000, purchasePrice: 7000, priceTrade: 7200, expectedSale: 9800, costs: ["c1"] });
  });

  it("ignores sales staff's edits to what a car cost, and keeps their other edits", async () => {
    writeTenantCollection(owner.dealershipId, "vehicles", [car("s3")]);
    const res = await request(app)
      .put("/inventory")
      .set(auth(staff.sales))
      .send({ items: [], changes: [{ id: "s3", set: { priceRetail: 9495, priceTrade: 1 }, unset: ["buyPrice", "costs"] }] });
    expect(res.status).toBe(200);
    const stored = readTenantCollection<any>(owner.dealershipId, "vehicles").find(v => v.id === "s3");
    expect(stored.priceRetail).toBe(9495);
    expect(stored).toMatchObject({ buyPrice: 7000, priceTrade: 7200, costs: ["c1"] });
  });

  it("lets a manager or finance change what a car cost", async () => {
    writeTenantCollection(owner.dealershipId, "vehicles", [car("s4")]);
    await request(app).put("/inventory").set(auth(staff.finance)).send({ items: [], changes: [{ id: "s4", set: { priceTrade: 6900 } }] });
    expect(readTenantCollection<any>(owner.dealershipId, "vehicles").find(v => v.id === "s4").priceTrade).toBe(6900);
  });

  it("keeps what sales staff type for a car they add", async () => {
    writeTenantCollection(owner.dealershipId, "vehicles", []);
    await request(app).put("/inventory").set(auth(staff.sales)).send({ items: [car("s5", { priceTrade: 5100 })] });
    expect(readTenantCollection<any>(owner.dealershipId, "vehicles").find(v => v.id === "s5").priceTrade).toBe(5100);
  });

  it("lets only the owner and managers take a car out of stock", async () => {
    writeTenantCollection(owner.dealershipId, "vehicles", [car("s6"), car("s7")]);
    for (const who of [staff.sales, staff.finance, staff.general]) {
      const res = await request(app).put("/inventory").set(auth(who)).send({ items: [], deletedIds: ["s6"] });
      expect(res.status).toBe(403);
    }
    expect(readTenantCollection<any>(owner.dealershipId, "vehicles").map(v => v.id)).toEqual(["s6", "s7"]);
    expect((await request(app).put("/inventory").set(auth(staff.manager)).send({ items: [], deletedIds: ["s6"] })).status).toBe(200);
    expect(readTenantCollection<any>(owner.dealershipId, "vehicles").map(v => v.id)).toEqual(["s7"]);
  });
});

describe("staff records", () => {
  it("show everyone the team, but NI numbers, addresses and notes only to the owner and managers", async () => {
    const record = { id: "st1", name: "Sam", role: "sales", joinedAt: "2026-01-01", active: true, nationalInsurance: "QQ123456C", address: "1 High St", notes: "private" };
    expect((await request(app).put("/staff").set(auth(owner)).send({ items: [record] })).status).toBe(200);

    for (const who of [staff.sales, staff.finance, staff.general]) {
      const got = (await request(app).get("/staff").set(auth(who))).body.items[0];
      expect(got.name).toBe("Sam");
      expect(got).not.toHaveProperty("nationalInsurance");
      expect(got).not.toHaveProperty("address");
      expect(got).not.toHaveProperty("notes");
    }
    const asManager = (await request(app).get("/staff").set(auth(staff.manager))).body.items[0];
    expect(asManager).toMatchObject({ nationalInsurance: "QQ123456C", address: "1 High St", notes: "private" });
  });
});

describe("leave", () => {
  it("shows everyone who is off, but the note on someone else's request only to them and managers", async () => {
    const leave = (id: string, userId: string, notes: string) => ({
      id, userId, userName: "x", type: "sick", startDate: "2030-02-01", endDate: "2030-02-02", status: "approved", notes,
      requestedAt: "2030-01-01T09:00:00Z", decidedAt: null, decidedByName: null,
    });
    writeTenantCollection(owner.dealershipId, "leave", [leave("l1", staff.general.id, "flu"), leave("l2", staff.sales.id, "dentist")]);

    const asSales = (await request(app).get("/leave").set(auth(staff.sales))).body.items;
    expect(asSales).toHaveLength(2);
    expect(asSales.find((l: any) => l.id === "l1")).not.toHaveProperty("notes");
    expect(asSales.find((l: any) => l.id === "l2").notes).toBe("dentist");

    const asManager = (await request(app).get("/leave").set(auth(staff.manager))).body.items;
    expect(asManager.find((l: any) => l.id === "l1").notes).toBe("flu");
  });
});

describe("clock times", () => {
  it("give the owner and managers everyone's hours, and everyone else their own plus who is in today", async () => {
    const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600000).toISOString();
    writeTenantCollection(owner.dealershipId, "timekeeping", [
      { id: "t-old-other", userId: staff.general.id, userName: "g", clockIn: at(72), clockOut: at(64) },
      { id: "t-old-mine", userId: staff.sales.id, userName: "s", clockIn: at(72), clockOut: at(64) },
      { id: "t-today-other", userId: staff.general.id, userName: "g", clockIn: at(3), clockOut: at(1) },
      { id: "t-open-other", userId: staff.finance.id, userName: "f", clockIn: at(30), clockOut: null },
    ]);
    const ids = async (who: Account) => ((await request(app).get("/timekeeping").set(auth(who))).body.items as any[]).map(e => e.id).sort();
    expect(await ids(staff.sales)).toEqual(["t-old-mine", "t-open-other", "t-today-other"]);
    expect(await ids(staff.manager)).toEqual(["t-old-mine", "t-old-other", "t-open-other", "t-today-other"]);
  });
});

describe("customers", () => {
  it("can be erased, or replaced wholesale, only by the owner and managers", async () => {
    const made = await request(app).post("/customers").set(auth(staff.sales)).send({ name: "Pat Buyer", phone: "07700 900123" });
    expect(made.status).toBe(200);
    const id = made.body.entry.id;
    expect((await request(app).delete(`/customers/${id}`).set(auth(staff.sales))).status).toBe(403);
    expect((await request(app).put("/customers").set(auth(staff.sales)).send({ items: [] })).status).toBe(403);
    expect((await request(app).get("/customers").set(auth(staff.sales))).body.items.map((c: any) => c.id)).toContain(id);
    expect((await request(app).delete(`/customers/${id}`).set(auth(staff.manager))).status).toBe(200);
  });
});

describe("notifications", () => {
  it("can only be sent to someone else by the owner and managers", async () => {
    const body = { userId: staff.general.id, title: "Rota changed", message: "See the planner" };
    expect((await request(app).post("/notifications").set(auth(staff.sales)).send(body)).status).toBe(403);
    expect((await request(app).post("/notifications").set(auth(staff.manager)).send(body)).status).toBe(200);
  });
});

describe("goals", () => {
  it("show everyone a money goal's progress, but its pounds and its label only to the owner, managers and finance", async () => {
    await request(app).post("/pilot-brain/goals").set(auth(owner)).send({ metric: "profit", targetValue: 50000, period: "monthly", label: "£50k profit" });
    await request(app).post("/pilot-brain/goals").set(auth(owner)).send({ metric: "stockCount", targetValue: 30, period: "monthly", label: "30 cars" });

    const asSales = (await request(app).get("/pilot-brain/goals").set(auth(staff.sales))).body.goals as any[];
    const profit = asSales.find(g => g.goal.metric === "profit");
    expect(profit.currentValue).toBeNull();
    expect(profit.goal.targetValue).toBeNull();
    expect(profit.goal.label).toBe("Profit goal");
    expect(typeof profit.percent).toBe("number");
    expect(JSON.stringify(asSales)).not.toContain("50k");
    expect(asSales.find(g => g.goal.metric === "stockCount").goal).toMatchObject({ targetValue: 30, label: "30 cars" });

    const asFinance = (await request(app).get("/pilot-brain/goals").set(auth(staff.finance))).body.goals as any[];
    expect(asFinance.find(g => g.goal.metric === "profit").goal).toMatchObject({ targetValue: 50000, label: "£50k profit" });

    const briefing = (await request(app).get("/pilot-brain/executive-briefing").set(auth(staff.sales))).body;
    expect(JSON.stringify(briefing.goalProgress)).not.toContain("50k");
  });

  it("runs a revenue or profit what-if only for the owner, managers and finance", async () => {
    const ask = (who: Account, metric: string) => request(app).post("/pilot-brain/scenario").set(auth(who)).send({ metric, changePercent: 10 });
    expect((await ask(staff.sales, "profit")).status).toBe(403);
    expect((await ask(staff.general, "revenue")).status).toBe(403);
    expect((await ask(staff.sales, "stockCount")).status).toBe(200);
    expect((await ask(staff.finance, "profit")).status).toBe(200);
  });
});

describe("Pilot Brain (Wendy)", () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  });
  afterAll(() => {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevKey;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Stands in for api.anthropic.com and keeps the system prompt of each call.
  function captureSystemPrompts(): string[] {
    const prompts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any, init: any) => {
        if (!String(url).includes("api.anthropic.com")) throw new Error(`unexpected fetch to ${url}`);
        prompts.push(withSystemText(JSON.parse(init.body)).system as string);
        const body = { stop_reason: "end_turn", content: [{ type: "text", text: "Understood, Boss." }] };
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
      })
    );
    return prompts;
  }

  // Every way she is asked something: chat, the morning briefing and a review.
  async function promptsFor(who: Account): Promise<string[]> {
    const prompts = captureSystemPrompts();
    await request(app).post("/pilot-brain/chat").set(auth(who)).send({ message: "How are we doing?" });
    await request(app).get("/pilot-brain/briefing").set(auth(who));
    await request(app).get("/pilot-brain/review?period=weekly").set(auth(who));
    return prompts;
  }

  beforeAll(() => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    writeTenantCollection(owner.dealershipId, "vehicles", [car("w1", { status: "sold" }), car("w2")]);
    writeTenantDoc(owner.dealershipId, "bookkeeping", {
      purchases: [{ id: "p1", vehicleId: "w1", purchasePrice: 6123, date: daysAgo(40) }],
      sales: [{ id: "x1", vehicleId: "w1", salePrice: 9877, date: daysAgo(5) }],
      costs: [{ id: "c1", vehicleId: "w1", type: "valet", amount: 111, date: daysAgo(20) }],
      transactions: [],
      suppliers: [],
      categories: [],
    });
  });

  it("is given no profit, cost, buy price or revenue figure for sales or general staff, and is told why", async () => {
    for (const who of [staff.sales, staff.general]) {
      const prompts = await promptsFor(who);
      expect(prompts).toHaveLength(3);
      for (const prompt of prompts) {
        expect(prompt).toContain(NO_MONEY_LINE);
        // the car's buy price, sale price, cost and profit, in any form
        for (const figure of ["6,123", "9,877", "3,643", "3,754", "£111"]) expect(prompt, figure).not.toContain(figure);
        expect(prompt).not.toMatch(/^Revenue: /m);
        expect(prompt).not.toMatch(/^Profit: /m);
        expect(prompt).toContain("Revenue forecast: not given to this person");
      }
    }
  });

  it("is given the money for the owner, managers and finance", async () => {
    for (const who of [owner, staff.manager, staff.finance]) {
      const [chat] = await promptsFor(who);
      expect(chat).not.toContain(NO_MONEY_LINE);
      expect(chat).toContain("bought £6,123");
      expect(chat).toMatch(/^Profit: /m);
    }
  });
});
