import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import { profitBeforeSaleVat, riskCheck } from "./profitFigures";

describe("profit before VAT on the sale", () => {
  it("is the sale price less the purchase price and every cost", () => {
    expect(profitBeforeSaleVat({ purchasePrice: 5000, expectedSale: 7000, grossCosts: 600 })).toBe(1400);
  });

  it("can be a loss", () => {
    expect(profitBeforeSaleVat({ purchasePrice: 5000, expectedSale: 5200, grossCosts: 600 })).toBe(-400);
  });

  it("is not worked out when the purchase price isn't set: no treating it as £0", () => {
    expect(profitBeforeSaleVat({ purchasePrice: 0, expectedSale: 7000, grossCosts: 300 })).toBeNull();
    expect(profitBeforeSaleVat({ purchasePrice: null, expectedSale: 7000, grossCosts: 300 })).toBeNull();
    expect(profitBeforeSaleVat({ purchasePrice: undefined, expectedSale: 7000, grossCosts: 300 })).toBeNull();
  });

  it("is not worked out when there is no sale or asking price, which used to show as minus the costs", () => {
    expect(profitBeforeSaleVat({ purchasePrice: 5000, expectedSale: 0, grossCosts: 300 })).toBeNull();
    expect(profitBeforeSaleVat({ purchasePrice: 5000, expectedSale: null, grossCosts: 300 })).toBeNull();
  });
});

describe("the rule-of-thumb risk check", () => {
  // The age part of the score comes from the current year, so pin the clock.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const car = (over: Record<string, unknown> = {}) =>
    ({
      id: "x",
      make: "Ford",
      model: "Fiesta",
      year: 2015,
      mileage: 50000,
      status: "in stock",
      mot: { expiry: "2027-01-01", advisories: [], historyScore: 0, history: [], year: 2015 },
      ...over,
    }) as unknown as Vehicle;

  it("says there isn't enough data for a car nobody has looked the MOT up for", () => {
    const neverChecked = car({ mot: { expiry: "", advisories: [], historyScore: 0, history: [] }, mileage: 150000 });
    expect(riskCheck(neverChecked)).toBe("Not enough data");
    expect(riskCheck(undefined)).toBe("Not enough data");
  });

  it("bands the score once there is an MOT record", () => {
    expect(riskCheck(car())).toBe("Low"); // 50k miles, no advisories, 11 years old = 10 points
    // 130k miles (30) + 3 advisories (15) + age 11 (10) = 55
    expect(
      riskCheck(
        car({
          mileage: 130000,
          mot: { expiry: "2027-01-01", advisories: ["a", "b", "c"], historyScore: 0, history: [], year: 2015 },
        })
      )
    ).toBe("Medium");
    // 130k (30) + 6 advisories (30) + 2 failure items (30) + age 14 (20) = 110, capped at 100
    expect(
      riskCheck(
        car({
          mileage: 130000,
          mot: {
            expiry: "2027-01-01",
            advisories: ["a", "b", "c", "d", "e", "f"],
            historyScore: 0,
            history: [{ result: "FAIL", advisories: [], failures: ["x", "y"] }],
            year: 2012,
          },
        })
      )
    ).toBe("High");
  });
});
