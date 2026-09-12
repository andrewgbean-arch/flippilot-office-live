// -------------------------------
// Supernova Dealer Risk Engine V3
// -------------------------------

export function computeRiskScore(vehicle: any): number {
  const mileage = vehicle.mileage ?? 0;
  const advisories = vehicle.mot?.advisories?.length ?? 0;
  const failures = vehicle.mot?.failures?.length ?? 0;
  const age = vehicle.age ?? 0;

  let score = 0;

  // Mileage risk
  if (mileage > 120000) score += 30;
  else if (mileage > 90000) score += 20;
  else if (mileage > 60000) score += 10;

  // MOT advisories
  score += advisories * 5;

  // MOT failures
  score += failures * 15;

  // Age risk
  if (age > 12) score += 20;
  else if (age > 8) score += 10;

  // Clamp 0–100
  return Math.min(100, score);
}

export function marketVolatility(vehicle: any): "low" | "medium" | "high" {
  const demand = vehicle.market?.demandScore ?? 50;

  if (demand > 70) return "low";
  if (demand < 30) return "high";
  return "medium";
}

export function buyingConfidence(vehicle: any): number {
  const risk = computeRiskScore(vehicle);
  const volatility = marketVolatility(vehicle);

  let confidence = 100 - risk;

  if (volatility === "high") confidence -= 20;
  if (volatility === "medium") confidence -= 10;

  return Math.max(0, Math.min(100, confidence));
}
