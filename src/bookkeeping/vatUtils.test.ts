import { describe, it, expect } from "vitest";
import { calculateVat, calculateMarginVat } from "./vatUtils";

// This module is the single highest-stakes piece of logic in the app:
// it's the actual tax figure a real UK dealer would report to HMRC.
// A silent regression here isn't a UI glitch, it's wrong tax on a real
// invoice — worth locking down thoroughly.

describe("calculateVat (standard VAT)", () => {
  it("extracts VAT from a VAT-inclusive amount at 20%", () => {
    const result = calculateVat(1200, { vatRate: 0.2, vatIncluded: true, vatReclaimable: true });
    expect(result.net).toBeCloseTo(1000, 5);
    expect(result.vat).toBeCloseTo(200, 5);
    expect(result.gross).toBe(1200);
  });

  it("adds VAT on top of a VAT-exclusive amount at 20%", () => {
    const result = calculateVat(1000, { vatRate: 0.2, vatIncluded: false, vatReclaimable: true });
    expect(result.net).toBe(1000);
    expect(result.vat).toBeCloseTo(200, 5);
    expect(result.gross).toBeCloseTo(1200, 5);
  });

  it("produces zero VAT at a 0% rate regardless of vatIncluded", () => {
    expect(calculateVat(500, { vatRate: 0, vatIncluded: true, vatReclaimable: false }).vat).toBe(0);
    expect(calculateVat(500, { vatRate: 0, vatIncluded: false, vatReclaimable: false }).vat).toBe(0);
  });

  it("handles a zero amount without dividing by zero or NaN-ing", () => {
    const result = calculateVat(0, { vatRate: 0.2, vatIncluded: true, vatReclaimable: true });
    expect(result.net).toBe(0);
    expect(result.vat).toBe(0);
    expect(result.gross).toBe(0);
  });

  it("matches the real-world regression this session found: £2000 purchase at 20% VAT-included gives £333.33 VAT / £1666.67 net, not £952/£47 from a raw-percentage bug", () => {
    const result = calculateVat(2000, { vatRate: 0.2, vatIncluded: true, vatReclaimable: true });
    expect(result.vat).toBeCloseTo(333.33, 2);
    expect(result.net).toBeCloseTo(1666.67, 2);
  });
});

describe("calculateMarginVat (UK VAT Margin Scheme)", () => {
  it("charges VAT only on the margin, not the sale price, at the standard 20% rate", () => {
    // The exact scenario verified live in the browser this session.
    const result = calculateMarginVat(3000, 2000, 0.2);
    expect(result.margin).toBe(1000);
    expect(result.vat).toBeCloseTo(166.67, 2);
    expect(result.net).toBeCloseTo(833.33, 2);
  });

  it("is nil when the vehicle sells at a loss, never negative", () => {
    const result = calculateMarginVat(1500, 2000, 0.2);
    expect(result.margin).toBe(0);
    expect(result.vat).toBe(0);
    expect(result.net).toBe(0);
  });

  it("is nil when sale price exactly equals purchase price (break-even)", () => {
    const result = calculateMarginVat(2000, 2000, 0.2);
    expect(result.margin).toBe(0);
    expect(result.vat).toBe(0);
  });

  it("is exactly 1/6 of the margin at the standard 20% rate", () => {
    const result = calculateMarginVat(6000, 0, 0.2);
    expect(result.margin).toBe(6000);
    expect(result.vat).toBeCloseTo(1000, 5); // 6000 / 6
  });

  it("produces zero VAT at a 0% rate even with a real margin", () => {
    const result = calculateMarginVat(5000, 2000, 0);
    expect(result.margin).toBe(3000);
    expect(result.vat).toBe(0);
    expect(result.net).toBe(3000);
  });

  it("scales correctly at the 5% reduced rate", () => {
    const result = calculateMarginVat(3000, 2000, 0.05);
    expect(result.margin).toBe(1000);
    expect(result.vat).toBeCloseTo(1000 * (0.05 / 1.05), 5);
  });
});
