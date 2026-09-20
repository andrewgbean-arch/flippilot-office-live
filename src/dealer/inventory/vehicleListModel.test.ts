import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import {
  ageBand,
  daysInStock,
  filterAndSort,
  formatDate,
  formatMileage,
  formatPrice,
  isSold,
  matchesQuery,
  matchesStatus,
  motState,
  prettyStatus,
  registrationOf,
  shownPrice,
  statusCounts,
  vehicleTitle,
  type ListOptions,
} from "./vehicleListModel";

const car = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, make: "Ford", model: "Fiesta", year: 2018, status: "in stock", priceRetail: 5000, ...extra }) as unknown as Vehicle;
const ids = (list: Vehicle[]) => list.map(v => v.id);
const opts = (extra: Partial<ListOptions> = {}): ListOptions => ({ query: "", status: "all", sort: "newest", ...extra });

// Noon UTC on 1 June 2026: well away from any midnight.
const NOW = new Date("2026-06-01T12:00:00Z");

describe("status and names", () => {
  it("counts a car as sold whatever the casing or spacing of its status", () => {
    expect(isSold(car("a", { status: "sold" }))).toBe(true);
    expect(isSold(car("a", { status: " SOLD " }))).toBe(true);
    expect(isSold(car("a", { status: "in stock" }))).toBe(false);
    expect(isSold(car("a", { status: "new" }))).toBe(false);
    expect(isSold(car("a", { status: undefined }))).toBe(false);
  });

  it("writes a status the way a person would", () => {
    expect(prettyStatus("in stock")).toBe("In stock");
    expect(prettyStatus("SOLD")).toBe("Sold");
    expect(prettyStatus("in_stock")).toBe("In stock");
    expect(prettyStatus("")).toBe("No status");
    expect(prettyStatus(null)).toBe("No status");
  });

  it("names a car from its make and model, and never prints 'undefined'", () => {
    expect(vehicleTitle({ make: "BMW", model: "1 Series" })).toBe("BMW 1 Series");
    expect(vehicleTitle({ make: "Skoda", model: "" })).toBe("Skoda");
    expect(vehicleTitle({ make: undefined, model: undefined } as unknown as Vehicle)).toBe("Unnamed vehicle");
    expect(vehicleTitle({ make: "  Kia ", model: " Ceed " })).toBe("Kia Ceed");
  });

  it("reads the registration from the car, then from its MOT record, upper-cased", () => {
    expect(registrationOf({ reg: "ab12 cde" } as Vehicle)).toBe("AB12 CDE");
    expect(registrationOf({ mot: { reg: "xy99zzz" } } as unknown as Vehicle)).toBe("XY99ZZZ");
    expect(registrationOf({ reg: "  " } as Vehicle)).toBeNull();
    expect(registrationOf({} as Vehicle)).toBeNull();
  });
});

describe("dates", () => {
  it("writes a date the UK way, without slipping a day", () => {
    expect(formatDate("2027-03-12")).toBe("12 Mar 2027");
    expect(formatDate("2027-01-01")).toBe("1 Jan 2027");
    expect(formatDate("2027-12-31T23:30:00Z")).toBe("31 Dec 2027");
  });

  it("returns null for a date that can't be read", () => {
    expect(formatDate("not a date")).toBeNull();
    expect(formatDate("")).toBeNull();
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
  });

  it("counts whole days in stock", () => {
    expect(daysInStock("2026-05-31T12:00:00Z", NOW)).toBe(1);
    expect(daysInStock("2026-06-01T11:59:00Z", NOW)).toBe(0);
    expect(daysInStock("2026-03-03T12:00:00Z", NOW)).toBe(90);
  });

  it("says nothing when there's no usable date, and never goes negative", () => {
    expect(daysInStock(undefined, NOW)).toBeNull();
    expect(daysInStock("", NOW)).toBeNull();
    expect(daysInStock("garbage", NOW)).toBeNull();
    expect(daysInStock("2030-01-01T00:00:00Z", NOW)).toBe(0);
  });

  it("marks ageing stock at the same 60 and 90 day lines the dashboard uses", () => {
    expect(ageBand(null)).toBe("fresh");
    expect(ageBand(0)).toBe("fresh");
    expect(ageBand(59)).toBe("fresh");
    expect(ageBand(60)).toBe("ageing");
    expect(ageBand(89)).toBe("ageing");
    expect(ageBand(90)).toBe("old");
    expect(ageBand(400)).toBe("old");
  });
});

describe("MOT state", () => {
  it("has no opinion without a usable date", () => {
    for (const bad of [undefined, null, "", "soon", "31/12/2026"]) {
      expect(motState(bad as string | null | undefined, NOW)).toEqual({ kind: "unknown", label: "No MOT date", date: null });
    }
  });

  it("is valid through the whole of the expiry day, and expired once that day has ended", () => {
    // MOT runs out today (1 June) and it is midday: still fine, but due soon.
    expect(motState("2026-06-01", NOW).kind).toBe("soon");
    // Yesterday's date: over.
    expect(motState("2026-05-31", NOW).kind).toBe("expired");
    // One second before the end of 1 June, and the moment it ends.
    expect(motState("2026-06-01", new Date("2026-06-01T23:59:59Z")).kind).toBe("soon");
    expect(motState("2026-06-01", new Date("2026-06-02T00:00:00Z")).kind).toBe("expired");
  });

  it("calls it due soon at 30 days or fewer and valid beyond that, rounding a part day up", () => {
    // 30 Jun runs out at 1 Jul 00:00, which is 29.5 days from NOW: 30 days left.
    expect(motState("2026-06-30", NOW).kind).toBe("soon");
    // 1 Jul runs out at 2 Jul 00:00, 30.5 days away: counts as 31, so not yet "soon".
    expect(motState("2026-07-01", NOW).kind).toBe("valid");
    expect(motState("2027-03-12", NOW).kind).toBe("valid");
  });

  it("treats a full timestamp as the exact moment, not the end of a day", () => {
    expect(motState("2026-06-01T10:00:00Z", NOW).kind).toBe("expired");
    expect(motState("2026-06-01T14:00:00Z", NOW).kind).toBe("soon");
  });

  it("carries the readable date and a label", () => {
    expect(motState("2027-03-12", NOW)).toEqual({ kind: "valid", label: "MOT valid", date: "12 Mar 2027" });
    expect(motState("2026-05-01", NOW)).toEqual({ kind: "expired", label: "MOT expired", date: "1 May 2026" });
    expect(motState("2026-06-10", NOW).label).toBe("MOT due soon");
  });
});

describe("money and distance", () => {
  it("writes a price with the pound sign and thousands separator", () => {
    expect(formatPrice(7995)).toBe("£7,995");
    expect(formatPrice(750)).toBe("£750");
    expect(formatPrice(12345.6)).toBe("£12,346");
  });

  it("says nothing for a price that isn't really set", () => {
    for (const bad of [0, -5, null, undefined, NaN, Infinity]) expect(formatPrice(bad as number | null | undefined)).toBeNull();
  });

  it("writes mileage, including a genuine zero", () => {
    expect(formatMileage(45231)).toBe("45,231 miles");
    expect(formatMileage(0)).toBe("0 miles");
    expect(formatMileage(null)).toBeNull();
    expect(formatMileage(undefined)).toBeNull();
    expect(formatMileage(-1)).toBeNull();
    expect(formatMileage(NaN)).toBeNull();
  });

  it("shows what a sold car sold for, and the asking price for the rest", () => {
    expect(shownPrice(car("a", { status: "sold", sellPrice: 4800, priceRetail: 5000 }))).toEqual({ amount: 4800, label: "Sold for" });
    // A sale price that was never recorded falls back to the asking price.
    expect(shownPrice(car("a", { status: "sold", sellPrice: null, priceRetail: 5000 }))).toEqual({ amount: 5000, label: "Sold for" });
    expect(shownPrice(car("a", { status: "sold", sellPrice: 0, priceRetail: 5000 }))).toEqual({ amount: 5000, label: "Sold for" });
    // Unsold: the asking price, even if a sale price is lying around.
    expect(shownPrice(car("a", { status: "in stock", sellPrice: 4800, priceRetail: 5000 }))).toEqual({ amount: 5000, label: "Asking" });
    expect(shownPrice(car("a", { priceRetail: null }))).toEqual({ amount: null, label: "Asking" });
  });
});

describe("search", () => {
  const golf = car("g", { make: "VW", model: "Golf", year: 2016, colour: "Blue", reg: "AB12 CDE" });

  it("matches everything when nothing is typed", () => {
    expect(matchesQuery(golf, "")).toBe(true);
    expect(matchesQuery(golf, "   ")).toBe(true);
  });

  it("finds a car by make, model, year, colour or status, in any case", () => {
    expect(matchesQuery(golf, "vw")).toBe(true);
    expect(matchesQuery(golf, "GOLF")).toBe(true);
    expect(matchesQuery(golf, "2016")).toBe(true);
    expect(matchesQuery(golf, "blue")).toBe(true);
    expect(matchesQuery(golf, "in stock")).toBe(true);
  });

  it("needs every word to match, in any order", () => {
    expect(matchesQuery(golf, "golf vw")).toBe(true);
    expect(matchesQuery(golf, "golf 2016 blue")).toBe(true);
    expect(matchesQuery(golf, "golf red")).toBe(false);
    expect(matchesQuery(golf, "polo")).toBe(false);
  });

  it("finds a registration with or without the space, in any case", () => {
    expect(matchesQuery(golf, "ab12cde")).toBe(true);
    expect(matchesQuery(golf, "AB12 CDE")).toBe(true);
    expect(matchesQuery(golf, "ab12")).toBe(true);
    expect(matchesQuery(golf, "ab13")).toBe(false);
  });

  it("reads the registration from the MOT record when the car has none of its own", () => {
    const v = car("m", { mot: { reg: "XY99 ZZZ" } });
    expect(matchesQuery(v, "xy99zzz")).toBe(true);
  });

  it("copes with a car that has almost nothing recorded", () => {
    const bare = { id: "odd", make: "Skoda", model: "Fabia" } as unknown as Vehicle;
    expect(matchesQuery(bare, "fabia")).toBe(true);
    expect(matchesQuery(bare, "2018")).toBe(false);
    expect(() => matchesQuery({ id: "x" } as unknown as Vehicle, "anything")).not.toThrow();
  });
});

describe("status filter and counts", () => {
  const stock = [car("a"), car("b", { status: "new" }), car("c", { status: "reserved" }), car("d", { status: "sold" }), car("e", { status: "Sold" })];

  it("counts sold and everything else, and the counts add up", () => {
    expect(statusCounts(stock)).toEqual({ all: 5, sold: 2, "in-stock": 3 });
    expect(statusCounts([])).toEqual({ all: 0, sold: 0, "in-stock": 0 });
  });

  it("filters to in stock, sold or all", () => {
    expect(stock.filter(v => matchesStatus(v, "in-stock")).map(v => v.id)).toEqual(["a", "b", "c"]);
    expect(stock.filter(v => matchesStatus(v, "sold")).map(v => v.id)).toEqual(["d", "e"]);
    expect(stock.filter(v => matchesStatus(v, "all"))).toHaveLength(5);
  });
});

describe("filterAndSort", () => {
  const list = [
    car("old", { createdAt: "2026-01-01T00:00:00Z", priceRetail: 6000, make: "Toyota", model: "Yaris" }),
    car("new", { createdAt: "2026-05-01T00:00:00Z", priceRetail: 9000, make: "Audi", model: "A3" }),
    car("mid", { createdAt: "2026-03-01T00:00:00Z", priceRetail: 7500, make: "BMW", model: "1 Series" }),
    car("nodate", { createdAt: undefined, priceRetail: null, make: "Zafira", model: "Vauxhall" }),
  ];

  it("puts the newest first, and cars with no date last", () => {
    expect(ids(filterAndSort(list, opts({ sort: "newest" })))).toEqual(["new", "mid", "old", "nodate"]);
  });

  it("puts the longest in stock first, and cars with no date STILL last", () => {
    expect(ids(filterAndSort(list, opts({ sort: "longest" })))).toEqual(["old", "mid", "new", "nodate"]);
  });

  it("sorts by price either way, with unpriced cars always last", () => {
    expect(ids(filterAndSort(list, opts({ sort: "price-high" })))).toEqual(["new", "mid", "old", "nodate"]);
    expect(ids(filterAndSort(list, opts({ sort: "price-low" })))).toEqual(["old", "mid", "new", "nodate"]);
  });

  it("sorts by make and model, A to Z", () => {
    expect(ids(filterAndSort(list, opts({ sort: "name" })))).toEqual(["new", "mid", "old", "nodate"]);
  });

  it("keeps the stored order for cars that tie", () => {
    const same = [car("1", { priceRetail: 5000 }), car("2", { priceRetail: 5000 }), car("3", { priceRetail: 5000 })];
    expect(ids(filterAndSort(same, opts({ sort: "price-high" })))).toEqual(["1", "2", "3"]);
    expect(ids(filterAndSort(same, opts({ sort: "price-low" })))).toEqual(["1", "2", "3"]);
    expect(ids(filterAndSort(same, opts({ sort: "newest" })))).toEqual(["1", "2", "3"]);
  });

  it("uses a sold car's sale price when sorting by price", () => {
    const mixed = [car("a", { priceRetail: 5000 }), car("b", { status: "sold", priceRetail: 9000, sellPrice: 4000 })];
    expect(ids(filterAndSort(mixed, opts({ sort: "price-high" })))).toEqual(["a", "b"]);
  });

  it("filters by status and search together, then sorts what is left", () => {
    const stock = [
      car("a", { make: "VW", model: "Golf", priceRetail: 5000 }),
      car("b", { make: "VW", model: "Polo", priceRetail: 4000, status: "sold" }),
      car("c", { make: "VW", model: "Passat", priceRetail: 8000 }),
      car("d", { make: "Ford", model: "Focus", priceRetail: 3000 }),
    ];
    expect(ids(filterAndSort(stock, opts({ query: "vw", status: "in-stock", sort: "price-high" })))).toEqual(["c", "a"]);
    expect(ids(filterAndSort(stock, opts({ query: "vw", status: "sold" })))).toEqual(["b"]);
    expect(filterAndSort(stock, opts({ query: "nothing like this" }))).toEqual([]);
  });

  it("never changes the list it was given", () => {
    const before = ids(list);
    filterAndSort(list, opts({ sort: "price-low", query: "a" }));
    expect(ids(list)).toEqual(before);
  });

  it("copes with an empty list", () => {
    expect(filterAndSort([], opts())).toEqual([]);
  });
});
