type Condition = "Excellent" | "Good" | "Fair" | "Poor";
export function calculatePrice(listing: any, prediction: any) {
  const price = Number(listing?.price ?? listing?.sellPrice ?? listing?.buyPrice ?? 0);
  const mileage = Number(listing?.mileage ?? 0);
  const year = Number(listing?.year ?? 0);
  const condition = (listing?.condition ?? "Good") as Condition;
  const brand = listing?.make ?? "";
  const engineSize = Number(listing?.engineSize ?? 0);
  const flipScore = Number(prediction?.flipScore ?? 50);
  const marketHeat = Number(prediction?.marketHeat ?? 50);
  let value = price;
  const age = new Date().getFullYear() - year;
  value -= age * 120;
  value -= (mileage / 1000) * 15;
  const conditionMap: Record<Condition, number> = {
    Excellent: 1.08,
    Good: 1.03,
    Fair: 0.95,
    Poor: 0.85,
  };
  const multiplier = conditionMap[condition] ?? 1;
  value *= multiplier;
  const brandBoost = ["BMW", "Mercedes", "Audi", "Lexus"].includes(brand) ? 1.05 : 1;
  value *= brandBoost;
  if (engineSize >= 2.0) value *= 1.03;
  value *= 1 + marketHeat / 200;
  value *= 1 + flipScore / 300;
  return Math.round(value);
}
export function computeAiPrice(flip: any) {
  const base = flip.sellPrice || flip.buyPrice || 0;
  const demandBoost = (flip.market?.demandScore ?? 50) / 100;
  const rarityBoost =
    flip.rarity === "Ultra Rare"
      ? 0.25
      : flip.rarity === "Rare"
      ? 0.15
      : flip.rarity === "Uncommon"
      ? 0.08
      : 0;
  const motStatus = flip.mot?.failures?.length
    ? "Fail"
    : flip.mot?.advisories?.length
    ? "Advisory"
    : "Pass";
  const motPenalty =
    motStatus === "Fail"
      ? 0.2
      : motStatus === "Advisory"
      ? 0.1
      : 0;
  const suggested = base * (1 + demandBoost + rarityBoost - motPenalty);
  const confidence =
    (flip.aiPriceConfidence ?? 60) -
    motPenalty * 20 +
    demandBoost * 20 +
    (flip.flipScore ?? 50) / 5;
  const riskLevel: "low" | "medium" | "high" =
    confidence > 75 ? "low" : confidence > 50 ? "medium" : "high";
  const notes = [
    demandBoost > 0.5 && "High demand market",
    rarityBoost > 0 && `Rarity boost: ${flip.rarity}`,
    motPenalty > 0 && "MOT issues reduce price",
    flip.flipScore > 70 && "Strong flip score",
  ]
    .filter(Boolean)
    .join(" • ");
  return {
    recommendedSellPrice: Math.round(suggested),
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    riskLevel,
    notes,
  };
}
