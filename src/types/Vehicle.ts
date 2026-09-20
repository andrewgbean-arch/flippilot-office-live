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
  // RETIRED: the app no longer computes or saves these two (they were stamped
  // as 0 on every car, so anything built on them was meaningless), and cars read
  // from the server have them removed (dealer/intelligence/dealerAI.ts). Still
  // declared, and optional, only so screens that have not been cleaned up yet
  // keep compiling. Do not read them.
  /** @deprecated retired, never set */
  marketHeat?: number;
  /** @deprecated retired, never set */
  riskScore?: number;
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

  // RETIRED "AI predicted repairs" (a fixed cost table keyed on advisory words
  // and mileage): no longer computed, see dealerAI.ts.
  /** @deprecated retired, never set */
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

  // RETIRED "AI Intelligence fields": no longer computed or saved, and removed
  // from cars read from the server (dealer/intelligence/dealerAI.ts). They were
  // worked out from figures the app never had (see the note there), so they
  // carried no information. Declared only so code that has not been cleaned up
  // yet keeps compiling; do not read them.
  /** @deprecated retired, never set */
  buyerPersona?: string[];
  /** @deprecated retired, never set */
  sellerPsychology?: string[];
  /** @deprecated retired, never set */
  supernovaScore?: number;
  /** @deprecated retired, never set */
  flipDifficulty?: number;
  /** @deprecated retired, never set */
  valuationConfidence?: number;
  /** @deprecated retired, never set */
  photoQuality?: number;
  /** @deprecated retired, never set */
  auctionDelta?: number;

  aiPriceConfidence?: number; // ⭐ REQUIRED

  // Notes + Images
  notes?: string | null;
  // Public-facing sales copy — distinct from `notes`, which is
  // internal-only. Can be hand-written or AI-generated (see
  // /ai/vehicle-description) from this vehicle's own real data.
  listingDescription?: string | null;
  images?: string[] | null;

  // Bookkeeping linkage
  costs?: string[];

  // VAT scheme
  vatScheme?: "standard" | "margin" | "trade";

  img: string;
  status: string;
}

