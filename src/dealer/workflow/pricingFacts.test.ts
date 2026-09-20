import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types/Vehicle";
import type { CostEntry, PurchaseEntry, SaleEntry } from "@/bookkeeping/types";
import { computePricingFacts } from "./pricingFacts";

const NOW = new Date("2026-09-20T12:00:00Z");

function car(over: Partial<Pick<Vehicle, "priceRetail" | "priceTrade" | "status" | "createdAt">> = {}): Vehicle {
  return { id: "v1", make: "Ford", model: "Fiesta", status: "in stock", priceRetail: null, priceTrade: null, ...over } as unknown as Vehicle;
}
const purchase = (price: number): PurchaseEntry => ({ id: "p", vehicleId: "v1", purchasePrice: price, date: "2026-08-01" } as PurchaseEntry);
const cost = (amount: number): CostEntry => ({ id: `c${amount}`, vehicleId: "v1", type: "recon", amount } as CostEntry);
const sale = (price: number, date = "2026-09-10"): SaleEntry => ({ id: "s", vehicleId: "v1", salePrice: price, date } as SaleEntry);

describe("computePricingFacts", () => {
  it("works the margin out from the asking price, the purchase and the costs logged: no x1.35 valuation", () => {
    const f = computePricingFacts(car({ priceRetail: 6000 }), purchase(4000), [cost(300), cost(200)], undefined, NOW);
    expect(f.asking).toBe(6000);
    expect(f.cost).toEqual({ amount: 4000, source: "purchase" });
    expect(f.costsLogged).toBe(500);
    expect(f.costsCount).toBe(2);
    expect(f.totalCost).toBe(4500);
    expect(f.margin).toBe(1500);
    expect(f.marginPercent).toBe(25); // 1500 / 6000
  });

  it("does not make up a valuation from the purchase price", () => {
    const f = computePricingFacts(car({ priceRetail: null }), purchase(4000), [], undefined, NOW);
    expect(f.asking).toBeNull();
    expect(f.margin).toBeNull();
    expect(f.marginPercent).toBeNull();
    // 4000 * 1.35 = 5400 must not appear anywhere
    expect(JSON.stringify(f)).not.toContain("5400");
  });

  it("uses the vehicle's trade price when there is no purchase in Bookkeeping, and says where it came from", () => {
    const f = computePricingFacts(car({ priceRetail: 5000, priceTrade: 3500 }), undefined, [cost(250)], undefined, NOW);
    expect(f.cost).toEqual({ amount: 3500, source: "vehicle" });
    expect(f.totalCost).toBe(3750);
    expect(f.margin).toBe(1250);
  });

  it("prefers the Bookkeeping purchase over the vehicle's trade price", () => {
    const f = computePricingFacts(car({ priceRetail: 5000, priceTrade: 3500 }), purchase(3800), [], undefined, NOW);
    expect(f.cost).toEqual({ amount: 3800, source: "purchase" });
  });

  it("gives no margin at all when the buying price is unknown, rather than treating it as £0", () => {
    const f = computePricingFacts(car({ priceRetail: 5000, priceTrade: 0 }), undefined, [cost(250)], undefined, NOW);
    expect(f.cost).toBeNull();
    expect(f.totalCost).toBeNull();
    expect(f.margin).toBeNull();
    expect(f.costsLogged).toBe(250); // still reported: it is a real fact
  });

  it("counts a £0 purchase (a gift or part-exchange) as a real cost", () => {
    const f = computePricingFacts(car({ priceRetail: 2000 }), purchase(0), [], undefined, NOW);
    expect(f.cost).toEqual({ amount: 0, source: "purchase" });
    expect(f.margin).toBe(2000);
  });

  it("shows a loss as a negative margin", () => {
    const f = computePricingFacts(car({ priceRetail: 3000 }), purchase(3500), [], undefined, NOW);
    expect(f.margin).toBe(-500);
    expect(f.marginPercent).toBe(-17); // -500 / 3000, rounded
  });

  it("reports the actual profit of a sold car from the sale, not the asking price", () => {
    const f = computePricingFacts(car({ priceRetail: 6000, status: "sold" }), purchase(4000), [cost(500)], sale(5500), NOW);
    expect(f.sale).toEqual({ price: 5500, date: "2026-09-10" });
    expect(f.saleProfit).toBe(1000); // 5500 - 4000 - 500
    expect(f.daysInStock).toBeNull(); // a sold car isn't "in stock"
  });

  it("counts days in stock for an unsold car from its date added, and gives null when there is none", () => {
    const added = new Date(NOW.getTime() - 12 * 86_400_000).toISOString();
    expect(computePricingFacts(car({ createdAt: added }), undefined, [], undefined, NOW).daysInStock).toBe(12);
    expect(computePricingFacts(car(), undefined, [], undefined, NOW).daysInStock).toBeNull();
  });

  it("sums only real costs and ignores an unreadable amount", () => {
    const bad = { id: "x", vehicleId: "v1", type: "misc", amount: Number.NaN } as CostEntry;
    const f = computePricingFacts(car(), purchase(1000), [cost(100), bad], undefined, NOW);
    expect(f.costsLogged).toBe(100);
    expect(f.totalCost).toBe(1100);
  });
});
