import { describe, it, expect } from "vitest";
import {
  bookingHref,
  carTitle,
  chartPoints,
  formatDay,
  marketSummary,
  mileageSeries,
  mileageText,
  motHeadline,
  phoneHref,
  priceText,
  testLabel,
  titleCase,
  ulezChip,
} from "./carPassportModel";
import type { PassportMarket, PassportMot, PassportMotTest } from "./passportTypes";

const test = (over: Partial<PassportMotTest> = {}): PassportMotTest => ({ result: "pass", advisories: [], failures: [], ...over });
const mot = (over: Partial<PassportMot> = {}): PassportMot => ({ state: "valid", tests: [], ...over });
const market = (over: Partial<PassportMarket> = {}): PassportMarket => ({
  averageAsking: 9000,
  lowest: 6000,
  highest: 12000,
  listings: 14,
  checkedOn: "2030-03-12",
  difference: -505,
  basis: "make and model",
  ...over,
});

describe("small formatters", () => {
  it("writes a day the way a person would, without the time zone moving it", () => {
    expect(formatDay("2030-09-01")).toBe("1 Sept 2030");
    expect(formatDay("2030-01-01")).toBe("1 Jan 2030");
    for (const bad of [undefined, "", "not a date", "2030-13-45", "2030-9-1"]) expect(formatDay(bad as never), String(bad)).toBe("");
  });

  it("names the car, the price, and the miles", () => {
    expect(carTitle({ year: 2019, make: "Ford", model: "Fiesta" })).toBe("2019 Ford Fiesta");
    expect(carTitle({ make: "Ford", model: "Fiesta" })).toBe("Ford Fiesta");
    expect(priceText(8495)).toBe("£8,495");
    expect(priceText(null)).toBe("Price on request");
    expect(priceText(0)).toBe("Price on request");
    expect(mileageText(42000)).toBe("42,000 miles");
    expect(mileageText(undefined)).toBeNull();
  });

  it("turns DVLA's capitals into words", () => {
    expect(titleCase("PETROL")).toBe("Petrol");
    expect(titleCase("HYBRID ELECTRIC")).toBe("Hybrid Electric");
    expect(titleCase("plug-in hybrid")).toBe("Plug-In Hybrid");
  });

  it("builds a tap-to-call link with only the digits", () => {
    expect(phoneHref("01234 567 890")).toBe("tel:01234567890");
    expect(phoneHref("+44 (0)1234 567890")).toBe("tel:+4401234567890");
  });

  it("links to booking with this car chosen", () => {
    expect(bookingHref("d1", "v 1&x")).toBe("/book/d1?vehicle=v%201%26x");
  });
});

describe("motHeadline", () => {
  it("says until when, plainly, with the days left only when it's getting close", () => {
    expect(motHeadline(mot({ expiry: "2030-09-01", daysLeft: 120 }))).toEqual({ text: "MOT until 1 Sept 2030", tone: "good" });
    expect(motHeadline(mot({ expiry: "2030-09-01", daysLeft: 30 }))).toEqual({ text: "MOT until 1 Sept 2030 (30 days left)", tone: "warn" });
    expect(motHeadline(mot({ expiry: "2030-09-01", daysLeft: 1 }))?.text).toBe("MOT until 1 Sept 2030 (1 day left)");
    expect(motHeadline(mot({ expiry: "2030-09-01", daysLeft: 0 }))).toEqual({ text: "MOT expires today (1 Sept 2030)", tone: "warn" });
  });

  it("says when it has expired", () => {
    expect(motHeadline(mot({ state: "expired", expiry: "2029-09-01" }))).toEqual({ text: "MOT expired 1 Sept 2029", tone: "bad" });
  });

  it("says nothing when there is no expiry date to state", () => {
    expect(motHeadline(mot({ state: "unknown" }))).toBeNull();
    expect(motHeadline(mot({ state: "valid" }))).toBeNull();
    expect(motHeadline(mot({ expiry: "garbage", state: "valid" }))).toBeNull();
  });
});

describe("the MOT history and its mileage chart", () => {
  it("labels a test by its date, or its year, or says the date isn't recorded", () => {
    expect(testLabel(test({ date: "2029-05-01" }))).toBe("1 May 2029");
    expect(testLabel(test({ year: 2024 }))).toBe("2024");
    expect(testLabel(test())).toBe("Date not recorded");
  });

  it("lists mileage readings oldest first, only where a mileage and a date were recorded", () => {
    const series = mileageSeries(
      mot({
        tests: [
          test({ date: "2029-05-01", mileage: 40000 }),
          test({ date: "2027-05-01", mileage: 20000 }),
          test({ date: "2028-05-01" }), // no mileage recorded
          test({ mileage: 1 }), // no date or year
          test({ year: 2026, mileage: 10000 }),
        ],
      })
    );
    expect(series.map(p => p.mileage)).toEqual([10000, 20000, 40000]);
    expect(series.map(p => p.label)).toEqual(["2026", "1 May 2027", "1 May 2029"]);
  });

  it("only draws a chart from two or more readings", () => {
    expect(chartPoints([], 300, 60, 8)).toEqual([]);
    expect(chartPoints([{ label: "a", mileage: 1 }], 300, 60, 8)).toEqual([]);
  });

  it("spreads the readings evenly, with higher mileage higher up, inside the padding", () => {
    const pts = chartPoints(
      [
        { label: "a", mileage: 10000 },
        { label: "b", mileage: 20000 },
        { label: "c", mileage: 40000 },
      ],
      300,
      100,
      10
    );
    expect(pts.map(p => p.x)).toEqual([10, 150, 290]);
    expect(pts[0]!.y).toBe(90); // the lowest reading sits at the bottom
    expect(pts[2]!.y).toBe(10); // the highest at the top
    expect(pts[1]!.y).toBeGreaterThan(pts[2]!.y);
    expect(pts[1]!.y).toBeLessThan(pts[0]!.y);
  });

  it("copes with every reading being the same", () => {
    const pts = chartPoints([{ label: "a", mileage: 5000 }, { label: "b", mileage: 5000 }], 300, 100, 10);
    expect(pts).toHaveLength(2);
    for (const p of pts) expect(Number.isFinite(p.y)).toBe(true);
  });
});

describe("ulezChip", () => {
  it("says compliant or not, with the fuel and Euro standard behind it", () => {
    expect(ulezChip({ fuelType: "PETROL", euroStatus: "Euro 6" })).toEqual({ text: "ULEZ compliant", tone: "good", detail: "Petrol, Euro 6" });
    expect(ulezChip({ fuelType: "DIESEL", euroStatus: "Euro 5" })).toEqual({ text: "Not ULEZ compliant", tone: "warn", detail: "Diesel, Euro 5" });
    expect(ulezChip({ fuelType: "ELECTRICITY" })?.tone).toBe("good");
  });

  it("says nothing when it can't tell, rather than guessing", () => {
    expect(ulezChip(undefined)).toBeNull();
    expect(ulezChip({ fuelType: "PETROL" })).toBeNull(); // no Euro standard on record
    expect(ulezChip({ fuelType: "STEAM" })).toBeNull();
  });
});

describe("marketSummary", () => {
  it("says how far below or above the average asking price the car is", () => {
    expect(marketSummary(market({ difference: -505 }), "Ford", "Fiesta", 8495).headline).toBe("£505 below the average asking price");
    expect(marketSummary(market({ difference: 600 }), "Ford", "Fiesta", 9600).headline).toBe("£600 above the average asking price");
  });

  it("says 'in line' when the difference is small", () => {
    expect(marketSummary(market({ difference: 40 }), "Ford", "Fiesta", 9040).headline).toBe("In line with the average asking price");
    expect(marketSummary(market({ difference: -170 }), "Ford", "Fiesta", 8830).headline).toBe("In line with the average asking price"); // within 2% of £9,000
    expect(marketSummary(market({ difference: -181 }), "Ford", "Fiesta", 8819).headline).toContain("below");
  });

  it("is only ever positive about a price below the average, never negative about one above", () => {
    expect(marketSummary(market({ difference: -505 }), "Ford", "Fiesta", 8495).tone).toBe("good");
    expect(marketSummary(market({ difference: 600 }), "Ford", "Fiesta", 9600).tone).toBe("plain");
    expect(marketSummary(market({ difference: 10 }), "Ford", "Fiesta", 9010).tone).toBe("plain");
  });

  it("always says what the number is: asking prices, how many, where from, when, and what isn't compared", () => {
    const { detail } = marketSummary(market(), "Ford", "Fiesta", 8495);
    for (const part of ["14 dealer listings", "Ford Fiesta", "eBay", "12 Mar 2030", "asking prices, not what cars sold for", "mileage and specification vary"]) {
      expect(detail, part).toContain(part);
    }
  });

  it("places the average and the car on the range, and flags a price outside it", () => {
    const s = marketSummary(market(), "Ford", "Fiesta", 8495);
    expect(s.bar).toMatchObject({ lowest: 6000, highest: 12000, outside: false });
    expect(s.bar!.avgPct).toBe(50);
    expect(s.bar!.askingPct).toBeCloseTo(41.58, 1);
    expect(marketSummary(market(), "Ford", "Fiesta", 15000).bar).toMatchObject({ askingPct: 100, outside: true });
    expect(marketSummary(market(), "Ford", "Fiesta", 2000).bar).toMatchObject({ askingPct: 0, outside: true });
  });

  it("draws no range when the range isn't known, or the car has no price", () => {
    const { lowest: _dropped, ...noLowest } = market();
    expect(marketSummary(noLowest, "Ford", "Fiesta", 8495)).not.toHaveProperty("bar");
    expect(marketSummary(market({ lowest: 9000, highest: 9000 }), "Ford", "Fiesta", 8495)).not.toHaveProperty("bar");
    expect(marketSummary(market(), "Ford", "Fiesta", null)).not.toHaveProperty("bar");
  });
});
