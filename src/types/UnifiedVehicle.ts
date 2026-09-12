export interface UnifiedVehicle {
  id: string;

  // Identity
  make: string;
  model: string;
  year: number;
  mileage: number;
  colour?: string;

  // Registration
  reg?: string;

  // Pricing
  purchasePrice: number;
  expectedSale: number;

  // Market / Risk
  marketHeat: number;
  riskScore: number;
  condition: string;

  // MOT
  motExpiry: string;
  advisories: string[];
  mileageHistory: { year: number; mileage: number }[];
  motHistory: {
    year: number;
    result: string;
    advisories: string[];
  }[];

  // Valuation
  valuationHistory: number[];

  // Dealer-AI FlipRecord compatibility
  title: string;
  buyPrice: number;
  sellPrice: number;
  timestamp: string;

  // Bookkeeping
  costs?: string[];
  vatScheme?: "standard" | "margin" | "trade";

  // Media
  img: string;
  status: string;
}
