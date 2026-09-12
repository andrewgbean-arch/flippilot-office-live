export type CarCondition = "excellent" | "good" | "fair" | "poor";

export type CarRecord = {
  id: string;

  // identity
  reg?: string; // ⭐ required for seed + lookup
  make: string;
  model: string;
  year: number;

  // condition
  mileage: number;
  condition?: CarCondition;

  // pricing
  purchasePrice: number;
  valuation?: number;
  expectedSalePrice?: number; // ⭐ required for carUtils

  // sale status
  sold?: boolean;
  salePrice?: number;
  soldDate?: string;

  // analytics
  profit?: number;
  roi?: number;

  // metadata
  createdAt?: string;
  images?: string[];
  notes?: string;
  source?: string;

  // MOT
  mot?: {
    expiry?: string;
    failures?: string[];
    advisories?: string[];
  };
};

