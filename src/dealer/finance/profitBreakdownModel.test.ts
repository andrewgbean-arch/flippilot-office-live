import { describe, it, expect, vi, beforeEach } from "vitest";

// Wrap the real VAT functions in spies so a test can prove the Profit
// Breakdown calls the app's shared VAT code instead of holding its own copy
// of the formula (the old screen had a wrong private copy).
vi.mock("@/bookkeeping/vatUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/bookkeeping/vatUtils")>();
  return {
    ...actual,
    calculateMarginVat: vi.fn(actual.calculateMarginVat),
    calculateVat: vi.fn(actual.calculateVat),
  };
});

import { calculateMarginVat, calculateVat } from "@/bookkeeping/vatUtils";
import {
  calculateProfitBreakdown,
  formatMoney,
  toAmount,
  PROFIT_VAT_RATE,
  type ProfitBreakdownInput,
} from "./profitBreakdownModel";

// Real money and an HMRC-relevant figure: every case below is a number a
// dealer would read off the screen.

function input(overrides: Partial<ProfitBreakdownInput> = {}): ProfitBreakdownInput {
  return {
    purchasePrice: 5000,
    reconCost: 1000,
    partsLabour: 0,
    otherCosts: 0,
    salePrice: 7000,
    treatment: "margin",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(calculateMarginVat).mockClear();
  vi.mocked(calculateVat).mockClear();
});

describe("margin scheme (the default): the audit's worked example", () => {
  it("buy 5,000, recon 1,000, sell 7,000 -> VAT 333.33 and net profit 666.67 (the old screen said 166.67 and 833.33)", () => {
    const r = calculateProfitBreakdown(input());
    expect(r.ready).toBe(true);
    expect(r.totalCosts).toBe(6000);
    expect(r.grossProfit).toBe(1000);
    expect(r.vatBasis).toBe(2000); // sale minus PURCHASE price only
    expect(r.vat).toBeCloseTo(333.33, 2);
    expect(r.netProfit).toBeCloseTo(666.67, 2);
    expect(r.marginPct).toBeCloseTo((1000 / 7000) * 100, 5);
  });

  it("is exactly 1/6 of sale minus purchase at the standard 20% rate", () => {
    const r = calculateProfitBreakdown(input({ purchasePrice: 0, reconCost: 0, salePrice: 6000 }));
    expect(r.vat).toBeCloseTo(1000, 5);
  });

  it("reconditioning, parts and other costs never change the VAT", () => {
    const noCosts = calculateProfitBreakdown(input({ reconCost: 0, partsLabour: 0, otherCosts: 0 }));
    const heavyCosts = calculateProfitBreakdown(input({ reconCost: 1000, partsLabour: 700, otherCosts: 300 }));
    expect(heavyCosts.vat).toBeCloseTo(noCosts.vat as number, 8);
    expect(heavyCosts.vat).toBeCloseTo(333.33, 2);
    // ...but they do reduce the profit, pound for pound.
    expect(heavyCosts.grossProfit).toBe(noCosts.grossProfit! - 2000);
  });

  it("net profit is gross profit minus the VAT due", () => {
    const r = calculateProfitBreakdown(input({ purchasePrice: 3200, reconCost: 450, partsLabour: 220, otherCosts: 35, salePrice: 5495 }));
    expect(r.grossProfit).toBeCloseTo(5495 - (3200 + 450 + 220 + 35), 8);
    expect(r.netProfit).toBeCloseTo((r.grossProfit as number) - (r.vat as number), 8);
    expect(r.vat).toBeCloseTo((5495 - 3200) / 6, 8);
  });

  it("VAT is still due on the margin when recon costs wipe out the profit (VAT is on sale minus purchase, not on profit)", () => {
    const r = calculateProfitBreakdown(input({ purchasePrice: 5000, reconCost: 3000, salePrice: 7000 }));
    expect(r.grossProfit).toBe(-1000);
    expect(r.vat).toBeCloseTo(333.33, 2);
    expect(r.netProfit).toBeCloseTo(-1333.33, 2);
  });

  it("no VAT is due when the car sells for less than it cost, and the loss is not made bigger", () => {
    const r = calculateProfitBreakdown(input({ purchasePrice: 5000, reconCost: 500, salePrice: 4200 }));
    expect(r.vatBasis).toBe(0);
    expect(r.vat).toBe(0);
    expect(r.grossProfit).toBe(-1300);
    expect(r.netProfit).toBe(-1300);
  });

  it("no VAT is due at exact break-even on the purchase price", () => {
    const r = calculateProfitBreakdown(input({ purchasePrice: 5000, reconCost: 0, salePrice: 5000 }));
    expect(r.vat).toBe(0);
    expect(r.grossProfit).toBe(0);
    expect(r.netProfit).toBe(0);
  });

  it("calls the SHARED calculateMarginVat with sale, purchase and the standard 20% rate", () => {
    calculateProfitBreakdown(input());
    expect(calculateMarginVat).toHaveBeenCalledTimes(1);
    expect(calculateMarginVat).toHaveBeenCalledWith(7000, 5000, 0.2);
    expect(PROFIT_VAT_RATE).toBe(0.2);
    // ...and does not touch the standard-VAT function in this mode.
    expect(calculateVat).not.toHaveBeenCalled();
  });

  it("agrees with calculateMarginVat for a spread of figures", () => {
    for (const [buy, sale] of [[1000, 1500], [2499, 3995], [12000, 11000], [0, 800], [7450.5, 8999.99]]) {
      const r = calculateProfitBreakdown(input({ purchasePrice: buy, reconCost: 0, salePrice: sale }));
      const shared = calculateMarginVat(sale, buy, 0.2);
      expect(r.vat).toBeCloseTo(shared.vat, 8);
    }
  });
});

describe("standard VAT: the sale price is treated as VAT-inclusive", () => {
  it("VAT on 7,200 is 1,200 and comes off the profit", () => {
    const r = calculateProfitBreakdown(input({ treatment: "standard", salePrice: 7200 }));
    expect(r.vatBasis).toBe(7200);
    expect(r.vat).toBeCloseTo(1200, 8);
    expect(r.grossProfit).toBe(1200);
    expect(r.netProfit).toBeCloseTo(0, 8);
  });

  it("is 1/6 of the sale price at 20%, whatever the purchase price", () => {
    const cheap = calculateProfitBreakdown(input({ treatment: "standard", purchasePrice: 100, salePrice: 6000 }));
    const dear = calculateProfitBreakdown(input({ treatment: "standard", purchasePrice: 5900, salePrice: 6000 }));
    expect(cheap.vat).toBeCloseTo(1000, 8);
    expect(dear.vat).toBeCloseTo(1000, 8);
  });

  it("calls the shared calculateVat (VAT-inclusive, 20%) and not the margin function", () => {
    calculateProfitBreakdown(input({ treatment: "standard", salePrice: 7200 }));
    expect(calculateVat).toHaveBeenCalledTimes(1);
    expect(calculateVat).toHaveBeenCalledWith(7200, { vatRate: 0.2, vatIncluded: true, vatReclaimable: false });
    expect(calculateMarginVat).not.toHaveBeenCalled();
  });

  it("still charges VAT on a sale below cost (unlike the margin scheme)", () => {
    const r = calculateProfitBreakdown(input({ treatment: "standard", purchasePrice: 5000, reconCost: 0, salePrice: 4200 }));
    expect(r.vat).toBeCloseTo(700, 8);
  });
});

describe("no VAT treatment", () => {
  it("takes nothing off: net profit equals gross profit", () => {
    const r = calculateProfitBreakdown(input({ treatment: "none" }));
    expect(r.vat).toBe(0);
    expect(r.netProfit).toBe(r.grossProfit);
    expect(r.netProfit).toBe(1000);
  });

  it("does not call either VAT function", () => {
    calculateProfitBreakdown(input({ treatment: "none" }));
    expect(calculateMarginVat).not.toHaveBeenCalled();
    expect(calculateVat).not.toHaveBeenCalled();
  });
});

describe("missing and odd figures", () => {
  it("a blank sale price gives no profit, no VAT and no margin (not a loss equal to the purchase price)", () => {
    const r = calculateProfitBreakdown(input({ salePrice: "" }));
    expect(r.ready).toBe(false);
    expect(r.grossProfit).toBeNull();
    expect(r.vat).toBeNull();
    expect(r.netProfit).toBeNull();
    expect(r.marginPct).toBeNull();
    expect(r.totalCosts).toBe(6000); // the costs so far are still real
  });

  it("a blank purchase price gives no VAT and no profit (the whole sale price must not read as margin)", () => {
    const r = calculateProfitBreakdown(input({ purchasePrice: "" }));
    expect(r.ready).toBe(false);
    expect(r.vat).toBeNull();
    expect(r.netProfit).toBeNull();
    expect(calculateMarginVat).not.toHaveBeenCalled();
  });

  it("blank optional costs count as nothing", () => {
    const r = calculateProfitBreakdown({ purchasePrice: "5000", reconCost: "", partsLabour: undefined, otherCosts: null, salePrice: "7000", treatment: "margin" });
    expect(r.ready).toBe(true);
    expect(r.totalCosts).toBe(5000);
    expect(r.grossProfit).toBe(2000);
    expect(r.vat).toBeCloseTo(333.33, 2);
  });

  it("text figures typed into the form are read as numbers", () => {
    const r = calculateProfitBreakdown({ purchasePrice: "5000", reconCost: "1000", partsLabour: "0", otherCosts: "0", salePrice: "7000", treatment: "margin" });
    expect(r.vat).toBeCloseTo(333.33, 2);
    expect(r.netProfit).toBeCloseTo(666.67, 2);
  });

  it("garbage, negative and non-finite entries count as missing, never as NaN on screen", () => {
    for (const bad of ["abc", -100, "-5", NaN, Infinity]) {
      const r = calculateProfitBreakdown(input({ salePrice: bad }));
      expect(r.ready).toBe(false);
      expect(r.netProfit).toBeNull();
    }
    const r = calculateProfitBreakdown(input({ reconCost: -500 }));
    expect(r.totalCosts).toBe(5000); // a negative cost is ignored, it does not inflate profit
  });

  it("an entered 0 is a real zero, not a blank", () => {
    const r = calculateProfitBreakdown(input({ purchasePrice: 0, reconCost: 0, salePrice: 0 }));
    expect(r.ready).toBe(true);
    expect(r.grossProfit).toBe(0);
    expect(r.vat).toBe(0);
    expect(r.marginPct).toBeNull(); // 0 / 0 must not become NaN
  });

  it("margin % is gross profit over sale price, and negative on a loss", () => {
    expect(calculateProfitBreakdown(input({ purchasePrice: 4000, reconCost: 0, salePrice: 5000 })).marginPct).toBeCloseTo(20, 8);
    expect(calculateProfitBreakdown(input({ purchasePrice: 5000, reconCost: 0, salePrice: 4000 })).marginPct).toBeCloseTo(-25, 8);
  });
});

describe("toAmount", () => {
  it("reads numbers and numeric text, and treats everything else as missing", () => {
    expect(toAmount(12.5)).toBe(12.5);
    expect(toAmount("12.5")).toBe(12.5);
    expect(toAmount("0")).toBe(0);
    expect(toAmount("")).toBeNull();
    expect(toAmount("   ")).toBeNull();
    expect(toAmount(null)).toBeNull();
    expect(toAmount(undefined)).toBeNull();
    expect(toAmount("x")).toBeNull();
    expect(toAmount(-1)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats pounds with thousands separators and a leading minus", () => {
    expect(formatMoney(1234.5)).toBe("£1,234.50");
    expect(formatMoney(-333.333)).toBe("-£333.33");
    expect(formatMoney(0)).toBe("£0.00");
  });

  it("does not print -£0.00 for a value that rounds to nothing", () => {
    expect(formatMoney(-0.001)).toBe("£0.00");
    expect(formatMoney(-0)).toBe("£0.00");
  });
});
