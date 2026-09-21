import "./testPrivateDatabase.js"; // must stay first: see that file
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, writeTenantDoc, deleteTenantData } from "./db.js";

// A profit goal ("make £X this month") is measured from the ledger. It used to count a
// car whose purchase price was saved as 0 as pure profit (sale price minus £0), so the
// goal read ahead of the truth: the Bookkeeping hub leaves such a car out (its profit is
// unknown) but the goal counted the whole sale price.

const runId = Date.now();
const email = `goal-profit-${runId}@test.local`;
let token: string;
let dealershipId: string;

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const purchase = (vehicleId: string, purchasePrice: unknown) => ({ id: `p-${vehicleId}`, vehicleId, purchasePrice, date: daysAgo(40) });
const sale = (vehicleId: string, salePrice: unknown) => ({ id: `s-${vehicleId}`, vehicleId, salePrice, date: daysAgo(5) });

async function profitProgress(book: { purchases: unknown[]; sales: unknown[]; costs?: unknown[] }): Promise<number> {
  writeTenantDoc(dealershipId, "bookkeeping", { costs: [], transactions: [], suppliers: [], categories: [], ...book });
  const res = await request(app).get("/pilot-brain/goals").set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  const goal = res.body.goals.find((g: any) => g.goal.metric === "profit");
  return goal.currentValue;
}

beforeAll(async () => {
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "integrationtestpass123",
    name: "Goal Owner",
    dealershipName: "Goal Profit Motors",
  });
  token = res.body.token;
  dealershipId = res.body.user.dealershipId;
  const made = await request(app)
    .post("/pilot-brain/goals")
    .set("Authorization", `Bearer ${token}`)
    .send({ metric: "profit", targetValue: 10000, period: "monthly" });
  expect(made.status).toBe(200);
});

afterAll(() => {
  try {
    writeCollection(
      "users",
      readCollection<any>("users").filter(u => u.email !== email)
    );
    writeCollection(
      "dealerships",
      readCollection<any>("dealerships").filter(d => d.id !== dealershipId)
    );
    if (dealershipId) deleteTenantData(dealershipId);
  } catch (err) {
    console.error("goalProfitPrices cleanup failed:", err);
  }
});

describe("a profit goal only counts cars whose profit can be worked out", () => {
  it("a real car counts: sold 5,000, bought 4,000, 300 costs is 700", async () => {
    const now = await profitProgress({
      purchases: [purchase("a", 4000)],
      sales: [sale("a", 5000)],
      costs: [{ id: "c", vehicleId: "a", amount: 300, date: daysAgo(20) }],
    });
    expect(now).toBe(700);
  });

  it.each([
    ["0", 0],
    ["nothing (null)", null],
    ["text", "4000"],
    ["negative", -100],
  ])("a purchase price of %s is left out, not counted as a profit of the whole sale price", async (_name, price) => {
    const now = await profitProgress({ purchases: [purchase("a", price)], sales: [sale("a", 5000)] });
    expect(now).toBe(0); // not 5,000
  });

  it.each([
    ["0", 0],
    ["nothing (null)", null],
    ["text", "5000"],
  ])("a sale price of %s is left out, not counted as a loss of the whole purchase", async (_name, price) => {
    const now = await profitProgress({ purchases: [purchase("a", 4000)], sales: [sale("a", price)] });
    expect(now).toBe(0); // not -4,000
  });

  it("the good car is still counted alongside one that is left out", async () => {
    const now = await profitProgress({
      purchases: [purchase("good", 4000), purchase("blank", 0)],
      sales: [sale("good", 5000), sale("blank", 6000)],
    });
    expect(now).toBe(1000);
  });
});
