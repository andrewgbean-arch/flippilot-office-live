// ---------------------------------------------
// DealerAI V17 — Helper Functions
// ---------------------------------------------

import {
  Vehicle,
  Buyer,
  Lead,
  ScoreProfile,
  RiskBand,
  bandFromScore,
} from "./dealerai-v17-types";

// Base price resolver
export const basePrice = (vehicle: Vehicle) =>
  vehicle.sellPrice ??
  vehicle.valuation ??
  vehicle.price ??
  vehicle.buyPrice ??
  0;

// Fraud risk
export const fraudRisk = (vehicle: Vehicle): number => {
  if (!vehicle) return 0;

  let risk = 0;

  if (!vehicle.mot?.motExpiry) risk += 25;

  if (vehicle.mileage && vehicle.year) {
    const age = new Date().getFullYear() - vehicle.year;
    const perYear = vehicle.mileage / Math.max(age, 1);
    if (perYear < 3000) risk += 30;
  }

  if (vehicle.price && vehicle.marketAvg && vehicle.price < vehicle.marketAvg * 0.7) {
    risk += 30;
  }

  return Math.min(100, risk);
};

// Condition score
export const conditionScore = (vehicle: Vehicle): number => {
  if (!vehicle) return 0;
  let score = 70;
  if (vehicle.mileage && vehicle.mileage > 100000) score -= 20;
  if (!vehicle.mot?.motExpiry) score -= 15;
  if (vehicle.flipScore) score = (score + vehicle.flipScore) / 2;
  return Math.max(0, Math.min(100, score));
};

// Finance APR
export const financeAPR = (vehicle: Vehicle, buyer?: Buyer): number => {
  const base = 7;
  const age = vehicle.year ? new Date().getFullYear() - vehicle.year : 0;
  const mileageFactor = (vehicle.mileage ?? 0) / 20000 * 0.3;
  const credit = buyer?.creditScore ?? 600;

  let apr = base + age * 0.15 + mileageFactor;

  if (credit < 550) apr += 3;
  else if (credit < 650) apr += 1.5;

  return Math.round(apr);
};

// Monthly payment
export const monthlyPayment = (
  vehicle: Vehicle,
  buyer?: Buyer,
  termMonths: number = 48
): number => {
  const price = basePrice(vehicle);
  const deposit = buyer?.deposit ?? 0;
  const apr = financeAPR(vehicle, buyer);
  const loan = Math.max(0, price - deposit);
  const monthlyRate = apr / 100 / 12;

  if (monthlyRate === 0) return loan / termMonths;

  const payment =
    (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  return Math.round(payment);
};

// Affordability score
export const affordabilityScore = (vehicle: Vehicle, buyer: Buyer): number => {
  const price = basePrice(vehicle);
  const deposit = buyer.deposit ?? 0;
  const income = buyer.income ?? 0;
  const expenses = buyer.expenses ?? 0;

  const apr = financeAPR(vehicle, buyer);
  const term = 48;

  const payment = monthlyPayment(vehicle, buyer, term);
  const disposable = income - expenses;

  if (disposable <= 0) return 0;

  const ratio = payment / disposable;
  let score = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));

  if ((buyer.employmentStability ?? 50) > 70) score += 5;
  if ((buyer.savings ?? 0) > payment * 3) score += 5;

  return Math.min(100, score);
};

// Deposit suggestion
export const depositSuggestion = (
  vehicle: Vehicle,
  buyer: Buyer
): { recommendedDeposit: number; term: number; band: RiskBand; monthly: number } => {
  const price = basePrice(vehicle);
  const score = affordabilityScore(vehicle, buyer);
  const band = bandFromScore(score);

  const term =
    band === "LOW" ? 48 :
    band === "MEDIUM" ? 36 :
    24;

  const targetPayment = (buyer.income ?? 0) * 0.15;
  const apr = financeAPR(vehicle, buyer);

  let low = 0;
  let high = price;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const loan = Math.max(0, price - mid);
    const monthlyRate = apr / 100 / 12;
    const payment =
      monthlyRate === 0
        ? loan / term
        : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term));

    if (payment <= targetPayment) {
      best = mid;
      high = mid - 100;
    } else {
      low = mid + 100;
    }
  }

  const monthly = monthlyPayment(vehicle, { ...buyer, deposit: best }, term);

  return { recommendedDeposit: best, term, band, monthly };
};

// Closing probability
export const closingProbability = (vehicle: Vehicle, buyer: Buyer, lead: Lead): number => {
  const intent = lead.sentMultipleMessages ? 20 : 0;
  const testDrive = lead.requestedTestDrive ? 30 : 0;
  const cond = conditionScore(vehicle) * 0.3;
  const aff = affordabilityScore(vehicle, buyer) * 0.4;

  const score = intent + testDrive + cond + aff;
  return Math.max(0, Math.min(100, Math.round(score)));
};

// Buyer emotion
export const buyerEmotion = (lead: Lead): string => {
  const msg = lead.message?.toLowerCase() ?? "";

  if (msg.includes("not sure") || msg.includes("worried")) return "Anxious";
  if (msg.includes("best price") || msg.includes("too much")) return "Price‑Sensitive";
  if (msg.includes("love") || msg.includes("great")) return "Excited";
  return "Neutral";
};

// Buyer persona
export const buyerPersona = (vehicle: Vehicle, lead: Lead): string => {
  const price = basePrice(vehicle);
  const msg = lead.message?.toLowerCase() ?? "";

  if (price < 3000) return "Budget Buyer";
  if (price < 8000) return "Practical Buyer";
  if (msg.includes("service history") || msg.includes("mot")) return "Researcher";
  return "Premium Buyer";
};

// Marketing ad
export const generateAd = (vehicle: Vehicle): string => {
  return `🔥 ${vehicle.make ?? ""} ${vehicle.model ?? ""} ${vehicle.year ?? ""}
• ${vehicle.mileage ?? "Unknown"} miles
• Priced at £${basePrice(vehicle)}

Clean, reliable, and ready to go. Message now to book a viewing.`;
};

// Unified score profile
export const scoreProfile = (
  vehicle: Vehicle,
  buyer?: Buyer,
  lead?: Lead
): ScoreProfile => {
  const risk = fraudRisk(vehicle);
  const cond = conditionScore(vehicle);
  const aff = buyer ? affordabilityScore(vehicle, buyer) : 50;

  const roi =
    (() => {
      const buy = vehicle.buyPrice ?? 0;
      const sell = basePrice(vehicle);
      const profit = sell - buy;
      if (profit <= 0) return 20;
      if (profit <= 500) return 50;
      if (profit <= 1500) return 70;
      return 90;
    })();

  const closing =
    buyer && lead ? closingProbability(vehicle, buyer, lead) : 40;

  const sentiment =
    lead ? (buyerEmotion(lead) === "Excited" ? 80 : 50) : 50;

  const reliability = 100 - risk;

  return {
    risk,
    reliability,
    fraud: risk,
    condition: cond,
    affordability: aff,
    roi,
    closing,
    sentiment,
  };
};
