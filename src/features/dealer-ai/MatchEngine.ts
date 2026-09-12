import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { BuyerProfile } from "./AffordabilityEngine";
import { affordabilityEngine } from "./AffordabilityEngine";
import { useDealerAI } from "./DealerAIContext";

export interface MatchResult {
  vehicle: FlipRecord;
  score: number;
  band: "Green" | "Yellow" | "Red";
  closingProbability: number;
  recommendedDeposit: number;
}

export class MatchEngine {
  /* ⭐ Core match score (0–100) */
  matchScore(vehicle: FlipRecord, buyer: BuyerProfile, ai: any): number {
    const affordability = affordabilityEngine.affordabilityScore(vehicle, buyer);
    const closing = ai.closingProbability(vehicle, buyer);
    const risk = 100 - ai.motRiskScore(vehicle); // lower MOT risk = better
    const profit = ai.profitForecast(vehicle);

    const weighted =
      affordability * 0.45 +
      closing * 0.30 +
      risk * 0.15 +
      (profit > 0 ? 10 : 0);

    return Math.max(0, Math.min(100, Math.round(weighted)));
  }

  /* ⭐ Match band */
  matchBand(score: number): "Green" | "Yellow" | "Red" {
    if (score >= 70) return "Green";
    if (score >= 40) return "Yellow";
    return "Red";
  }

  /* ⭐ Full match result */
  evaluate(vehicle: FlipRecord, buyer: BuyerProfile, ai: any): MatchResult {
    const score = this.matchScore(vehicle, buyer, ai);
    const band = this.matchBand(score);
    const closingProbability = ai.closingProbability(vehicle, buyer);
    const recommendedDeposit = affordabilityEngine.recommendedDeposit(vehicle, buyer);

    return {
      vehicle,
      score,
      band,
      closingProbability,
      recommendedDeposit,
    };
  }

  /* ⭐ Match all vehicles */
  matchAll(vehicles: FlipRecord[], buyer: BuyerProfile, ai: any): MatchResult[] {
    return vehicles.map(v => this.evaluate(v, buyer, ai));
  }
}

export const matchEngine = new MatchEngine();
