export function pricingPressureEngine(vehicle: any, marketAvg: number): "undervalued" | "fair" | "overpriced" {
  const price = vehicle.sellPrice ?? vehicle.valuation ?? marketAvg;

  const delta = price - marketAvg;

  if (delta < -300) return "undervalued";
  if (delta > 700) return "overpriced";
  return "fair";
}
