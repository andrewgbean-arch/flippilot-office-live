import type { CostEntry, SaleEntry } from "@/bookkeeping/types";

// What the dealer has really spent, on average, on cars they have already
// sold. This replaces an "AI Recon Estimate" that was the car's mileage
// divided by ten (62,000 miles read as £6,200, and a car with no mileage
// recorded read as £6,000), which is not an estimate of anything.

// Fewer sold cars than this and an average would be one or two jobs dressed up
// as a pattern, so nothing is shown.
export const MIN_SOLD_CARS = 3;

export interface SoldCarSpend {
  // Mean of the costs logged against each sold car; null below MIN_SOLD_CARS.
  average: number | null;
  // How many sold cars the figure is over: those with at least one cost
  // logged. A sold car with no costs logged is left out, since that is
  // "nothing recorded", not "nothing spent".
  counted: number;
}

export function averageSpendOnSoldCars(costs: readonly CostEntry[], sales: readonly SaleEntry[]): SoldCarSpend {
  const soldIds = new Set(sales.map(s => s.vehicleId));

  const perCar = new Map<string, number>();
  for (const cost of costs) {
    if (!soldIds.has(cost.vehicleId)) continue;
    const amount = Number.isFinite(cost.amount) ? cost.amount : 0;
    perCar.set(cost.vehicleId, (perCar.get(cost.vehicleId) ?? 0) + amount);
  }

  const counted = perCar.size;
  if (counted < MIN_SOLD_CARS) return { average: null, counted };
  const total = [...perCar.values()].reduce((sum, n) => sum + n, 0);
  return { average: total / counted, counted };
}
