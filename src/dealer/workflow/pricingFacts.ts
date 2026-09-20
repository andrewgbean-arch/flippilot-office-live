import type { Vehicle } from "@/types/Vehicle";
import type { CostEntry, PurchaseEntry, SaleEntry } from "@/bookkeeping/types";
import { daysInStock, isSold } from "@/dealer/inventory/vehicleListModel";

// What the Pricing Workflow shows for one car: only what the dealer recorded.
// It used to print an "AI Valuation Engine" (a retail value of purchase price
// x 1.35 and a trade value of x 1.15), "market heat", "demand" and
// "competitiveness" bars, and a "profit projection" built on those made-up
// values. Nothing in the app knows a car's market value, so those are gone;
// what is left is the arithmetic on the prices and costs the dealer entered.

export type CostSource = "purchase" | "vehicle";

export interface PricingFacts {
  // The price the dealer is asking, or null when none is entered.
  asking: number | null;
  // What the car cost: the Bookkeeping purchase if there is one, else the
  // trade price on the vehicle record. null when neither is recorded.
  cost: { amount: number; source: CostSource } | null;
  // Everything logged against the car in Bookkeeping (recon, parts, fees).
  costsLogged: number;
  costsCount: number;
  // cost + costsLogged; null while the buying price is unknown.
  totalCost: number | null;
  // asking price minus totalCost; null when either is unknown.
  margin: number | null;
  // margin as a whole-number share of the asking price.
  marginPercent: number | null;
  // Set once the car has a sale recorded.
  sale: { price: number; date: string | null } | null;
  // sale price minus totalCost, for a sold car whose cost is known.
  saleProfit: number | null;
  // Whole days since the car was added; null once sold or when there is no date added.
  daysInStock: number | null;
}

function positive(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function computePricingFacts(
  vehicle: Vehicle,
  purchase: PurchaseEntry | undefined,
  costs: readonly CostEntry[],
  sale: SaleEntry | undefined,
  now: Date
): PricingFacts {
  const asking = positive(vehicle.priceRetail) ? vehicle.priceRetail : null;

  // A purchase of £0 is a real purchase (a gift, a part-exchange), so it counts;
  // a trade price of 0 on the vehicle record means "not entered", so it doesn't.
  const cost: PricingFacts["cost"] =
    purchase && typeof purchase.purchasePrice === "number" && Number.isFinite(purchase.purchasePrice) && purchase.purchasePrice >= 0
      ? { amount: purchase.purchasePrice, source: "purchase" }
      : positive(vehicle.priceTrade)
      ? { amount: vehicle.priceTrade, source: "vehicle" }
      : null;

  const costsLogged = costs.reduce((sum, c) => sum + (Number.isFinite(c.amount) ? c.amount : 0), 0);
  const totalCost = cost === null ? null : cost.amount + costsLogged;
  const margin = asking !== null && totalCost !== null ? asking - totalCost : null;

  const soldPrice = sale && positive(sale.salePrice) ? sale.salePrice : null;

  return {
    asking,
    cost,
    costsLogged,
    costsCount: costs.length,
    totalCost,
    margin,
    marginPercent: margin !== null && asking !== null ? Math.round((margin / asking) * 100) : null,
    sale: sale && soldPrice !== null ? { price: soldPrice, date: sale.date || null } : null,
    saleProfit: soldPrice !== null && totalCost !== null ? soldPrice - totalCost : null,
    daysInStock: isSold(vehicle) || sale ? null : daysInStock(vehicle.createdAt, now),
  };
}
