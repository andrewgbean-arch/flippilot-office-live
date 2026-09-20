import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import {
  askingPriceSummary,
  averageDaysInStock,
  averageMileage,
  hasAskingPrice,
  hasMotRecord,
  inStockAtLeast,
  motCounts,
  stockAgeBands,
  unsold,
  withMotAdvisories,
  withoutAskingPrice,
  withoutPhotos,
} from "./stockFacts";

// The figures on the analytics screens and the inventory dashboard are counted
// from the dealer's own cars. These tests pin the rules that used to go wrong:
// sold cars counted as stock, unpriced cars dragging an average down as £0,
// unknown mileage counted as 0, and expired MOTs lumped in with "due soon".

const car = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, make: "Ford", model: "Fiesta", status: "in stock", priceRetail: 5000, mileage: 50000, ...extra }) as unknown as Vehicle;
const ids = (list: Vehicle[]) => list.map(v => v.id);

// Noon UTC on 1 June 2026: well away from any midnight.
const NOW = new Date("2026-06-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("what counts as stock on hand", () => {
  it("leaves sold cars out", () => {
    const list = [car("a"), car("b", { status: "sold" }), car("c", { status: "new" })];
    expect(ids(unsold(list))).toEqual(["a", "c"]);
  });
});

describe("asking prices", () => {
  it("averages only the priced cars that are still unsold", () => {
    const list = [
      car("a", { priceRetail: 4000 }),
      car("b", { priceRetail: 6000 }),
      car("c", { priceRetail: 0 }), // unpriced: must not count as £0
      car("d", { priceRetail: null }),
      car("e", { priceRetail: 90000, status: "sold" }), // sold: must not count
    ];
    expect(askingPriceSummary(list)).toEqual({ count: 2, average: 5000, lowest: 4000, highest: 6000 });
  });

  it("is null when nothing is priced, so a screen can say so instead of showing £0", () => {
    expect(askingPriceSummary([car("a", { priceRetail: 0 }), car("b", { priceRetail: null })])).toBeNull();
    expect(askingPriceSummary([])).toBeNull();
  });

  it("treats 0 and missing as no price set", () => {
    expect(hasAskingPrice(car("a", { priceRetail: 1 }))).toBe(true);
    expect(hasAskingPrice(car("a", { priceRetail: 0 }))).toBe(false);
    expect(hasAskingPrice(car("a", { priceRetail: null }))).toBe(false);
    expect(hasAskingPrice(car("a", { priceRetail: undefined }))).toBe(false);
  });

  it("lists the unsold cars with no asking price", () => {
    const list = [car("a"), car("b", { priceRetail: 0 }), car("c", { priceRetail: null, status: "sold" })];
    expect(ids(withoutAskingPrice(list))).toEqual(["b"]);
  });
});

describe("mileage", () => {
  it("averages only the cars with a recorded mileage", () => {
    const list = [
      car("a", { mileage: 40000 }),
      car("b", { mileage: 60000 }),
      car("c", { mileage: null }), // unknown is not 0 miles
      car("d", { mileage: 0 }), // a blank form field can store 0
      car("e", { mileage: 999999, status: "sold" }),
    ];
    expect(averageMileage(list)).toEqual({ count: 2, average: 50000 });
  });

  it("is null when no car has a mileage", () => {
    expect(averageMileage([car("a", { mileage: null })])).toBeNull();
  });
});

describe("days in stock", () => {
  it("averages over the unsold cars that have a date added", () => {
    const list = [
      car("a", { createdAt: daysAgo(10) }),
      car("b", { createdAt: daysAgo(30) }),
      car("c"), // no date on an older record: left out, not counted as 0 days
      car("d", { createdAt: daysAgo(500), status: "sold" }),
    ];
    expect(averageDaysInStock(list, NOW)).toEqual({ count: 2, average: 20 });
  });

  it("is null when no car has a date", () => {
    expect(averageDaysInStock([car("a")], NOW)).toBeNull();
  });

  it("groups the unsold cars by age, with the ones that have no date kept apart", () => {
    const list = [
      car("a", { createdAt: daysAgo(0) }),
      car("b", { createdAt: daysAgo(29) }),
      car("c", { createdAt: daysAgo(30) }),
      car("d", { createdAt: daysAgo(59) }),
      car("e", { createdAt: daysAgo(60) }),
      car("f", { createdAt: daysAgo(89) }),
      car("g", { createdAt: daysAgo(90) }),
      car("h", { createdAt: daysAgo(400) }),
      car("i"),
      car("j", { createdAt: daysAgo(400), status: "sold" }),
    ];
    expect(stockAgeBands(list, NOW)).toEqual({ under30: 2, from30to59: 2, from60to89: 2, from90: 2, unknown: 1 });
  });

  it("lists cars that have been here at least N days (the boundary day counts)", () => {
    const list = [
      car("a", { createdAt: daysAgo(89) }),
      car("b", { createdAt: daysAgo(90) }),
      car("c", { createdAt: daysAgo(200) }),
      car("d"), // no date: cannot be said to be old
      car("e", { createdAt: daysAgo(200), status: "sold" }),
    ];
    expect(ids(inStockAtLeast(list, 90, NOW))).toEqual(["b", "c"]);
  });
});

describe("MOT", () => {
  const mot = (expiry: string) => ({ mot: { expiry, advisories: [], historyScore: 0, history: [] } });

  it("keeps expired and due-within-30-days apart, and cars with no date apart from both", () => {
    const list = [
      car("expired", mot("2026-05-01")),
      car("expired2", mot("2025-01-01")),
      car("soon", mot("2026-06-20")),
      car("valid", mot("2027-01-01")),
      car("nodate", mot("")),
      car("sold", { ...mot("2020-01-01"), status: "sold" }),
    ];
    expect(motCounts(list, NOW)).toEqual({ expired: 2, dueSoon: 1, valid: 1, noDate: 1 });
  });

  it("knows whether a car has any MOT information at all", () => {
    expect(hasMotRecord(car("a", mot("2027-01-01")))).toBe(true);
    expect(
      hasMotRecord(car("a", { mot: { expiry: "", advisories: [], historyScore: 0, history: [{ result: "PASSED", advisories: [] }] } }))
    ).toBe(true);
    expect(hasMotRecord(car("a", mot("")))).toBe(false); // never looked up
    expect(hasMotRecord(car("a", { mot: undefined }))).toBe(false);
  });

  it("lists unsold cars with advisories on their MOT", () => {
    const list = [
      car("a", { mot: { expiry: "2027-01-01", advisories: ["Tyre worn"], historyScore: 0, history: [] } }),
      car("b", mot("2027-01-01")),
      car("c", { mot: { expiry: "2027-01-01", advisories: ["Tyre worn"], historyScore: 0, history: [] }, status: "sold" }),
      car("d", { mot: undefined }),
    ];
    expect(ids(withMotAdvisories(list))).toEqual(["a"]);
  });
});

describe("photos", () => {
  it("lists unsold cars that have none", () => {
    const list = [
      car("a", { images: ["x.jpg"] }),
      car("b", { images: [] }),
      car("c", { images: null }),
      car("d"),
      car("e", { images: [], status: "sold" }),
    ];
    expect(ids(withoutPhotos(list))).toEqual(["b", "c", "d"]);
  });
});
