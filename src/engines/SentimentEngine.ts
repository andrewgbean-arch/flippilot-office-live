export function sentimentEngine(vehicle: any): number {
  const flipScore = vehicle.flipScore ?? 50;
  const priceDelta = (vehicle.sellPrice ?? vehicle.valuation ?? 0) - (vehicle.marketAvg ?? 0);

  let sentiment = flipScore;

  if (priceDelta < 0) sentiment += 10;
  if (priceDelta > 500) sentiment -= 10;

  return Math.min(100, Math.max(0, sentiment));
}
