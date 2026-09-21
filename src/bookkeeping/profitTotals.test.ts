import { describe, it, expect } from "vitest";
import { hubTotals, leftOutNote } from "./profitTotals";
import type { CostEntry, PurchaseEntry, SaleEntry } from "./types";

const buy = (vehicleId: string, purchasePrice: number) => ({ id: `p-${vehicleId}`, vehicleId, purchasePrice }) as PurchaseEntry;
const sell = (vehicleId: string, salePrice: number) => ({ id: `s-${vehicleId}`, vehicleId, salePrice }) as SaleEntry;
const cost = (vehicleId: string, amount: number, id = `c-${vehicleId}-${amount}`) => ({ id, vehicleId, amount }) as CostEntry;

describe("the bookkeeping hub's figures", () => {
  it("works profit out per SOLD car: sale less that car's purchase price and costs", () => {
    const t = hubTotals([buy("a", 4000)], [sell("a", 5500)], [cost("a", 300), cost("a", 200)]);
    expect(t.profit).toBe(1000);
    expect(t.revenue).toBe(5500);
    expect(t.soldCounted).toBe(1);
  });

  it("does NOT count cars still in stock as money lost (the old cash-style total did)", () => {
    // One car sold at a £1,000 profit; three more bought for £5,000 each and still on the forecourt.
    const purchases = [buy("a", 4000), buy("b", 5000), buy("c", 5000), buy("d", 5000)];
    const t = hubTotals(purchases, [sell("a", 5000)], []);
    expect(t.profit).toBe(1000); // not 5000 - 19000 = -14000
    expect(t.spend).toBe(19000); // the money that has gone out is still reported as spend
    expect(t.boughtNotSold).toBe(3);
  });

  it("counts costs on unsold cars as spend, but not as a loss on sold ones", () => {
    const t = hubTotals([buy("a", 4000), buy("b", 6000)], [sell("a", 5000)], [cost("a", 250), cost("b", 700)]);
    expect(t.spend).toBe(4000 + 6000 + 250 + 700);
    expect(t.profit).toBe(5000 - 4000 - 250);
  });

  it("reports a genuine loss on a sold car as negative", () => {
    const t = hubTotals([buy("a", 6000)], [sell("a", 5000)], [cost("a", 500)]);
    expect(t.profit).toBe(-1500);
    expect(t.marginPercent).toBeCloseTo(-30, 5);
  });

  it("gives the margin as profit over sale price across the sold cars", () => {
    const t = hubTotals([buy("a", 4000), buy("b", 8000)], [sell("a", 5000), sell("b", 10000)], []);
    expect(t.profit).toBe(3000);
    expect(t.revenue).toBe(15000);
    expect(t.marginPercent).toBeCloseTo(20, 5);
  });

  it("leaves a sale with no purchase on record OUT, and says how many", () => {
    const t = hubTotals([buy("a", 4000)], [sell("a", 5000), sell("imported", 7000)], []);
    expect(t.profit).toBe(1000); // the £7,000 is not counted as pure profit
    expect(t.revenue).toBe(5000);
    expect(t.soldCounted).toBe(1);
    expect(t.soldWithoutPurchase).toBe(1);
  });

  it("has no margin, not a made-up zero, when no sold car can be worked out", () => {
    expect(hubTotals([], [], []).marginPercent).toBeNull();
    expect(hubTotals([buy("a", 4000)], [], []).marginPercent).toBeNull();
    expect(hubTotals([], [sell("imported", 7000)], []).marginPercent).toBeNull();
  });

  it("counts a car once even if it was sold, or bought, twice in the records", () => {
    const t = hubTotals([buy("a", 4000), buy("a", 9999)], [sell("a", 5000), sell("a", 8888)], [cost("a", 100)]);
    expect(t.profit).toBe(5000 - 4000 - 100);
    expect(t.soldCounted).toBe(1);
  });

  it("counts a cost once against its car even when a car appears in several sales rows", () => {
    const t = hubTotals([buy("a", 1000)], [sell("a", 3000), sell("a", 3000)], [cost("a", 500)]);
    expect(t.profit).toBe(3000 - 1000 - 500);
  });

  it("copes with a completely empty set of books", () => {
    expect(hubTotals([], [], [])).toEqual({
      spend: 0,
      profit: 0,
      revenue: 0,
      marginPercent: null,
      soldCounted: 0,
      soldWithoutPurchase: 0,
      soldWithoutPrice: 0,
      boughtNotSold: 0,
    });
  });

  it("treats an unreadable amount as nothing rather than poisoning the total with NaN", () => {
    const t = hubTotals(
      [buy("a", 4000), { id: "p2", vehicleId: "b", purchasePrice: NaN } as PurchaseEntry],
      [sell("a", 5000)],
      [{ id: "c", vehicleId: "a", amount: NaN } as CostEntry]
    );
    expect(Number.isNaN(t.spend)).toBe(false);
    expect(t.spend).toBe(4000);
    expect(t.profit).toBe(1000);
  });

  it("does not change what it is given", () => {
    const purchases = [buy("a", 4000)];
    const sales = [sell("a", 5000)];
    const costs = [cost("a", 100)];
    const before = JSON.stringify([purchases, sales, costs]);
    hubTotals(purchases, sales, costs);
    expect(JSON.stringify([purchases, sales, costs])).toBe(before);
  });
});

// The line under "Profit on sold cars" says which sales were left out, and why.
describe("leftOutNote", () => {
  const note = (soldWithoutPurchase: number, soldWithoutPrice: number) => leftOutNote({ soldWithoutPurchase, soldWithoutPrice });

  it("says nothing when no sale was left out", () => {
    expect(note(0, 0)).toBeNull();
  });

  it("purchase only: the wording the hub has always used", () => {
    expect(note(1, 0)).toBe("1 sale has no purchase recorded and is left out");
    expect(note(3, 0)).toBe("3 sales have no purchase recorded and are left out");
  });

  it("sale price only: says the SALE price is what is missing", () => {
    expect(note(0, 1)).toBe("1 sale has no sale price recorded and is left out");
    expect(note(0, 2)).toBe("2 sales have no sale price recorded and are left out");
  });

  it("both: says both, and that all of them are left out", () => {
    expect(note(1, 1)).toBe("1 sale has no purchase recorded and 1 sale has no sale price recorded, so both are left out");
    expect(note(2, 1)).toBe("2 sales have no purchase recorded and 1 sale has no sale price recorded, so all of them are left out");
  });
});
