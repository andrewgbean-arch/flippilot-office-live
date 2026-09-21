import { describe, it, expect } from "vitest";
import { recordedPrice } from "./recordedPrice";
import { summariseVehicleMargins } from "./vehicleMargins";
import { countEvidence } from "./decisionAnalysis";
import { extractFacts } from "./simulator";
import { profitForVehicle } from "./advisorEngine";

// The Bookkeeping hub treats a purchase price or a sale price as recorded only when it
// is a real amount above zero: a blank that an older form saved as 0, a price saved as
// nothing (JSON turns NaN into null), text, or a negative is not a price, and that car's
// profit is UNKNOWN and left out.
//
// Pilot Brain reads the same ledger and its per-car figures say they are worked out
// "exactly as the Bookkeeping screen does it". They accepted any finite number, so for a
// purchase saved as 0 the hub said "profit unknown" while Pilot Brain reported
// "bought £0, sold £5,000, profit £5,000 (100.0%)". Every engine now reads a price
// through recordedPrice, so the two cannot disagree.

const NOW = Date.parse("2030-03-15T12:00:00Z");
const DAY = 86400000;
const dateDaysAgo = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10);

// What a stored price can hold that is NOT a price.
const NOT_A_PRICE: [string, unknown][] = [
  ["0", 0],
  ["negative zero", -0],
  ["null (NaN once saved)", null],
  ["missing", undefined],
  ["text", "4500"],
  ["negative", -100],
];

// One car, bought for `bought`, sold for `sold`, sold ten days ago.
function oneCar(bought: unknown, sold: unknown) {
  const purchase: Record<string, unknown> = { vehicleId: "a", date: dateDaysAgo(60) };
  if (bought !== undefined) purchase.purchasePrice = bought;
  const sale: Record<string, unknown> = { vehicleId: "a", date: dateDaysAgo(10) };
  if (sold !== undefined) sale.salePrice = sold;
  return { purchases: [purchase], sales: [sale], costs: [] };
}

describe("recordedPrice", () => {
  it("a real price is a finite number above zero", () => {
    expect(recordedPrice(5000)).toBe(5000);
    expect(recordedPrice(0.01)).toBe(0.01);
    expect(recordedPrice(6499.5)).toBe(6499.5);
  });

  it.each(NOT_A_PRICE)("%s is not a price", (_name, value) => {
    expect(recordedPrice(value)).toBeNull();
  });

  it("nor is NaN, Infinity or an object", () => {
    for (const v of [NaN, Infinity, -Infinity, {}, [], true]) expect(recordedPrice(v), String(v)).toBeNull();
  });
});

describe("Pilot Brain's per-car profit agrees with the hub about what a price is", () => {
  it("the audit's example: a purchase saved as 0 and a 5,000 sale is UNKNOWN, not 'bought £0 ... profit £5,000 (100.0%)'", () => {
    const lines = summariseVehicleMargins(oneCar(0, 5000), [{ id: "a", make: "Ford", model: "Focus", year: 2015 }], NOW);
    const text = lines.join("\n");
    expect(lines[0]).toContain("1 sold, profit known for 0");
    expect(lines[0]).toContain("its profit is UNKNOWN and left out of everything below");
    expect(text).not.toContain("bought £0");
    expect(text).not.toContain("profit £5,000");
    expect(text).not.toContain("100.0%");
    expect(text).not.toContain("worked out exactly as the Bookkeeping screen does it"); // no car is worked out
  });

  it.each(NOT_A_PRICE)("a purchase price of %s leaves the car UNKNOWN", (_name, price) => {
    const lines = summariseVehicleMargins(oneCar(price, 5000), [], NOW);
    expect(lines[0]).toContain("1 sold, profit known for 0");
    expect(lines.join("\n")).not.toContain("profit £5,000");
  });

  it.each(NOT_A_PRICE)("a SALE price of %s leaves the car UNKNOWN too (never a loss of the whole purchase)", (_name, price) => {
    const lines = summariseVehicleMargins(oneCar(4000, price), [], NOW);
    expect(lines[0]).toContain("1 sold, profit known for 0");
    expect(lines.join("\n")).not.toContain("-£4,000");
  });

  it("a car with real prices is still worked out, and the unknown one is kept out of the totals", () => {
    const book = {
      purchases: [
        { vehicleId: "good", purchasePrice: 4000, date: dateDaysAgo(60) },
        { vehicleId: "blank", purchasePrice: 0, date: dateDaysAgo(60) },
      ],
      sales: [
        { vehicleId: "good", salePrice: 5000, date: dateDaysAgo(10) },
        { vehicleId: "blank", salePrice: 6000, date: dateDaysAgo(10) },
      ],
      costs: [],
    };
    const lines = summariseVehicleMargins(book, [], NOW);
    expect(lines[0]).toContain("2 sold, profit known for 1");
    expect(lines[1]).toContain("Total £1,000 on £5,000 of sales");
  });
});

describe("the other engines use the same rule", () => {
  it("the evidence behind Pilot's view: a car with a purchase saved as 0 has no known profit, but it is still a sale", () => {
    const evidence = countEvidence(oneCar(0, 5000), [], NOW);
    expect(evidence.sales).toBe(1);
    expect(evidence.knownProfitCars).toBe(0);
    expect(countEvidence(oneCar(4000, 5000), [], NOW).knownProfitCars).toBe(1);
  });

  it.each(NOT_A_PRICE)("the evidence counts a purchase of %s and a sale of %s alike: no known profit", (_name, price) => {
    expect(countEvidence(oneCar(price, 5000), [], NOW).knownProfitCars).toBe(0);
    expect(countEvidence(oneCar(4000, price), [], NOW).knownProfitCars).toBe(0);
  });

  it("the simulator: no average price paid, no profit, from purchases saved as 0", () => {
    const facts = extractFacts({ vehicles: [], bookkeeping: oneCar(0, 5000), leads: [], now: NOW });
    expect(facts.avgProfit.value).toBeNull();
    expect(facts.avgPurchasePrice.value).toBeNull();
  });

  it("the simulator: cars in stock bought at 0 do not tie up 'money'; the price is unknown", () => {
    const facts = extractFacts({
      vehicles: [{ id: "a", status: "new" }],
      bookkeeping: { purchases: [{ vehicleId: "a", purchasePrice: 0, date: dateDaysAgo(20) }], sales: [], costs: [] },
      leads: [],
      now: NOW,
    });
    expect(facts.stockCapital.value).toBeNull();
    expect(facts.stockWithoutPurchasePrice.value).toBe(1);
  });

  it("the simulator still works a real car out", () => {
    const facts = extractFacts({ vehicles: [], bookkeeping: oneCar(4000, 5000), leads: [], now: NOW });
    expect(facts.avgProfit.value).toBe(1000);
    expect(facts.avgPurchasePrice.value).toBe(4000);
  });

  describe("the advisor's per-car profit", () => {
    const book = (purchasePrice: unknown, salePrice: unknown) =>
      ({
        purchases: [{ id: "p", vehicleId: "a", purchasePrice, date: "2030-01-01" }],
        sales: [{ id: "s", vehicleId: "a", salePrice, date: "2030-02-01" }],
        costs: [{ id: "c", vehicleId: "a", amount: 100, date: "2030-01-15" }],
      }) as never;

    it("works a real car out", () => {
      expect(profitForVehicle("a", book(4000, 5000))).toBe(900);
    });

    it.each(NOT_A_PRICE)("a purchase of %s, or a sale of %s, is unknown (null), not a profit worked from 0", (_name, price) => {
      expect(profitForVehicle("a", book(price, 5000))).toBeNull();
      expect(profitForVehicle("a", book(4000, price))).toBeNull();
    });

    it("no purchase or no sale is still unknown", () => {
      expect(profitForVehicle("nope", book(4000, 5000))).toBeNull();
    });
  });
});
