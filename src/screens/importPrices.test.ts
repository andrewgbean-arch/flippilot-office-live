import { describe, it, expect } from "vitest";
import { readImportPrices, unreadablePriceSummary, BUY_PRICE_LABEL, SELL_PRICE_LABEL } from "./importPrices";

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
