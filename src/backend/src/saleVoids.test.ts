import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Voided sales (saleVoids.ts): left out of every Pilot Brain figure, and voiding is
// one way, so an out-of-date screen's whole-ledger save can't undo it.
//
// Its own private database (see roleGates.test.ts for why).
vi.hoisted(() => {
  const shared = process.env.DATA_DIR;
  if (!shared) throw new Error("DATA_DIR is not set — run these tests through vitest.config.ts so they use the private test database");
  process.env.DATA_DIR = `${shared}/sale-voids-${process.pid}`;
});

import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, readTenantDoc, writeTenantDoc, deleteTenantData } from "./db.js";
import { isVoidedSale, keepVoidedSales, withoutVoidedSales } from "./saleVoids.js";
import { readEvidence } from "./engines/decisionAnalysis.js";

const runId = Date.now();
const cleanupEmails: string[] = [];
const cleanupDealershipIds: string[] = [];
afterAll(() => {
  writeCollection("users", readCollection<any>("users").filter(u => !cleanupEmails.includes(u.email)));
  writeCollection("dealerships", readCollection<any>("dealerships").filter(d => !cleanupDealershipIds.includes(d.id)));
  for (const id of cleanupDealershipIds) deleteTenantData(id);
});

let owner: { token: string; dealershipId: string };
beforeAll(async () => {
  const email = `sale-voids-${runId}@test.local`;
  const res = await request(app).post("/auth/signup").send({ email, password: "salevoidspass123", name: "Owner", dealershipName: "Void Motors" });
  cleanupEmails.push(email);
  cleanupDealershipIds.push(res.body.user.dealershipId);
  owner = { token: res.body.token, dealershipId: res.body.user.dealershipId };
});

const VOID = { at: "2030-03-10T10:00:00.000Z", reason: "Recorded on the wrong car", byName: "Owner" };
const sale = (id: string, extra: Record<string, unknown> = {}) => ({ id, vehicleId: `car-${id}`, salePrice: 6000, invoiceNumber: `INV-${id}`, date: "2030-03-01", vatScheme: "margin", ...extra });
const ledger = (sales: unknown[]) => ({ costs: [], purchases: [], sales, transactions: [], suppliers: [], categories: [] });
const put = (doc: object) => request(app).put("/bookkeeping").set("Authorization", `Bearer ${owner.token}`).send(doc);
const storedSales = () => readTenantDoc<{ sales: any[] }>(owner.dealershipId, "bookkeeping", { sales: [] }).sales;

describe("the pieces", () => {
  it("knows a voided sale", () => {
    expect(isVoidedSale(sale("a", { voided: VOID }))).toBe(true);
    expect(isVoidedSale(sale("a"))).toBe(false);
    expect(isVoidedSale(sale("a", { voided: null }))).toBe(false);
  });
  it("leaves voided sales out of the ledger the figures read, and nothing else", () => {
    const doc = { purchases: [{ id: "p" }], sales: [sale("a"), sale("b", { voided: VOID })] };
    expect(withoutVoidedSales(doc)).toEqual({ purchases: [{ id: "p" }], sales: [sale("a")] });
  });
  it("puts a stored voided sale back exactly, wherever the save changed or dropped it", () => {
    const stored = [sale("a"), sale("b", { voided: VOID })];
    expect(keepVoidedSales(stored, [sale("a"), sale("b", { salePrice: 1 })])).toEqual(stored);
    expect(keepVoidedSales(stored, [sale("a")])).toEqual(stored);
    expect(keepVoidedSales([sale("a")], [sale("a", { salePrice: 7000 })])).toEqual([sale("a", { salePrice: 7000 })]);
  });
});

describe("voiding is one way through the real save", () => {
  it("a voided sale is saved as voided", async () => {
    const res = await put(ledger([sale("a"), sale("b", { voided: VOID })]));
    expect(res.status).toBe(200);
    expect(storedSales().find(s => s.id === "b").voided).toEqual(VOID);
  });

  it("an out-of-date screen's save can't un-void it, change it or drop it", async () => {
    await put(ledger([sale("a"), sale("b", { voided: VOID })]));
    await put(ledger([sale("a"), sale("b", { salePrice: 9999 })])); // the old copy, before the void
    expect(storedSales().find(s => s.id === "b")).toEqual(sale("b", { voided: VOID }));
    await put(ledger([sale("a")])); // an old copy without it at all
    expect(storedSales().map(s => s.id)).toEqual(["a", "b"]);
  });

  it("an ordinary sale can still be edited", async () => {
    await put(ledger([sale("a")]));
    await put(ledger([sale("a", { salePrice: 6500 })]));
    expect(storedSales()[0].salePrice).toBe(6500);
  });
});

describe("Pilot Brain's figures leave a voided sale out", () => {
  it("the evidence behind Pilot's view counts only the live sale", () => {
    const NOW = Date.parse("2030-03-15T12:00:00Z");
    writeTenantDoc(owner.dealershipId, "bookkeeping", {
      costs: [], transactions: [], suppliers: [], categories: [],
      purchases: [{ id: "pa", vehicleId: "car-a", purchasePrice: 4000, date: "2030-02-01" }, { id: "pb", vehicleId: "car-b", purchasePrice: 4000, date: "2030-02-01" }],
      sales: [sale("a"), sale("b", { voided: VOID })],
    });
    expect(readEvidence(owner.dealershipId, NOW).knownProfitCars).toBe(1);
  });
});

describe("every place Pilot Brain reads the books for figures leaves a voided sale out", () => {
  const NOW = Date.now();
  const today = new Date(NOW).toISOString().slice(0, 10);
  let d: string;
  beforeAll(() => {
    d = owner.dealershipId;
    writeTenantDoc(d, "bookkeeping", {
      costs: [], transactions: [], suppliers: [], categories: [],
      purchases: [{ id: "pa", vehicleId: "car-a", purchasePrice: 4000, date: today }, { id: "pb", vehicleId: "car-b", purchasePrice: 4000, date: today }],
      sales: [sale("a", { date: today }), sale("b", { date: today, salePrice: 9000, voided: VOID })],
    });
  });

  it("her business summary counts one sale, not two", async () => {
    const { buildBusinessSummary } = await import("./routes/pilotBrain.js");
    expect(buildBusinessSummary(d, true)).toContain("Sales recorded in Bookkeeping (all time): 1");
  });

  it("goals: revenue this month is the live sale's £6,000 only", async () => {
    const { computeAllGoalProgress } = await import("./routes/cofounder.js");
    const { writeTenantCollection } = await import("./db.js");
    writeTenantCollection(d, "pilotBrainGoals", [{ id: "g1", metric: "revenue", targetValue: 10000, period: "monthly", label: "Revenue", createdAt: today, createdByName: "Owner" }]);
    expect(computeAllGoalProgress(d, NOW)[0]!.currentValue).toBe(6000);
  });

  it("the simulator's inputs", async () => {
    const { readInputs } = await import("./routes/simulator.js");
    const books = readInputs(d, NOW).bookkeeping as { sales: { id: string }[] };
    expect(books.sales.map(s => s.id)).toEqual(["a"]);
  });

  it("her record-reading tools", async () => {
    const { tenantTabSource } = await import("./pilotBrainTools.js");
    expect((tenantTabSource(d).bookkeeping().sales as { id: string }[]).map(s => s.id)).toEqual(["a"]);
  });
});
