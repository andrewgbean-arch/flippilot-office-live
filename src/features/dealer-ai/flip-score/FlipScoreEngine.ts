import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export interface FlipScoreBreakdown {
  conditionScore: number;
  marketScore: number;
  motRisk: number;
  mileageRisk: number;
  aiConfidence: number;
  finalScore: number;
  tier: "Excellent" | "Good" | "Average" | "Poor";
  notes: string[];
}

export function evaluateFlipScore(vehicle: FlipRecord): FlipScoreBreakdown {
  const notes: string[] = [];

  // Condition score (AI)
  const conditionScore = vehicle.ai?.conditionScore ?? 50;

  // Market score
  const demand = vehicle.market?.demandScore ?? 50;
  const marketScore = Math.min(100, demand);

  // MOT risk
  const failures = vehicle.mot?.failures?.length ?? 0;
  const advisories = vehicle.mot?.advisories?.length ?? 0;
  const motRisk = Math.min(100, failures * 20 + advisories * 5);

  // Mileage risk
  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? 0;
  const mileageRisk =
    mileage > 140000 ? 80 :
    mileage > 120000 ? 60 :
    mileage > 100000 ? 40 :
    mileage > 80000 ? 20 : 10;

  // AI confidence
  const aiConfidence = vehicle.aiValuation?.confidence ?? 50;

  // Final score (weighted)
  const finalScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        conditionScore * 0.35 +
        marketScore * 0.25 +
        aiConfidence * 0.20 -
        motRisk * 0.10 -
        mileageRisk * 0.10
      )
    )
  );

  // Tier
  let tier: "Excellent" | "Good" | "Average" | "Poor" = "Average";
  if (finalScore >= 80) tier = "Excellent";
  else if (finalScore >= 60) tier = "Good";
  else if (finalScore >= 40) tier = "Average";
  else tier = "Poor";

  // Notes
  if (failures > 0) notes.push("MOT failures reduce flip score.");
  if (advisories > 0) notes.push("Advisories detected.");
  if (mileageRisk > 40) notes.push("High mileage risk.");
  if (conditionScore > 70) notes.push("Strong AI condition score.");
  if (marketScore > 70) notes.push("Strong market demand.");
  if (aiConfidence < 40) notes.push("Low AI confidence.");

  return {
    conditionScore,
    marketScore,
    motRisk,
    mileageRisk,
    aiConfidence,
    finalScore,
    tier,
    notes,
  };
}
