import { describe, it, expect } from "vitest";
import { purchaseVatSettings, normalisePurchaseVat, normalisePurchases, isMarginPurchase } from "./purchaseVat";
import type { PurchaseEntry } from "./types";

// A margin-scheme purchase has no VAT invoice, so no VAT: there is none to
// reclaim and none to show. The forms used to store 20% "included" VAT on a
// margin purchase (1,000 on a 6,000 purchase) that then showed in the vehicle
// ledger, on the supplier pages and in the purchases CSV.

const purchase = (over: Partial<PurchaseEntry> = {}): PurchaseEntry => ({
  id: "p1",
  vehicleId: "v1",
  purchasePrice: 6000,
  source: "Auction",
  date: "2026-03-01",
  vatRate: 0.2,
  vatIncluded: true,
  vatAmount: 1000,
  netAmount: 5000,
  ...over,
});

describe("purchaseVatSettings: what a purchase is SAVED with for the scheme chosen", () => {
  it("margin forces rate 0 and not-included, whatever was typed", () => {
    expect(purchaseVatSettings("margin", 0.2, true)).toEqual({ vatRate: 0, vatIncluded: false });
    expect(purchaseVatSettings("margin", 0.05, false)).toEqual({ vatRate: 0, vatIncluded: false });
    expect(purchaseVatSettings("margin", 0, true)).toEqual({ vatRate: 0, vatIncluded: false });
  });

  it("standard keeps exactly what was typed", () => {
    expect(purchaseVatSettings("standard", 0.2, true)).toEqual({ vatRate: 0.2, vatIncluded: true });
    expect(purchaseVatSettings("standard", 0.05, false)).toEqual({ vatRate: 0.05, vatIncluded: false });
    expect(purchaseVatSettings("standard", 0, true)).toEqual({ vatRate: 0, vatIncluded: true });
  });
});

describe("normalisePurchaseVat: an in-memory correction for margin purchases saved with phantom VAT", () => {
  it("a margin car's purchase saved with 20% included (1,000 VAT on 6,000) reads as no VAT, net = price", () => {
    const fixed = normalisePurchaseVat(purchase(), "margin");
    expect(fixed).toMatchObject({
      vatScheme: "margin",
      vatRate: 0,
      vatIncluded: false,
      vatAmount: 0,
      netAmount: 6000,
      purchasePrice: 6000,
    });
  });

  it("keeps everything else about the purchase", () => {
    const fixed = normalisePurchaseVat(purchase({ source: "BCA", date: "2026-02-02", id: "px" }), "margin");
    expect(fixed).toMatchObject({ id: "px", vehicleId: "v1", source: "BCA", date: "2026-02-02" });
  });

  it("does not touch a standard-scheme purchase: its VAT invoice is real", () => {
    const p = purchase();
    expect(normalisePurchaseVat(p, "standard")).toBe(p);
  });

  it("does not touch a purchase when the car's scheme is unknown (car deleted, or never set)", () => {
    const p = purchase();
    expect(normalisePurchaseVat(p, undefined)).toBe(p);
    expect(normalisePurchaseVat(p, null)).toBe(p);
    expect(normalisePurchaseVat(p, "trade")).toBe(p); // a legacy value nothing ever set
  });

  it("a purchase's own scheme wins over the car's current one", () => {
    const standardBought = purchase({ vatScheme: "standard" });
    expect(normalisePurchaseVat(standardBought, "margin")).toBe(standardBought); // the car was edited later
    const marginBought = purchase({ vatScheme: "margin" });
    expect(normalisePurchaseVat(marginBought, "standard")).toMatchObject({ vatScheme: "margin", vatAmount: 0, vatRate: 0 });
  });

  it("is idempotent: fixing an already-fixed purchase gives back the SAME object, and twice equals once", () => {
    const once = normalisePurchaseVat(purchase(), "margin");
    const twice = normalisePurchaseVat(once, "margin");
    expect(twice).toBe(once);
    expect(twice).toEqual(once);
    expect(normalisePurchaseVat(twice, undefined)).toBe(twice);
  });

  it("a purchase the forms save today (margin, no VAT) is already right and is returned unchanged", () => {
    const already = purchase({ vatScheme: "margin", vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 6000 });
    expect(normalisePurchaseVat(already, "margin")).toBe(already);
  });

  it("fixes a purchase that says margin but still carries VAT", () => {
    const wrong = purchase({ vatScheme: "margin" });
    const fixed = normalisePurchaseVat(wrong, "margin");
    expect(fixed).not.toBe(wrong);
    expect(fixed).toMatchObject({ vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 6000 });
  });

  it("does not change the object it is given (nothing stored is rewritten)", () => {
    const p = purchase();
    const before = JSON.stringify(p);
    normalisePurchaseVat(p, "margin");
    expect(JSON.stringify(p)).toBe(before);
    expect(p.vatAmount).toBe(1000); // still what was stored
  });
});

describe("normalisePurchases: the whole ledger", () => {
  const vehicles = [
    { id: "v1", vatScheme: "margin" },
    { id: "v2", vatScheme: "standard" },
    { id: "v3" },
  ];
  const ledger = [
    purchase({ id: "a", vehicleId: "v1" }),
    purchase({ id: "b", vehicleId: "v2" }),
    purchase({ id: "c", vehicleId: "v3" }),
    purchase({ id: "d", vehicleId: "gone" }),
    purchase({ id: "e", vehicleId: "v1", purchasePrice: 4000, vatAmount: 666.67, netAmount: 3333.33 }),
  ];

  it("removes the VAT from margin cars' purchases only", () => {
    const out = normalisePurchases(ledger, vehicles);
    expect(out.map((p) => p.vatAmount)).toEqual([0, 1000, 1000, 1000, 0]);
    expect(out.map((p) => p.netAmount)).toEqual([6000, 5000, 5000, 5000, 4000]);
  });

  it("returns the untouched purchases as the same objects", () => {
    const out = normalisePurchases(ledger, vehicles);
    expect(out[1]).toBe(ledger[1]);
    expect(out[2]).toBe(ledger[2]);
    expect(out[3]).toBe(ledger[3]);
    expect(out[0]).not.toBe(ledger[0]);
  });

  it("is idempotent over the whole ledger", () => {
    const once = normalisePurchases(ledger, vehicles);
    const twice = normalisePurchases(once, vehicles);
    expect(twice).toEqual(once);
    twice.forEach((p, i) => expect(p).toBe(once[i]));
  });

  it("leaves the stored ledger exactly as it was", () => {
    const before = JSON.stringify(ledger);
    normalisePurchases(ledger, vehicles);
    expect(JSON.stringify(ledger)).toBe(before);
  });

  it("copes with no purchases and no vehicles", () => {
    expect(normalisePurchases([], vehicles)).toEqual([]);
    expect(normalisePurchases(ledger, [])).toEqual(ledger);
  });
});

describe("isMarginPurchase", () => {
  it("is true only for a purchase that says margin", () => {
    expect(isMarginPurchase(purchase({ vatScheme: "margin" }))).toBe(true);
    expect(isMarginPurchase(purchase({ vatScheme: "standard" }))).toBe(false);
    expect(isMarginPurchase(purchase())).toBe(false);
  });
});
