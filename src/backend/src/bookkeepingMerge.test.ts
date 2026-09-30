import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Two people using Books at once (bookkeepingMerge.ts). Every save sends the whole
// ledger, so an older screen's save used to wipe a colleague's new sale, cost or
// purchase. Saves are now merged entry by entry; a deletion must be named, and is
// remembered so an out-of-date screen can't bring it back.
//
// Its own private database (see roleGates.test.ts for why).
vi.hoisted(() => {
  const shared = process.env.DATA_DIR;
  if (!shared) throw new Error("DATA_DIR is not set — run these tests through vitest.config.ts so they use the private test database");
  process.env.DATA_DIR = `${shared}/books-merge-${process.pid}`;
});

import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, writeTenantDoc, deleteTenantData } from "./db.js";
import { mergeLedger, removedFromBody } from "./bookkeepingMerge.js";

const runId = Date.now();
const cleanupEmails: string[] = [];
const cleanupDealershipIds: string[] = [];
afterAll(() => {
  writeCollection("users", readCollection<any>("users").filter(u => !cleanupEmails.includes(u.email)));
  writeCollection("dealerships", readCollection<any>("dealerships").filter(d => !cleanupDealershipIds.includes(d.id)));
  for (const id of cleanupDealershipIds) deleteTenantData(id);
});

let token = "";
let d = "";
beforeAll(async () => {
  const email = `books-merge-${runId}@test.local`;
  const res = await request(app).post("/auth/signup").send({ email, password: "booksmergepass123", name: "Owner", dealershipName: "Merge Motors" });
  cleanupEmails.push(email);
  cleanupDealershipIds.push(res.body.user.dealershipId);
  token = res.body.token;
  d = res.body.user.dealershipId;
});

const EMPTY = { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] };
const cost = (id: string, amount = 100) => ({ id, vehicleId: "car-1", type: "parts", amount, date: "2030-01-05" });
const sale = (id: string, extra: Record<string, unknown> = {}) => ({ id, vehicleId: `car-${id}`, salePrice: 6000, invoiceNumber: `INV-${id}`, date: "2030-02-01", vatScheme: "margin", ...extra });
const put = (body: object) => request(app).put("/bookkeeping").set("Authorization", `Bearer ${token}`).send(body);
const get = async () => (await request(app).get("/bookkeeping").set("Authorization", `Bearer ${token}`)).body;
const ids = (list: { id: string }[]) => list.map(e => e.id);

describe("the merge itself", () => {
  it("takes the save's version of an entry, keeps entries only the store has, and drops only named deletions", () => {
    const merged = mergeLedger(
      { ...EMPTY, costs: [cost("a"), cost("b"), cost("c")] },
      { ...EMPTY, costs: [cost("a", 999), cost("new")] } as any,
      { costs: ["c"] },
      {}
    );
    expect(merged.costs).toEqual([cost("a", 999), cost("new"), cost("b")]);
  });

  it("a remembered deletion wins even when the save still has the entry", () => {
    const merged = mergeLedger({ ...EMPTY }, { ...EMPTY, costs: [cost("x")] } as any, {}, { costs: new Set(["x"]) });
    expect(merged.costs).toEqual([]);
  });

  it("only costs can be named as deleted", () => {
    expect(removedFromBody({ removed: { costs: ["a", 5, ""], sales: ["s1"], purchases: ["p1"] } })).toEqual({ costs: ["a"] });
    expect(removedFromBody({})).toEqual({});
  });
});

describe("two people saving the books", () => {
  it("a colleague's new sale, cost and purchase survive an older screen's save", async () => {
    writeTenantDoc(d, "bookkeeping", { ...EMPTY, costs: [cost("mine")] });
    // What screen A loaded.
    const screenA = await get();
    // Screen B records a sale, a cost and a purchase.
    await put({ ...EMPTY, costs: [cost("mine"), cost("theirs")], sales: [sale("s1")], purchases: [{ id: "p1", vehicleId: "car-s1", purchasePrice: 4000, date: "2030-01-01" }] });
    // Screen A, still holding its old copy, edits its own cost and saves.
    const res = await put({ ...EMPTY, ...screenA, ok: undefined, costs: [cost("mine", 150)] });
    expect(res.status).toBe(200);
    const now = await get();
    expect(ids(now.costs).sort()).toEqual(["mine", "theirs"]);
    expect(now.costs.find((c: any) => c.id === "mine").amount).toBe(150);
    expect(ids(now.sales)).toEqual(["s1"]);
    expect(ids(now.purchases)).toEqual(["p1"]);
    // And the save hands the merged ledger back, so screen A can show them.
    expect(ids(res.body.sales)).toEqual(["s1"]);
  });

  it("a deleted cost stays deleted, even when an older screen saves it back", async () => {
    writeTenantDoc(d, "bookkeeping", { ...EMPTY, costs: [cost("keep"), cost("wrong")] });
    const oldScreen = await get();
    await put({ ...EMPTY, costs: [cost("keep")], removed: { costs: ["wrong"] } });
    expect(ids((await get()).costs)).toEqual(["keep"]);
    await put({ ...EMPTY, ...oldScreen, ok: undefined });
    expect(ids((await get()).costs)).toEqual(["keep"]);
  });

  it("leaving a cost out without naming it deletes nothing", async () => {
    writeTenantDoc(d, "bookkeeping", { ...EMPTY, costs: [cost("a"), cost("b")] });
    await put({ ...EMPTY, costs: [cost("a")] });
    expect(ids((await get()).costs).sort()).toEqual(["a", "b"]);
  });

  it("naming a sale as deleted does nothing: sales are voided, not deleted", async () => {
    writeTenantDoc(d, "bookkeeping", { ...EMPTY, sales: [sale("s9")] });
    await put({ ...EMPTY, removed: { sales: ["s9"] } });
    expect(ids((await get()).sales)).toEqual(["s9"]);
  });

  it("a voided sale is still put back as stored", async () => {
    const VOID = { at: "2030-03-10T10:00:00.000Z", reason: "wrong car", byName: "Owner" };
    writeTenantDoc(d, "bookkeeping", { ...EMPTY, sales: [sale("v1", { voided: VOID })] });
    await put({ ...EMPTY, sales: [sale("v1", { salePrice: 1 })] });
    expect((await get()).sales).toEqual([sale("v1", { voided: VOID })]);
  });
});
