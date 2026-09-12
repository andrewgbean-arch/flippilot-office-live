// ---------------------------------------------
// DealerAI V17 — Unified Types
// ---------------------------------------------

export interface Vehicle {
  id?: string;
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  valuation?: number;
  sellPrice?: number;
  buyPrice?: number;
  marketAvg?: number;
  mot?: { motExpiry?: string };
  flipScore?: number;
  conditionScore?: number;
  daysListed?: number;
}

export interface Buyer {
  id?: string;
  income?: number;
  expenses?: number;
  deposit?: number;
  creditScore?: number;   // 0–1000
  riskScore?: number;     // 0–100
  savings?: number;
  employmentStability?: number; // 0–100
}

export interface Lead {
  id?: string;
  message?: string;
  requestedTestDrive?: boolean;
  sentMultipleMessages?: boolean;
}

export interface ScoreProfile {
  risk: number;
  reliability: number;
  fraud: number;
  condition: number;
  affordability: number;
  roi: number;
  closing: number;
  sentiment: number;
}

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export const bandFromScore = (score: number): RiskBand => {
  if (score >= 70) return "LOW";
  if (score >= 40) return "MEDIUM";
  return "HIGH";
};

// ---------------------------------------------
// DealerAIV17 Interface (missing before)
// ---------------------------------------------
export interface DealerAIV17 {
  scoreProfile: (vehicle: Vehicle, buyer?: Buyer, lead?: Lead) => ScoreProfile;
  riskBand: (score: number) => RiskBand;

  financeAPR: (vehicle: Vehicle, buyer?: Buyer) => number;
  monthlyPayment: (vehicle: Vehicle, buyer?: Buyer, termMonths?: number) => number;
  affordabilityScore: (vehicle: Vehicle, buyer: Buyer) => number;

  depositSuggestion: (
    vehicle: Vehicle,
    buyer: Buyer
  ) => { recommendedDeposit: number; term: number; band: RiskBand; monthly: number };

  closingProbability: (vehicle: Vehicle, buyer: Buyer, lead: Lead) => number;
  closingHint: (vehicle: Vehicle, buyer: Buyer, lead: Lead) => string;

  fraudRisk: (vehicle: Vehicle) => number;
  conditionScore: (vehicle: Vehicle) => number;

  buyerPersona: (vehicle: Vehicle, lead: Lead) => string;
  buyerEmotion: (lead: Lead) => string;

  generateAd: (vehicle: Vehicle) => string;
}
