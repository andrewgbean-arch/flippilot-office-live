export type CarCondition = "excellent" | "good" | "fair" | "poor";

/* ⭐ MOT DATA — used by backend + frontend */
export interface MotData {
  make?: string;
  model?: string;
  year?: number;
  expiry?: string;
  mileageHistory?: { date: string; mileage: number }[];
  advisories?: string[];
  failures?: string[];
  lastChecked?: string;
}

/* ⭐ AI SUMMARY — used by AI engine + analytics */
export interface AiSummary {
  summary?: string;
  riskLevel?: "low" | "medium" | "high";
  recommendedSalePrice?: number;
  demandScore?: number;
  lastUpdated?: string;

  // AI Pro fields
  buyerProfile?: string;
  recommendedRepairs?: string[];
  saleStrategy?: string;
  profitForecast?: number;
  difficulty?: number;
  verdict?: string;
}

/* ⭐ VALUATION — used by analytics + AI */
export interface Valuation {
  estimatedValue: number;
  status: "undervalued" | "fair" | "overpriced";
  confidence: number;
  tradeInPrice: number;
  privateSalePrice: number;
  lastUpdated: string;

  // Intelligence fields
  recommendedSalePrice?: number;
  marketTrend?: number;   // 0–100
  demandLevel?: number;   // 0–100
}

/* ⭐ MAIN CAR RECORD — used by backend + frontend + AI */
export interface CarRecord {
  id: string;

  // Core details
  make: string;
  model: string;
  year: number;
  mileage: number;
  reg: string;

  // Money
  purchasePrice: number;

  // Sold flip fields
  sold: boolean;
  salePrice: number | null;
  soldDate: string | null;
  profit: number | null;
  roi: number | null;

  expectedSalePrice?: number | null;

  // Condition + notes
  condition: CarCondition;
  notes?: string;

  // Images
  imageUri?: string;

  // MOT
  mot?: MotData;

  // Valuation
  valuation?: Valuation;

  // AI Summary
  aiSummary?: AiSummary;

  // Analytics
  analytics?: {
    roi?: number;
    profit?: number;
    flipScore?: number;
    updatedAt?: string;
  };

  // System
  createdAt: string;

  // Favourite flag
  favourite?: boolean;
}
