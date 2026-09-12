import { computeAiPrice } from "./computeAiPrice";

export function aiValuation(vehicle: any) {
  const base = computeAiPrice(vehicle);

  return {
    price: base.recommendedSellPrice ?? 0,
    score: base.confidence ?? 0,
    riskLevel: base.riskLevel ?? "medium",
    notes: base.notes ?? ""
  };
}

