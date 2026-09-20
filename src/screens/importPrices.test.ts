import { describe, it, expect } from "vitest";
import {
  readImportPrices,
  readImportCounts,
  unreadablePriceSummary,
  unreadableCountSummary,
  BUY_PRICE_LABEL,
  SELL_PRICE_LABEL,
  MILEAGE_LABEL,
  YEAR_LABEL,
} from "./importPrices";

// The price columns of a vehicle CSV. "£5,000" (Excel's currency format) used to
// be dropped without a word because Number("£5,000") is NaN.

describe("readImportPrices", () => {
  it("keeps prices that read, in every way a spreadsheet writes them", () => {
    expect(readImportPrices({ buyPrice: "£5,000", sellPrice: "£6,500.50" })).toEqual({ buyPrice: 5000, sellPrice: 6500.5, unreadable: [] });
    expect(readImportPrices({ buyPrice: "5,000", sellPrice: "6500" })).toEqual({ buyPrice: 5000, sellPrice: 6500, unreadable: [] });
    expect(readImportPrices({ buyPrice: " 4500.00 ", sellPrice: "£ 7,250" })).toEqual({ buyPrice: 4500, sellPrice: 7250, unreadable: [] });
  });

  it("blank stays unset and is NOT reported as unreadable", () => {
    expect(readImportPrices({})).toEqual({ buyPrice: null, sellPrice: null, unreadable: [] });
    expect(readImportPrices({ buyPrice: "", sellPrice: "   " })).toEqual({ buyPrice: null, sellPrice: null, unreadable: [] });
  });

  it("a price of 0 is unset, and is not reported as unreadable (0 used to be dropped the same way)", () => {
    expect(readImportPrices({ buyPrice: "0", sellPrice: "0.00" })).toEqual({ buyPrice: null, sellPrice: null, unreadable: [] });
  });

  it("a price typed but unreadable is left unset AND named, never made 0", () => {
    const r = readImportPrices({ buyPrice: "5,00", sellPrice: "6500" });
    expect(r.buyPrice).toBeNull();
    expect(r.sellPrice).toBe(6500);
    expect(r.unreadable).toEqual([BUY_PRICE_LABEL]);
  });

  it("names both when both are unreadable", () => {
    const r = readImportPrices({ buyPrice: "abc", sellPrice: "4.500,00" });
    expect(r).toEqual({ buyPrice: null, sellPrice: null, unreadable: [BUY_PRICE_LABEL, SELL_PRICE_LABEL] });
  });

  it("refuses a negative, an exponent, Infinity, hex, more than pence: reported, not guessed", () => {
    for (const bad of ["-500", "1e4", "Infinity", "0x1F", "5000.999", "N/A", "TBC", "POA"]) {
      const r = readImportPrices({ buyPrice: bad });
      expect(r.buyPrice, bad).toBeNull();
      expect(r.unreadable, bad).toEqual([BUY_PRICE_LABEL]);
    }
  });
});

describe("unreadablePriceSummary", () => {
  it("says nothing when every price read", () => {
    expect(unreadablePriceSummary(0)).toBeNull();
    expect(unreadablePriceSummary(-1)).toBeNull();
  });

  it("says how many rows, singular and plural", () => {
    expect(unreadablePriceSummary(1)).toBe(
      "1 row had a price that could not be read, so it was left blank. Check the buy and sell prices on that car."
    );
    expect(unreadablePriceSummary(3)).toBe(
      "3 rows had a price that could not be read, so those prices were left blank. Check the buy and sell prices on those cars."
    );
  });
});

describe("readImportCounts (year and mileage)", () => {
  const NOW = new Date("2026-09-21T12:00:00Z");

  it("keeps a mileage the way a spreadsheet shows it, and a plain one", () => {
    expect(readImportCounts({ year: "2014", mileage: "45,000" }, NOW)).toEqual({ year: 2014, mileage: 45000, unreadable: [] });
    expect(readImportCounts({ year: "2019", mileage: "45000" }, NOW)).toEqual({ year: 2019, mileage: 45000, unreadable: [] });
    expect(readImportCounts({ mileage: " 1,234,567 " }, NOW).mileage).toBe(1234567);
  });

  it("blank and 0 are unset, and neither is reported", () => {
    expect(readImportCounts({}, NOW)).toEqual({ year: null, mileage: null, unreadable: [] });
    expect(readImportCounts({ year: "", mileage: "   " }, NOW)).toEqual({ year: null, mileage: null, unreadable: [] });
    expect(readImportCounts({ year: "0", mileage: "0" }, NOW)).toEqual({ year: null, mileage: null, unreadable: [] });
  });

  it("something typed that cannot be read is left unset AND named", () => {
    for (const bad of ["45k", "45,00", "4,5000", "45.5", "-100", "1e4", "TBC", "45000 miles", "Infinity"]) {
      const r = readImportCounts({ mileage: bad }, NOW);
      expect(r.mileage, bad).toBeNull();
      expect(r.unreadable, bad).toEqual([MILEAGE_LABEL]);
    }
  });

  it("a year must be a real one: 4 digits, from 1900 to next year", () => {
    for (const bad of ["14", "20140", "1899", "2028", "2014.5", "MMXIV"]) {
      const r = readImportCounts({ year: bad }, NOW);
      expect(r.year, bad).toBeNull();
      expect(r.unreadable, bad).toEqual([YEAR_LABEL]);
    }
    expect(readImportCounts({ year: "1900" }, NOW).year).toBe(1900);
    expect(readImportCounts({ year: "2027" }, NOW).year).toBe(2027);
  });

  it("a mileage past two million is a slipped key, not a mileage", () => {
    expect(readImportCounts({ mileage: "2,000,000" }, NOW).mileage).toBe(2000000);
    expect(readImportCounts({ mileage: "20,000,000" }, NOW).unreadable).toEqual([MILEAGE_LABEL]);
  });

  it("names both, in the order year then mileage", () => {
    expect(readImportCounts({ year: "14", mileage: "45k" }, NOW).unreadable).toEqual([YEAR_LABEL, MILEAGE_LABEL]);
  });
});

describe("unreadableCountSummary", () => {
  it("says nothing when every year and mileage read", () => {
    expect(unreadableCountSummary(0)).toBeNull();
  });

  it("says how many rows, singular and plural", () => {
    expect(unreadableCountSummary(1)).toBe(
      "1 row had a year or mileage that could not be read, so it was left blank. Check the year and mileage on that car."
    );
    expect(unreadableCountSummary(2)).toBe(
      "2 rows had a year or mileage that could not be read, so those were left blank. Check the year and mileage on those cars."
    );
  });
});
