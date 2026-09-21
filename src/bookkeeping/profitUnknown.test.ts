import { describe, it, expect } from "vitest";
import { hubTotals, carProfit } from "./profitTotals";
import type { CostEntry, PurchaseEntry, SaleEntry } from "./types";

// A purchase whose price is not a real amount above zero is "purchase not
// recorded", and a sale whose price is not a real amount above zero is "sale price
// not recorded": either way the profit is unknown, the sale is left out AND
// counted, and nothing ever turns into NaN, Infinity or a made-up zero.

const buy = (vehicleId: string, purchasePrice: unknown) => ({ id: `p-${vehicleId}`, vehicleId, purchasePrice }) as PurchaseEntry;
const sell = (vehicleId: string, salePrice: unknown) => ({ id: `s-${vehicleId}`, vehicleId, salePrice }) as SaleEntry;
const cost = (vehicleId: string, amount: unknown) => ({ id: `c-${vehicleId}`, vehicleId, amount }) as CostEntry;

const NOT_A_PRICE: [string, unknown][] = [
  ["zero (a blank that was saved as 0)", 0],
  ["negative zero", -0],
  ["negative", -4500],
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["-Infinity", -Infinity],
  ["null (what JSON makes of NaN)", null],
  ["undefined (field missing)", undefined],
  ["text", "4500"],
  ["an object", {}],
];

describe("carProfit: one definition of a car's profit and margin", () => {
  it("works out profit and margin from purchase, sale and costs", () => {
    // 5,000 - 4,000 - 300 = 700 profit; 700 / 5,000 = 14.0%
    const r = carProfit(4000, 5000, 300)!;
    expect(r.profit).toBe(700);
    expect(r.margin).toBeCloseTo(14, 10);
  });

  it("the audit's example: bought 4,500, sold 5,000 is a 500 profit and a 10% margin (not 5,000 and 100%)", () => {
    const r = carProfit(4500, 5000, 0)!;
    expect(r.profit).toBe(500);
    expect(r.margin).toBeCloseTo(10, 10);
  });

  it("reports a genuine loss as negative, with a negative margin", () => {
    const r = carProfit(6000, 5000, 500)!;
    expect(r.profit).toBe(-1500);
    expect(r.margin).toBeCloseTo(-30, 10);
  });

  it.each(NOT_A_PRICE)("a purchase price of %s is 'purchase not recorded': null, never worked out against £0", (_name, price) => {
    expect(carProfit(price, 5000, 0)).toBeNull();
  });

  // The same "unknown is never zero" rule as the purchase price, on the other side. A
  // sale saved with no usable price is not a sale of £0: it used to turn a £4,000
  // purchase into a £4,000 LOSS on the hub, while the invoice page for that very sale
  // said "No Price Recorded".
  it.each(NOT_A_PRICE)("a sale price of %s is 'sale price not recorded': null, never a loss of the whole purchase", (_name, price) => {
    expect(carProfit(4000, price, 0)).toBeNull();
    expect(carProfit(4000, price, 250)).toBeNull();
  });

  it("a real sale price always gives a real margin (never Infinity or NaN)", () => {
    for (const sale of [0.01, 1, 5000, 999999]) {
      const r = carProfit(4000, sale, 0)!;
      expect(Number.isFinite(r.profit), String(sale)).toBe(true);
      expect(Number.isFinite(r.margin), String(sale)).toBe(true);
    }
  });

  it("unreadable costs add nothing rather than poisoning the profit", () => {
    for (const c of [NaN, Infinity, null, undefined, "12"]) {
      expect(carProfit(4000, 5000, c)!.profit, String(c)).toBe(1000);
    }
  });

  it("never returns NaN or Infinity for any mix of junk", () => {
    const junk: unknown[] = [0, -1, 1, 4500, NaN, Infinity, -Infinity, null, undefined, "x", {}];
    for (const p of junk)
      for (const s of junk)
        for (const c of junk) {
          const r = carProfit(p, s, c);
          if (r === null) continue;
          expect(Number.isFinite(r.profit), `${String(p)}/${String(s)}/${String(c)}`).toBe(true);
          if (r.margin !== null) expect(Number.isFinite(r.margin)).toBe(true);
        }
  });
});

describe("hubTotals treats a purchase with no real price as 'purchase not recorded'", () => {
  it.each(NOT_A_PRICE)("purchase price %s: the sale is left out and counted, profit is not the whole sale price", (_name, price) => {
    const t = hubTotals([buy("a", price)], [sell("a", 5000)], []);
    expect(t.profit).toBe(0); // not 5000
    expect(t.revenue).toBe(0);
    expect(t.marginPercent).toBeNull(); // not 100
    expect(t.soldCounted).toBe(0);
    expect(t.soldWithoutPurchase).toBe(1);
  });

  it("the audit's headline: an unreadable buy price then a 5,000 sale does NOT show 5,000 profit and 100% margin", () => {
    // "4,500" typed into a box that saved it as nothing.
    const t = hubTotals([buy("a", null)], [sell("a", 5000)], []);
    expect(t.profit).not.toBe(5000);
    expect(t.marginPercent).not.toBe(100);
    expect(t.soldWithoutPurchase).toBe(1);
  });

  it("counts the unreadable one and still works out the good ones", () => {
    const t = hubTotals(
      [buy("good", 4000), buy("bad", 0), buy("worse", NaN)],
      [sell("good", 5000), sell("bad", 6000), sell("worse", 7000)],
      [cost("good", 300)]
    );
    expect(t.profit).toBe(5000 - 4000 - 300);
    expect(t.revenue).toBe(5000);
    expect(t.marginPercent).toBeCloseTo(14, 10);
    expect(t.soldCounted).toBe(1);
    expect(t.soldWithoutPurchase).toBe(2);
  });

  it("uses the FIRST purchase row for a car, the same as getProfitForVehicle (a later good row does not rescue an earlier bad one)", () => {
    const t = hubTotals([buy("a", 0), buy("a", 4000)], [sell("a", 5000)], []);
    expect(t.soldWithoutPurchase).toBe(1);
    expect(t.profit).toBe(0);
  });

  it("only a real purchase price counts as money out: junk adds nothing to spend", () => {
    const t = hubTotals([buy("a", 4000), buy("b", 0), buy("c", -500), buy("d", NaN), buy("e", null)], [], []);
    expect(t.spend).toBe(4000);
  });

  it("a car with an unreadable purchase and no sale is still a car bought and not sold", () => {
    const t = hubTotals([buy("a", 0)], [], []);
    expect(t.boughtNotSold).toBe(1);
    expect(t.soldWithoutPurchase).toBe(0);
  });

  it.each(NOT_A_PRICE)("a sale price of %s on a good purchase is left out and counted (not a loss of the whole purchase)", (_name, price) => {
    const t = hubTotals([buy("a", 4000)], [sell("a", price)], []);
    expect(t.profit).toBe(0); // not -4000
    expect(t.revenue).toBe(0);
    expect(t.marginPercent).toBeNull();
    expect(t.soldCounted).toBe(0);
    expect(t.soldWithoutPrice).toBe(1);
    expect(t.soldWithoutPurchase).toBe(0); // the purchase is fine: the count says what is actually missing
  });

  it("counts the two kinds of missing figure apart, and still works out the good cars", () => {
    const t = hubTotals(
      [buy("good", 4000), buy("noBuy", 0), buy("noSale", 3000)],
      [sell("good", 5000), sell("noBuy", 6000), sell("noSale", 0)],
      [cost("good", 300)]
    );
    expect(t.profit).toBe(700);
    expect(t.soldCounted).toBe(1);
    expect(t.soldWithoutPurchase).toBe(1);
    expect(t.soldWithoutPrice).toBe(1);
  });

  it("a sale with neither a purchase nor a price is counted once, as having no purchase", () => {
    const t = hubTotals([buy("a", 0)], [sell("a", 0)], []);
    expect(t.soldWithoutPurchase).toBe(1);
    expect(t.soldWithoutPrice).toBe(0);
  });

  it("the audit example: a blank saved as a 0 sale of a 4,000 car is NOT a 4,000 loss", () => {
    const t = hubTotals([buy("a", 4000)], [sell("a", 0)], []);
    expect(t.profit).not.toBe(-4000);
    expect(t.soldCounted).toBe(0);
  });

  it("buying and selling both at 0 is 'not recorded', not 'NaN%'", () => {
    const t = hubTotals([buy("a", 0)], [sell("a", 0)], []);
    expect(t.marginPercent).toBeNull();
    expect(t.soldWithoutPurchase).toBe(1);
    expect(Number.isNaN(t.profit)).toBe(false);
  });

  it("never gives NaN or Infinity for any mix of junk prices and costs", () => {
    const junk: unknown[] = [0, -1, 4500, NaN, Infinity, -Infinity, null, undefined, "x"];
    for (const p of junk)
      for (const s of junk)
        for (const c of junk) {
          const t = hubTotals([buy("a", p)], [sell("a", s)], [cost("a", c)]);
          const label = `${String(p)}/${String(s)}/${String(c)}`;
          for (const v of [t.spend, t.profit, t.revenue]) expect(Number.isFinite(v), label).toBe(true);
          if (t.marginPercent !== null) expect(Number.isFinite(t.marginPercent), label).toBe(true);
        }
  });

  it("agrees with carProfit for a car it can work out", () => {
    const t = hubTotals([buy("a", 4500)], [sell("a", 5000)], [cost("a", 120)]);
    const one = carProfit(4500, 5000, 120)!;
    expect(t.profit).toBe(one.profit);
    expect(t.marginPercent).toBeCloseTo(one.margin!, 10);
  });
});
