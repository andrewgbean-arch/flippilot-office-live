import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export interface BuyerProfile {
  income?: number;
  expenses?: number;
  deposit?: number;
  creditScore?: number;
  riskScore?: number;
}

export class AffordabilityEngine {
  /* ⭐ Monthly payment calculator */
  monthlyPayment(price: number, apr: number, termMonths: number, deposit: number = 0) {
    const loan = Math.max(0, price - deposit);
    const monthlyRate = apr / 100 / 12;

    if (monthlyRate === 0) return loan / termMonths;

    return (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  }

  /* ⭐ Affordability score (0–100) */
  affordabilityScore(vehicle: FlipRecord, buyer: BuyerProfile) {
    const price = vehicle.sellPrice ?? vehicle.valuation ?? vehicle.buyPrice ?? 0;
    const deposit = buyer.deposit ?? 0;
    const income = buyer.income ?? 0;
    const expenses = buyer.expenses ?? 0;

    const apr = 12; // default APR until lender data is added
    const term = 48;

    const payment = this.monthlyPayment(price, apr, term, deposit);
    const disposable = income - expenses;

    if (disposable <= 0) return 0;

    const ratio = payment / disposable;

    const score = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));

    return score;
  }

  /* ⭐ Stock match (Green / Yellow / Red) */
  matchBand(score: number) {
    if (score >= 70) return "Green";
    if (score >= 40) return "Yellow";
    return "Red";
  }

  /* ⭐ Recommended deposit */
  recommendedDeposit(vehicle: FlipRecord, buyer: BuyerProfile) {
    const price = vehicle.sellPrice ?? vehicle.valuation ?? vehicle.buyPrice ?? 0;
    const income = buyer.income ?? 0;

    const targetPayment = income * 0.15; // 15% of income

    const apr = 12;
    const term = 48;

    let deposit = 0;

    for (let d = 0; d <= price; d += 100) {
      const payment = this.monthlyPayment(price, apr, term, d);
      if (payment <= targetPayment) {
        deposit = d;
        break;
      }
    }

    return deposit;
  }
}

export const affordabilityEngine = new AffordabilityEngine();
