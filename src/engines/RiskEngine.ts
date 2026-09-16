// -------------------------------
// Supernova Dealer Risk Engine V3
// -------------------------------

export function computeRiskScore(vehicle: any): number {
  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? 0;
  const advisories = vehicle.mot?.advisories?.length ?? 0;
  // A real Vehicle record has no flat `mot.failures` array — failures
  // only exist nested inside each mot.history entry (result === "FAIL").
  // Reading vehicle.mot.failures directly (as this used to) is always
  // undefined for a real vehicle, silently zeroing out this whole risk
  // factor — same shape as `age` below.
  const failures =
    vehicle.mot?.failures?.length ??
    (vehicle.mot?.history ?? []).filter((h: any) => h.result?.toUpperCase?.() === "FAIL")
      .flatMap((h: any) => h.failures ?? []).length;
  // Likewise there's no stored `vehicle.age` field on a real Vehicle —
  // only `mot.year`, which every other engine in this app already
  // derives age from.
  const age = vehicle.age ?? (vehicle.mot?.year ? new Date().getFullYear() - vehicle.mot.year : 0);

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
