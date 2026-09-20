import { describe, it, expect } from "vitest";
import { invoiceFigures } from "./invoiceUtils";

// What an invoice must say, worked out by hand. `sale` is what the sale form and
// the provider actually put on a sale: for "VAT on top" the salePrice is the NET
// figure typed in, for "VAT included" it is the gross, and under the margin
// scheme it is what the customer pays with the VAT inside it.
type Case = {
  name: string;
  sale: { vatScheme: "standard" | "margin"; salePrice: number; vatRate: number; vatIncluded: boolean };
  total: number;
  lines: { net: number; vat: number; ratePercent: number } | null;
};

const standard = (salePrice: number, vatRate: number, vatIncluded: boolean) =>
  ({ vatScheme: "standard", salePrice, vatRate, vatIncluded }) as const;
const margin = (salePrice: number, vatIncluded: boolean, vatRate = 0.2) =>
  ({ vatScheme: "margin", salePrice, vatRate, vatIncluded }) as const;

const cases: Case[] = [
  // ---- standard rate, VAT ADDED ON TOP: the customer pays net + VAT ----
  { name: "1,000 + 20% on top", sale: standard(1000, 0.2, false), total: 1200, lines: { net: 1000, vat: 200, ratePercent: 20 } },
  { name: "8,500 + 20% on top", sale: standard(8500, 0.2, false), total: 10200, lines: { net: 8500, vat: 1700, ratePercent: 20 } },
  { name: "100 + 5% on top", sale: standard(100, 0.05, false), total: 105, lines: { net: 100, vat: 5, ratePercent: 5 } },
  { name: "200 + 17.5% on top", sale: standard(200, 0.175, false), total: 235, lines: { net: 200, vat: 35, ratePercent: 17.5 } },
  { name: "500 + 0% on top", sale: standard(500, 0, false), total: 500, lines: { net: 500, vat: 0, ratePercent: 0 } },
  // penny rounding: 333.33 x 20% = 66.666 -> 66.67, so the total is 400.00
  { name: "333.33 + 20% on top rounds the VAT up", sale: standard(333.33, 0.2, false), total: 400, lines: { net: 333.33, vat: 66.67, ratePercent: 20 } },
  // 19.99 x 20% = 3.998 -> 4.00
  { name: "19.99 + 20% on top", sale: standard(19.99, 0.2, false), total: 23.99, lines: { net: 19.99, vat: 4, ratePercent: 20 } },
  // 4,999.99 x 20% = 999.998 -> 1,000.00
  { name: "4,999.99 + 20% on top", sale: standard(4999.99, 0.2, false), total: 5999.99, lines: { net: 4999.99, vat: 1000, ratePercent: 20 } },
  // 0.10 x 5% = 0.005: exactly half a penny rounds UP to 0.01
  { name: "0.10 + 5% on top: half a penny rounds up", sale: standard(0.1, 0.05, false), total: 0.11, lines: { net: 0.1, vat: 0.01, ratePercent: 5 } },
  // 0.02 x 20% = 0.004 -> nothing
  { name: "0.02 + 20% on top: under half a penny is dropped", sale: standard(0.02, 0.2, false), total: 0.02, lines: { net: 0.02, vat: 0, ratePercent: 20 } },

  // ---- standard rate, VAT INCLUDED: the price IS what the customer pays ----
  { name: "1,200 incl 20%", sale: standard(1200, 0.2, true), total: 1200, lines: { net: 1000, vat: 200, ratePercent: 20 } },
  // 1,000 / 6 = 166.666 -> VAT 166.67, net is the rest: 833.33
  { name: "1,000 incl 20%: VAT to the penny, net is the remainder", sale: standard(1000, 0.2, true), total: 1000, lines: { net: 833.33, vat: 166.67, ratePercent: 20 } },
  // 999.99 / 6 = 166.665 exactly half: rounds up to 166.67; net 833.32; the two add to 999.99
  { name: "999.99 incl 20%: half a penny rounds up and the lines still add up", sale: standard(999.99, 0.2, true), total: 999.99, lines: { net: 833.32, vat: 166.67, ratePercent: 20 } },
  // 5.00 x 5/105 = 0.238 -> 0.24
  { name: "5.00 incl 5%", sale: standard(5, 0.05, true), total: 5, lines: { net: 4.76, vat: 0.24, ratePercent: 5 } },
  { name: "0.01 incl 20%: VAT under half a penny", sale: standard(0.01, 0.2, true), total: 0.01, lines: { net: 0.01, vat: 0, ratePercent: 20 } },
  { name: "600 incl 0%", sale: standard(600, 0, true), total: 600, lines: { net: 600, vat: 0, ratePercent: 0 } },

  // ---- margin scheme: what the customer pays is the price, and NO VAT is shown ----
  { name: "margin 6,000 (VAT included flag true)", sale: margin(6000, true), total: 6000, lines: null },
  // the flag is meaningless under the margin scheme; it must not add 20% to the total
  { name: "margin 6,000 with the on-top flag set is still 6,000", sale: margin(6000, false), total: 6000, lines: null },
  { name: "margin 6,499.99", sale: margin(6499.99, true), total: 6499.99, lines: null },
];

describe("invoiceFigures: what the customer pays and the lines to print", () => {
  it.each(cases)("$name", ({ sale, total, lines }) => {
    const f = invoiceFigures(sale);
    expect(f.totalDue).toBeCloseTo(total, 10);
    if (lines === null) {
      expect(f.vatLines).toBeNull();
    } else {
      expect(f.vatLines).not.toBeNull();
      expect(f.vatLines!.net).toBeCloseTo(lines.net, 10);
      expect(f.vatLines!.vat).toBeCloseTo(lines.vat, 10);
      expect(f.vatLines!.ratePercent).toBe(lines.ratePercent);
    }
  });

  it("the printed Net and VAT lines always add up to the total, to the penny", () => {
    for (const included of [true, false]) {
      for (const rate of [0, 0.05, 0.2]) {
        for (let pence = 1; pence <= 3000; pence += 7) {
          const f = invoiceFigures(standard(pence / 100, rate, included));
          const sum = Math.round(f.vatLines!.net * 100) + Math.round(f.vatLines!.vat * 100);
          expect(sum, `${pence}p at ${rate} included=${included}`).toBe(Math.round(f.totalDue! * 100));
        }
      }
    }
  });

  it("a VAT-on-top sale is never billed at the bare net price (the bug: 1,000 + 20% asked for 1,000)", () => {
    const f = invoiceFigures(standard(1000, 0.2, false));
    expect(f.totalDue).toBe(1200);
    expect(f.totalDue).not.toBe(1000);
  });

  it("the margin scheme never carries a VAT line, whatever is stored on the sale", () => {
    for (const included of [true, false]) {
      for (const rate of [0, 0.2]) {
        expect(invoiceFigures(margin(6000, included, rate)).vatLines).toBeNull();
      }
    }
  });

  it("says which scheme it worked under, and treats anything else as standard", () => {
    expect(invoiceFigures(margin(6000, true)).scheme).toBe("margin");
    expect(invoiceFigures(standard(6000, 0.2, true)).scheme).toBe("standard");
    expect(invoiceFigures({ ...standard(6000, 0.2, true), vatScheme: "weird" as never }).scheme).toBe("standard");
  });

  it("puts the price as typed on the vehicle line: net for on-top, gross for included, the price for margin", () => {
    expect(invoiceFigures(standard(1000, 0.2, false)).itemAmount).toBe(1000);
    expect(invoiceFigures(standard(1200, 0.2, true)).itemAmount).toBe(1200);
    expect(invoiceFigures(margin(6000, true)).itemAmount).toBe(6000);
  });

  it("has no total, no lines and no line amount when the price is blank, zero, negative or unreadable", () => {
    for (const price of [0, -5, NaN, Infinity, -Infinity, undefined, null, "1000" as unknown as number]) {
      for (const scheme of [standard(1, 0.2, false), standard(1, 0.2, true), margin(1, true)]) {
        const f = invoiceFigures({ ...scheme, salePrice: price as number });
        expect(f.totalDue, String(price)).toBeNull();
        expect(f.itemAmount, String(price)).toBeNull();
        expect(f.vatLines, String(price)).toBeNull();
      }
    }
  });

  it("has no total when a standard sale's VAT rate is unreadable, negative or over 100% (never guesses 0%)", () => {
    for (const rate of [NaN, -0.2, 1.5, undefined, null, "0.2" as unknown as number]) {
      const f = invoiceFigures({ ...standard(1000, 0.2, false), vatRate: rate as number });
      expect(f.totalDue, String(rate)).toBeNull();
      expect(f.vatLines, String(rate)).toBeNull();
    }
  });

  it("a margin sale does not need a VAT rate to be billed", () => {
    expect(invoiceFigures({ ...margin(6000, true), vatRate: NaN }).totalDue).toBe(6000);
  });

  it("does not change what it is given", () => {
    const sale = standard(1000, 0.2, false);
    const before = JSON.stringify(sale);
    invoiceFigures(sale);
    expect(JSON.stringify(sale)).toBe(before);
  });
});
