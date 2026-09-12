import { Vehicle } from "@/types/Vehicle";

export function computeAiPrice(vehicle: Vehicle) {
  const base = vehicle.sellPrice || vehicle.buyPrice || 0;

  const demandBoost = (vehicle.market?.demandScore ?? 50) / 100;

  const rarityBoost =
    vehicle.rarity === "Ultra Rare"
      ? 0.25
      : vehicle.rarity === "Rare"
      ? 0.15
      : vehicle.rarity === "Uncommon"
      ? 0.08
      : 0;

  const motPenalty =
    vehicle.mot?.motStatus === "Fail"
      ? 0.2
      : vehicle.mot?.motStatus === "Advisory"
      ? 0.1
      : 0;

  const suggested =
    base * (1 + demandBoost + rarityBoost - motPenalty);

  const confidence =
    (vehicle.aiPriceConfidence ?? 60) -
    motPenalty * 20 +
    demandBoost * 20;

  const riskLevel: "low" | "medium" | "high" =
    confidence > 75 ? "low" : confidence > 50 ? "medium" : "high";

  const notes = [
    demandBoost > 0.5 && "High demand market",
    rarityBoost > 0 && `Rarity boost: ${vehicle.rarity}`,
    motPenalty > 0 && "MOT issues reduce price",
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

