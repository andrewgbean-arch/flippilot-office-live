import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
export function profitabilitySimulator(
  vehicle: FlipRecord,
  adjustments: {
    priceChange?: number;
    reconCost?: number;
    aprChange?: number;
    depositChange?: number;
  }
) {
  const baseSell = vehicle.sellPrice ?? vehicle.valuation ?? 0;
  const baseBuy = vehicle.buyPrice ?? 0;

  const newSell = baseSell + (adjustments.priceChange ?? 0);
  const recon = adjustments.reconCost ?? 0;

  const profit = newSell - baseBuy - recon;

  const aprImpact = adjustments.aprChange ? adjustments.aprChange * 12 : 0;
  const depositImpact = adjustments.depositChange ?? 0;

  return {
    originalProfit: baseSell - baseBuy,
    newProfit: profit,
    aprImpact,
    depositImpact,
    recommendation:
      profit > 1500
        ? "Strong profit — list immediately"
        : profit > 800
        ? "Good profit — proceed"
        : profit > 300
        ? "Moderate — consider price boost"
        : "Weak — consider wholesale",
  };
}
