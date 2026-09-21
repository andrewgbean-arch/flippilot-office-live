import type { CostEntry, PurchaseEntry, SaleEntry } from "./types";
import { isPositiveAmount } from "@/lib/parseMoney";

// The four headline figures on the Bookkeeping hub, kept free of React.
//
// The hub used to define "Total Profit" as ALL sales minus ALL spend, which
// counts every car still on the forecourt as money lost: a dealer with a full
// stock saw a large negative profit while the dashboard (which uses each sold
// car's own purchase price and costs) said they were in profit. Its "Avg
// Margin" divided that figure by spend, and "Active Flips" was actually the
// number of SALES.
//
// Profit here is worked out the way `getProfitForVehicle` in the provider does
// it, one sold car at a time: sale price, less that car's purchase price, less
// the costs logged against it. Both use `carProfit` below, so there is ONE
// definition of a car's profit and margin.
//
// A sale with no purchase recorded (a CSV import only creates the stock row)
// can't be worked out, so it is left OUT and counted, never quietly treated as
// pure profit or as zero. "No purchase recorded" also covers a purchase whose
// price is not a real number above zero: a blank that was once saved as 0, or a
// price that could not be read and was saved as nothing. Counting that as a £0
// cost made the whole sale price look like profit (a £5,000 sale showed £5,000
// profit and a 100% margin on a car that really made £500), so it is treated
// exactly like a missing purchase: profit unknown, left out, and counted.
//
// The same goes for the SALE price. A sale saved with no usable price (the £0 the old
// form saved for a blank, or a price that was saved as nothing or as text) is not a
// sale of £0: counting it as one turned a £4,000 purchase into a reported £4,000 loss
// while the invoice page for that very sale said "No Price Recorded". So a sale whose
// price is not a real amount above zero is left out too, and counted apart
// (soldWithoutPrice), never worked out.

export interface HubTotals {
  // Every purchase price plus every cost, on cars sold or not: money that has
  // gone out of the business.
  spend: number;
  // Sold cars only: sale price - purchase price - that car's costs.
  profit: number;
  // The sale prices of the sold cars that `profit` covers.
  revenue: number;
  // profit / revenue as a percentage, or null when no sold car can be worked out.
  marginPercent: number | null;
  soldCounted: number;
  // Sales with no purchase on record, or with a purchase price that is not a
  // real amount above zero: left out of profit and margin.
  soldWithoutPurchase: number;
  // Sales with a real purchase but a sale price that is not a real amount above zero:
  // left out of profit and margin.
  soldWithoutPrice: number;
  // Cars bought that have no sale yet.
  boughtNotSold: number;
}

const amount = (value: number): number => (Number.isFinite(value) ? value : 0);

export interface CarProfit {
  profit: number;
  // profit / sale price as a percentage. The sale price is above zero for any car
  // that can be worked out, so this is always a real number.
  margin: number;
}

// One sold car's profit and margin, or null when it cannot be worked out because its
// purchase price or its sale price is not recorded (missing, or not a finite number
// above zero). The ONE definition, used by the provider's getProfitForVehicle and by
// hubTotals, so a car's figure is the same on every screen.
export function carProfit(purchasePrice: unknown, salePrice: unknown, costs: unknown): CarProfit | null {
  if (!isPositiveAmount(purchasePrice)) return null;
  if (!isPositiveAmount(salePrice)) return null;
  const spent = typeof costs === "number" ? amount(costs) : 0;
  const profit = salePrice - purchasePrice - spent;
  return { profit, margin: (profit / salePrice) * 100 };
}

export function hubTotals(
  purchases: readonly PurchaseEntry[],
  sales: readonly SaleEntry[],
  costs: readonly CostEntry[]
): HubTotals {
  // Only a real purchase price counts as money out; an unreadable or blank one is
  // not a price and adds nothing.
  const spend =
    costs.reduce((sum, c) => sum + amount(c.amount), 0) +
    purchases.reduce((sum, p) => sum + (isPositiveAmount(p.purchasePrice) ? p.purchasePrice : 0), 0);

  // One purchase and one sale per car (the first of each), and one set of
  // costs per car, exactly as `getProfitForVehicle` finds them.
  const firstPurchase = new Map<string, PurchaseEntry>();
  for (const p of purchases) if (!firstPurchase.has(p.vehicleId)) firstPurchase.set(p.vehicleId, p);

  const costsByCar = new Map<string, number>();
  for (const c of costs) costsByCar.set(c.vehicleId, (costsByCar.get(c.vehicleId) ?? 0) + amount(c.amount));

  const firstSale = new Map<string, SaleEntry>();
  for (const s of sales) if (!firstSale.has(s.vehicleId)) firstSale.set(s.vehicleId, s);

  let profit = 0;
  let revenue = 0;
  let soldCounted = 0;
  let soldWithoutPurchase = 0;
  let soldWithoutPrice = 0;
  for (const [vehicleId, sale] of firstSale) {
    const purchase = firstPurchase.get(vehicleId);
    if (!purchase || !isPositiveAmount(purchase.purchasePrice)) {
      soldWithoutPurchase += 1;
      continue;
    }
    const car = carProfit(purchase.purchasePrice, sale.salePrice, costsByCar.get(vehicleId) ?? 0);
    if (!car) {
      soldWithoutPrice += 1;
      continue;
    }
    profit += car.profit;
    revenue += amount(sale.salePrice);
    soldCounted += 1;
  }

  let boughtNotSold = 0;
  for (const vehicleId of firstPurchase.keys()) if (!firstSale.has(vehicleId)) boughtNotSold += 1;

  return {
    spend,
    profit,
    revenue,
    marginPercent: revenue > 0 ? (profit / revenue) * 100 : null,
    soldCounted,
    soldWithoutPurchase,
    soldWithoutPrice,
    boughtNotSold,
  };
}

// The line under "Profit on sold cars" saying which sales were left out and why, or
// null when none were.
export function leftOutNote(totals: Pick<HubTotals, "soldWithoutPurchase" | "soldWithoutPrice">): string | null {
  const noPurchase = totals.soldWithoutPurchase;
  const noPrice = totals.soldWithoutPrice;
  const sales = (n: number) => `${n} sale${n === 1 ? " has" : "s have"}`;
  if (noPurchase > 0 && noPrice > 0) {
    return `${sales(noPurchase)} no purchase recorded and ${sales(noPrice)} no sale price recorded, so ${
      noPurchase + noPrice === 2 ? "both are" : "all of them are"
    } left out`;
  }
  if (noPurchase > 0) return `${sales(noPurchase)} no purchase recorded and ${noPurchase === 1 ? "is" : "are"} left out`;
  if (noPrice > 0) return `${sales(noPrice)} no sale price recorded and ${noPrice === 1 ? "is" : "are"} left out`;
  return null;
}
