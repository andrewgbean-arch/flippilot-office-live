import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { BuyerProfile } from "./AffordabilityEngine";

export interface RiskResult {
  motRisk: number;
  financeRisk: number;
  affordabilityRisk: number;
  buyerRisk: number;
  totalRisk: number;
  band: "Low" | "Medium" | "High";
}

export class RiskEngine {
  /* ⭐ MOT Risk */
  motRisk(vehicle: FlipRecord, ai: any): number {
    return ai.motRiskScore(vehicle); // already 0–100
  }

  /* ⭐ Finance Risk */
  financeRisk(buyer: BuyerProfile): number {
    const score = buyer.creditScore ?? 600;
    if (score >= 700) return 10;
    if (score >= 640) return 30;
    return 60;
  }

  affordabilityRisk(vehicle: FlipRecord, buyer: BuyerProfile, ai: any): number {
    const income = buyer.income ?? 0;
    const expenses = buyer.expenses ?? 0;

    const monthly = ai.monthlyPayment(vehicle);
    const leftover = income - expenses;

    if (monthly < leftover * 0.3) return 10;
    if (monthly < leftover * 0.5) return 30;
    return 60;
  }

  /* ⭐ Buyer Risk */
  buyerRisk(buyer: BuyerProfile): number {
    return Math.round((buyer.riskScore ?? 0.3) * 100);
  }

  /* ⭐ Total Risk */
  totalRisk(vehicle: FlipRecord, buyer: BuyerProfile, ai: any): RiskResult {
    const mot = this.motRisk(vehicle, ai);
    const finance = this.financeRisk(buyer);
    const afford = this.affordabilityRisk(vehicle, buyer, ai);
    const buyerR = this.buyerRisk(buyer);

    const total = Math.round(
      mot * 0.35 +
      finance * 0.25 +
      afford * 0.25 +
      buyerR * 0.15
    );

    const band =
      total < 30 ? "Low" :
      total < 60 ? "Medium" :
      "High";

    return {
      motRisk: mot,
      financeRisk: finance,
      affordabilityRisk: afford,
      buyerRisk: buyerR,
      totalRisk: total,
      band,
    };
  }
}

export const riskEngine = new RiskEngine();
