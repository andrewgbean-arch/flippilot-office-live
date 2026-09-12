import { CarCondition } from "@/types/carTypes";

export type MarketValuation = {
  estimatedPrice: number;
  tradeInPrice: number;
  privateSalePrice: number;
  confidence: number;

  status: "undervalued" | "fair" | "overpriced";
  recommendedSalePrice: number;
  marketTrend: number;
  demandLevel: number;
};

export function estimateMarketValue({
  make,
  model,
  year,
  mileage,
  purchasePrice,
  condition,
  motExpiry,
}: {
  make: string;
  model: string;
  year: number;
  mileage: number;
  purchasePrice: number;
  condition: CarCondition;
  motExpiry?: string | null;
}): MarketValuation {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  let base = purchasePrice;

  const agePenalty = age * 250;
  base -= agePenalty;

  const mileagePenalty =
    mileage < 60000
      ? mileage * 0.05
      : mileage < 120000
      ? mileage * 0.08
      : mileage * 0.12;

  base -= mileagePenalty;

  const conditionMultiplier = {
    excellent: 1.2,
    good: 1.05,
    fair: 0.9,
    poor: 0.75,
  }[condition];

  base *= conditionMultiplier;

  let motMultiplier = 1;
  if (motExpiry) {
    const expiryDate = new Date(motExpiry);
    const now = new Date();
    if (expiryDate < now) motMultiplier = 0.85;
    else if (expiryDate.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 60)
      motMultiplier = 0.95;
  }
  base *= motMultiplier;

  const desirableBrands = ["BMW", "Audi", "Mercedes", "Volkswagen", "Ford"];
  const brandMultiplier = desirableBrands.includes(make) ? 1.1 : 1;
  base *= brandMultiplier;

  const month = new Date().getMonth() + 1;
  let seasonalMultiplier = 1;

  if (["MX-5", "Z4", "SLK"].includes(model) && month >= 4 && month <= 8)
    seasonalMultiplier = 1.15;

  if (["Q7", "X5", "Range Rover"].includes(model) && month >= 10)
    seasonalMultiplier = 1.1;

  base *= seasonalMultiplier;

  const privateSalePrice = Math.round(base);
  const tradeInPrice = Math.round(base * 0.85);
  const estimatedPrice = Math.round((privateSalePrice + tradeInPrice) / 2);

  const marketTrend =
    100 -
    age * 2 -
    (mileage > 120000 ? 10 : 0) +
    (condition === "excellent" ? 10 : 0);

  const demandLevel =
    (brandMultiplier - 1) * 100 +
    (seasonalMultiplier - 1) * 100 +
    (conditionMultiplier - 1) * 100;

  const confidence =
    Math.max(40, 100 - age * 2 - (mileage > 150000 ? 10 : 0));

  let status: "undervalued" | "fair" | "overpriced" = "fair";

  if (estimatedPrice > purchasePrice * 1.25) status = "undervalued";
  if (estimatedPrice < purchasePrice * 0.85) status = "overpriced";

  const recommendedSalePrice = Math.round(
    privateSalePrice * (1 + demandLevel / 300)
  );

  return {
    estimatedPrice,
    tradeInPrice,
    privateSalePrice,
    confidence,
    status,
    recommendedSalePrice,
    marketTrend: Math.min(100, Math.max(0, Math.round(marketTrend))),
    demandLevel: Math.min(100, Math.max(0, Math.round(demandLevel))),
  };
}
