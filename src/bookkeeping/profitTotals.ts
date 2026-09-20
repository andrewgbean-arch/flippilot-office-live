import type { CostEntry, PurchaseEntry, SaleEntry } from "./types";

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
// the costs logged against it. A sale with no purchase recorded (a CSV import
// only creates the stock row) can't be worked out, so it is left OUT and
// counted, never quietly treated as pure profit or as zero.

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
  // Sales with no purchase on record: left out of profit and margin.
  soldWithoutPurchase: number;
  // Cars bought that have no sale yet.
  boughtNotSold: number;
}

const amount = (value: number): number => (Number.isFinite(value) ? value : 0);

export function hubTotals(
  purchases: readonly PurchaseEntry[],
  sales: readonly SaleEntry[],
  costs: readonly CostEntry[]
): HubTotals {
  const spend =
    costs.reduce((sum, c) => sum + amount(c.amount), 0) + purchases.reduce((sum, p) => sum + amount(p.purchasePrice), 0);

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
  for (const [vehicleId, sale] of firstSale) {
    const purchase = firstPurchase.get(vehicleId);
    if (!purchase) {
      soldWithoutPurchase += 1;
      continue;
    }
    profit += amount(sale.salePrice) - amount(purchase.purchasePrice) - (costsByCar.get(vehicleId) ?? 0);
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
    boughtNotSold,
  };
}
