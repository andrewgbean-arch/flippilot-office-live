import { describe, expect, it } from "vitest";
import { costValue } from "./costBasis";
import { costValue as serverCostValue } from "../backend/src/engines/costBasis";
import { hubTotals } from "./profitTotals";
import type { CostEntry, PurchaseEntry, SaleEntry } from "./types";

// One car, one profit. The hub, the ledger, the car's own Profit tab and Pilot Brain all read a
// car's costs through costValue, so a £480 tyre bill with £80 of reclaimable VAT is £400 everywhere.

const tyre = (over: Record<string, unknown> = {}) => ({
  amount: 480,
  vatRate: 0.2,
  vatIncluded: true,
  vatReclaimable: true,
  vatAmount: 80,
  netAmount: 400,
  ...over,
});

describe("what a cost really costs", () => {
  it("leaves out VAT the dealer can claim back", () => {
    expect(costValue(tyre())).toBeCloseTo(400, 10);
  });

  it("counts VAT the dealer cannot claim back", () => {
    expect(costValue(tyre({ vatReclaimable: false }))).toBeCloseTo(480, 10);
  });

  it("counts VAT added on top of a bill that cannot be claimed back", () => {
    expect(costValue({ amount: 400, vatIncluded: false, vatReclaimable: false, vatAmount: 80, netAmount: 400 })).toBeCloseTo(480, 10);
  });

  it("takes a refund off by the same rule", () => {
    expect(costValue(tyre({ amount: -120, vatAmount: -20, netAmount: -100 }))).toBeCloseTo(-100, 10);
  });

  it("reads an older record with no VAT split as typed", () => {
    expect(costValue({ amount: 150 })).toBe(150);
    expect(costValue({ amount: 150, vatReclaimable: true })).toBe(150);
  });

  it("is unknown (null) when the amount itself is not a number", () => {
    for (const bad of [undefined, null, "120", NaN, Infinity]) expect(costValue({ amount: bad, netAmount: 1, vatAmount: 1, vatReclaimable: true })).toBeNull();
    expect(costValue(null)).toBeNull();
  });

  it("is the same function on the server", () => {
    const cases: unknown[] = [
      tyre(),
      tyre({ vatReclaimable: false }),
      { amount: 150 },
      { amount: NaN },
      { amount: 400, vatAmount: 80, netAmount: 400, vatReclaimable: false },
      { amount: -120, vatAmount: -20, netAmount: -100, vatReclaimable: true },
      null,
    ];
    for (const c of cases) expect(serverCostValue(c)).toEqual(costValue(c));
  });
});

describe("the hub's profit for a car", () => {
  const purchase = { id: "p1", vehicleId: "v1", purchasePrice: 4000, source: "Auction", date: "2026-03-01", vatScheme: "margin", vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 4000 } as unknown as PurchaseEntry;
  const sale = { id: "s1", vehicleId: "v1", salePrice: 5000, invoiceNumber: "INV-1", date: "2026-03-10", vatScheme: "margin", vatRate: 0.2, vatIncluded: false, vatAmount: 166.67, netAmount: 4833.33, marginPurchasePrice: 4000 } as unknown as SaleEntry;
  const cost = (over: Record<string, unknown>) => ({ id: "c1", vehicleId: "v1", type: "parts", date: "2026-03-05", ...tyre(), ...over }) as unknown as CostEntry;

  it("takes reclaimable VAT out of the cost, matching the car's Profit tab", () => {
    expect(hubTotals([purchase], [sale], [cost({})]).profit).toBeCloseTo(5000 - 4000 - 400, 6);
  });

  it("keeps non-reclaimable VAT in the cost", () => {
    expect(hubTotals([purchase], [sale], [cost({ vatReclaimable: false })]).profit).toBeCloseTo(5000 - 4000 - 480, 6);
  });

  it("still shows money spent as the amount paid", () => {
    expect(hubTotals([purchase], [sale], [cost({})]).spend).toBe(4480);
  });
});
