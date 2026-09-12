import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export interface BuyerProfile {
  income?: number;
  expenses?: number;
  deposit?: number;
  creditScore?: number;     // 0–1000
  riskScore?: number;       // 0–100
  savings?: number;         // NEW
  employmentStability?: number; // NEW 0–100
}

export class AffordabilityEngine {
  /* ⭐ Risk‑adjusted APR */
  aprForBuyer(buyer: BuyerProfile) {
    const credit = buyer.creditScore ?? 500;
    const risk = buyer.riskScore ?? 50;

    // Base APR
    let apr = 8;

    // Credit score adjustment
    if (credit < 450) apr += 6;
    else if (credit < 550) apr += 4;
    else if (credit < 650) apr += 2;
    else if (credit < 750) apr += 1;

    // Buyer risk adjustment
    apr += risk / 20; // +0–5%

    return apr;
  }

  /* ⭐ Monthly payment calculator */
  monthlyPayment(price: number, apr: number, termMonths: number, deposit: number = 0) {
    const loan = Math.max(0, price - deposit);
    const monthlyRate = apr / 100 / 12;

    if (monthlyRate === 0) return loan / termMonths;

    return (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  }

  /* ⭐ Payment stress test (NEW) */
  stressTest(payment: number, disposable: number) {
    const ratio = payment / disposable;

    if (ratio >= 0.6) return "Critical";
    if (ratio >= 0.45) return "High";
    if (ratio >= 0.30) return "Medium";
    return "Low";
  }

  /* ⭐ Affordability score (0–100) — upgraded */
  affordabilityScore(vehicle: FlipRecord, buyer: BuyerProfile) {
    const price = vehicle.sellPrice ?? vehicle.valuation ?? vehicle.buyPrice ?? 0;
    const deposit = buyer.deposit ?? 0;
    const income = buyer.income ?? 0;
    const expenses = buyer.expenses ?? 0;

    const apr = this.aprForBuyer(buyer);
    const term = 48;

    const payment = this.monthlyPayment(price, apr, term, deposit);
    const disposable = income - expenses;

    if (disposable <= 0) return 0;

    const ratio = payment / disposable;

    let score = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));

    // Employment stability bonus
    if ((buyer.employmentStability ?? 50) > 70) score += 5;

    // Savings buffer bonus
    if ((buyer.savings ?? 0) > payment * 3) score += 5;

    return Math.min(100, score);
  }

  /* ⭐ Stock match (Green / Yellow / Red) */
  matchBand(score: number) {
    if (score >= 75) return "Green";
    if (score >= 45) return "Yellow";
    return "Red";
  }

  /* ⭐ Recommended deposit — upgraded */
  recommendedDeposit(vehicle: FlipRecord, buyer: BuyerProfile) {
    const price = vehicle.sellPrice ?? vehicle.valuation ?? vehicle.buyPrice ?? 0;
    const income = buyer.income ?? 0;

    const apr = this.aprForBuyer(buyer);
    const term = 48;

    const targetPayment = income * 0.15; // 15% of income

    let low = 0;
    let high = price;
    let best = 0;

    // Binary search for optimal deposit
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const payment = this.monthlyPayment(price, apr, term, mid);

      if (payment <= targetPayment) {
        best = mid;
        high = mid - 100;
      } else {
        low = mid + 100;
      }
    }

    // Cap deposit to buyer savings + deposit
    const maxPossible = (buyer.savings ?? 0) + (buyer.deposit ?? 0);
    return Math.min(best, maxPossible);
  }

  /* ⭐ Deal closing probability (NEW) */
  closingProbability(score: number, buyer: BuyerProfile) {
    let prob = score;

    // Credit score influence
    prob += (buyer.creditScore ?? 500) / 20; // +0–50

    // Employment stability influence
    prob += (buyer.employmentStability ?? 50) / 5; // +0–20

    // Risk score influence (negative)
    prob -= (buyer.riskScore ?? 50) / 2; // -0–50

    return Math.max(0, Math.min(100, Math.round(prob)));
  }
}

export const affordabilityEngine = new AffordabilityEngine();
