export interface Vehicle {
  id: string;

  // When this vehicle entered inventory — used for days-in-stock style
  // reporting (e.g. the Stock Optimiser tool). Optional since existing
  // seed/demo vehicles predate this field.
  createdAt?: string;

  // Identity
  reg?: string;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  colour?: string;

  // Pricing
  buyPrice?: number | null;
  sellPrice?: number | null;
  priceRetail: number | null;
  priceTrade: number | null;

  // ProfitTab mapping
  purchasePrice?: number | null;
  expectedSale?: number | null;

  // Market / Risk
  market?: {
    demandScore?: number;
    heatScore?: number;
  };
  marketHeat: number;
  riskScore: number;
  condition: string;

  // Rarity
  rarity?: "Ultra Rare" | "Rare" | "Uncommon" | "Common";

  // MOT (extended)
  mot: {
    expiry: string;
    advisories: string[];
    historyScore: number;
    history: {
      date?: string;
      year?: number;
      result: string;
      advisories: string[];
      mileage?: number | null;
      failures?: string[]; // ⭐ REQUIRED
      testNumber?: string | null;
      expiryDate?: string | null;
    }[];

    reg?: string | null;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    colour?: string | null;
    mileage?: number | null;

    motStatus?: "Pass" | "Fail" | "Advisory"; // ⭐ REQUIRED

    // From the DVLA Vehicle Enquiry Service — needed to compute real
    // ULEZ/CAZ compliance (see ulezUtils.ts). Only populated once
    // DVLA_API_KEY is configured; null/undefined until then.
    fuelType?: string | null;
    euroStatus?: string | null;
  };

  // Service history (optional)
  serviceHistory?: {
    date: string;
    type: string;
    cost: number;
  }[];

  // AI predicted repairs
  predictedRepairs?: {
    component: string;
    likelihood: number;
    cost: number;
  }[];

  depreciationCurve: number[];

  finance: {
    apr: number;
    depositMin: number;
    lenderTier: string;
  };

  // AI Intelligence fields
  buyerPersona?: string[];
  sellerPsychology?: string[];
  supernovaScore?: number;
  flipDifficulty?: number;
  valuationConfidence?: number;
  photoQuality?: number;
  auctionDelta?: number;

  aiPriceConfidence?: number; // ⭐ REQUIRED

  // Notes + Images
  notes?: string | null;
  images?: string[] | null;

  // Bookkeeping linkage
  costs?: string[];

  // VAT scheme
  vatScheme?: "standard" | "margin" | "trade";

  img: string;
  status: string;
}

