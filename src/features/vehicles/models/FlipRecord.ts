/* -------------------------------------------------------
   FLIP RECORD MODEL (FINAL VERSION)
------------------------------------------------------- */

export interface FlipRecord {
  id: string;

  // Basic info
  title: string;
  buyPrice: number | null;
  sellPrice: number | null;

  // Added for AI + screens
  make?: string | null;
  model?: string | null;

  // Dealer analytics fields
  mileage?: number | null;

  buyDate?: string | null;
  sellDate?: string | null;

  // AI fair price
  price?: number | null;

  // Vehicle valuation
  valuation?: number | null;

  // Historical valuations
  valuationHistory?: {
    date: string;
    value: number;
  }[] | null;

  // AI valuation engine output
  aiValuation?: {
    estimatedValue?: number | null;
    confidence?: number | null;
    notes?: string | null;
  } | null;

  // Trade-in value
  tradeValue?: number | null;

  // Buyer confidence score
  buyerConfidence?: number | null;

  // Flip score + favourite
  flipScore?: number | null;
  favourite?: boolean;

  // Timestamp
  timestamp: string;

  // General metadata
  category?: string | null;
  barcode?: string | null;
  profit?: number | null;

  // Images
  images?: string[] | null;

  // FlipScore inputs
  rarity?: string | null;
  sellSpeed?: string | null;

  // AI analysis
  ai?: {
    condition?: string | null;
    description?: string | null;
    fullDescription?: string | null;
    origin?: string | null;
    conditionScore?: number | null;
    photos?: any[] | null;
  } | null;

  // AI price engine output
  aiPrice?: {
    recommendedSellPrice?: number | null;
    riskLevel?: "low" | "medium" | "high" | null;
    confidence?: number | null;
    notes?: string | null;
    min?: number | null;
    max?: number | null;
  } | null;

  // Legacy AI price fields
  aiPriceMin?: number | null;
  aiPriceMax?: number | null;
  aiPriceConfidence?: number | null;

  // Market scan
  market?: {
    demandScore?: number | null;

    googlePriceMin?: number | null;
    googlePriceMax?: number | null;
    smartPrice?: number | null;

    lowest?: number | null;
    highest?: number | null;
    average?: number | null;

    soldCount?: number | null;

    aiPriceMin?: number | null;
    aiPriceMax?: number | null;
    aiPriceConfidence?: number | null;
  } | null;

  // FULL MOT structure
  mot?: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    reg?: string | null;

    motStatus?: string | null;
    motExpiry?: string | null;
    expiryDate?: string | null;

    mileage?: number | null;
    taxStatus?: string | null;

    advisories?: string[] | null;
    failures?: string[] | null;

    mileageHistory?: {
      date: string;
      mileage?: number | null;
    }[] | null;

    colour?: string | null;
    keepers?: number | null;
  } | null;

  // Engine size
  engineSize?: number | null;

  // Pro tips
  proTips?: string[] | null;

  // Legacy pricing fields
  pricing?: {
    recommendedBuyPrice?: number | null;
    recommendedSellPrice?: number | null;
    predictedProfit?: number | null;
  } | null;

  flipPotential?: string | null;
  insights?: string | null;

  // Notes
  notes?: string | null;

  /* -------------------------------------------------------
     DEALER INTELLIGENCE FIELDS
  ------------------------------------------------------- */

  listingStatus?: string | null;

  buyerEmotion?: string | null;
  buyerPersonality?: string | null;
  buyerStage?: string | null;
  followUp?: string | null;

  financeRisk?: string | null;

  diagnosticSummary?: string | null;
  warrantyRisk?: string | null;
  predictiveMaintenance?: string | null;

  closingProbability?: string | null;
  closingNextMove?: string | null;
}

/* -------------------------------------------------------
   DEFAULTS
------------------------------------------------------- */

export const FlipRecordDefaults: FlipRecord = {
  id: "",
  title: "",
  buyPrice: null,
  sellPrice: null,

  make: null,
  model: null,
  mileage: null,

  buyDate: null,
  sellDate: null,

  price: null,
  valuation: null,
  valuationHistory: null,

  aiValuation: {
    estimatedValue: null,
    confidence: null,
    notes: null,
  },

  tradeValue: null,
  buyerConfidence: null,

  flipScore: null,
  favourite: false,

  timestamp: new Date().toISOString(),

  category: null,
  barcode: null,
  profit: null,

  images: null,

  rarity: null,
  sellSpeed: null,

  ai: {
    condition: null,
    description: null,
    fullDescription: null,
    origin: null,
    conditionScore: null,
    photos: null,
  },

  aiPrice: {
    recommendedSellPrice: null,
    riskLevel: null,
    confidence: null,
    notes: null,
    min: null,
    max: null,
  },

  aiPriceMin: null,
  aiPriceMax: null,
  aiPriceConfidence: null,

  market: {
    demandScore: null,
    googlePriceMin: null,
    googlePriceMax: null,
    smartPrice: null,
    lowest: null,
    highest: null,
    average: null,
    soldCount: null,
    aiPriceMin: null,
    aiPriceMax: null,
    aiPriceConfidence: null,
  },

  mot: {
    make: null,
    model: null,
    year: null,
    reg: null,
    motStatus: null,
    motExpiry: null,
    expiryDate: null,
    mileage: null,
    taxStatus: null,
    advisories: null,
    failures: null,
    mileageHistory: null,
    colour: null,
    keepers: null,
  },

  engineSize: null,
  proTips: null,

  pricing: {
    recommendedBuyPrice: null,
    recommendedSellPrice: null,
    predictedProfit: null,
  },

  flipPotential: null,
  insights: null,

  notes: null,

  listingStatus: null,

  buyerEmotion: null,
  buyerPersonality: null,
  buyerStage: null,
  followUp: null,

  financeRisk: null,

  diagnosticSummary: null,
  warrantyRisk: null,
  predictiveMaintenance: null,

  closingProbability: null,
  closingNextMove: null,
};

/* -------------------------------------------------------
   FACTORY
------------------------------------------------------- */

export function FlipRecordFactory(title: string): FlipRecord {
  return {
    ...FlipRecordDefaults,
    id: crypto.randomUUID(),
    title,
    timestamp: new Date().toISOString(),
  };
}

/* -------------------------------------------------------
   NORMALISER
------------------------------------------------------- */

export function normalizeFlipRecord(v: Partial<FlipRecord>): FlipRecord {
  return {
    ...FlipRecordDefaults,
    ...v,

    aiValuation: {
      ...FlipRecordDefaults.aiValuation,
      ...(v.aiValuation ?? {}),
    },

    aiPrice: {
      ...FlipRecordDefaults.aiPrice,
      ...(v.aiPrice ?? {}),
    },

    market: {
      ...FlipRecordDefaults.market,
      ...(v.market ?? {}),
    },

    mot: {
      ...FlipRecordDefaults.mot,
      ...(v.mot ?? {}),
    },

    pricing: {
      ...FlipRecordDefaults.pricing,
      ...(v.pricing ?? {}),
    },

    ai: {
      ...FlipRecordDefaults.ai,
      ...(v.ai ?? {}),
    },
  };
}

/* -------------------------------------------------------
   VALIDATOR
------------------------------------------------------- */

export function validateFlipRecord(v: FlipRecord): string[] {
  const errors: string[] = [];

  if (!v.id) errors.push("Missing id");
  if (!v.title) errors.push("Missing title");
  if (!v.timestamp) errors.push("Missing timestamp");

  if (v.buyPrice !== null && v.buyPrice < 0)
    errors.push("Buy price cannot be negative");

  if (v.sellPrice !== null && v.sellPrice < 0)
    errors.push("Sell price cannot be negative");

  if (v.mileage != null && v.mileage < 0)
    errors.push("Mileage cannot be negative");

  return errors;
}

/* -------------------------------------------------------
   MIGRATION
------------------------------------------------------- */

export function migrateFlipRecords(records: any[]): FlipRecord[] {
  return records.map((r) => normalizeFlipRecord(r));
}
