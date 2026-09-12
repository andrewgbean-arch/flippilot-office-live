import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export interface MarketIntel {
  demandTier: "HOT" | "WARM" | "COLD";
  pricePressure: number; // 0–100
  saturation: number; // 0–100
  competitorCount: number;
  recommendedListPrice: number;
  timeToSellDays: number;
  notes: string[];
}

export function evaluateMarketIntel(vehicle: FlipRecord): MarketIntel {
  const notes: string[] = [];

  // Market data
  const demand = vehicle.market?.demandScore ?? 50;
  const lowest = vehicle.market?.lowest ?? vehicle.valuation ?? 0;
  const highest = vehicle.market?.highest ?? (vehicle.valuation ?? 0) * 1.2;
  const average = vehicle.market?.average ?? (lowest + highest) / 2;
  const soldCount = vehicle.market?.soldCount ?? 10;

  // Demand tier
  let demandTier: "HOT" | "WARM" | "COLD" = "WARM";
  if (demand >= 70) demandTier = "HOT";
  else if (demand <= 40) demandTier = "COLD";

  // Price pressure (how competitive the market is)
  const pricePressure = Math.min(
    100,
    (soldCount > 20 ? 40 : 20) +
      (demand < 40 ? 20 : 0) +
      (lowest < (vehicle.price ?? average) ? 20 : 0)
  );

  // Market saturation (how crowded the listings are)
  const saturation = Math.min(
    100,
    (soldCount * 3) + (demand < 50 ? 20 : 0)
  );

  // Competitor count (rough estimate)
  const competitorCount = Math.round(soldCount * (demand / 50));

  // Recommended list price
  const recommendedListPrice = Math.round(
    average +
      (demandTier === "HOT" ? 300 : demandTier === "COLD" ? -300 : 0)
  );

  // Time to sell prediction
  const timeToSellDays =
    demandTier === "HOT"
      ? 3 + saturation / 20
      : demandTier === "WARM"
      ? 7 + saturation / 15
      : 14 + saturation / 10;

  // Notes
  if (demandTier === "HOT") notes.push("High demand — fast seller.");
  if (demandTier === "COLD") notes.push("Low demand — slow market.");
  if (pricePressure > 60) notes.push("Strong price pressure from competitors.");
  if (saturation > 70) notes.push("Market is saturated with similar listings.");
  if (competitorCount > 20) notes.push("High competitor density.");

  return {
    demandTier,
    pricePressure,
    saturation,
    competitorCount,
    recommendedListPrice,
    timeToSellDays: Math.round(timeToSellDays),
    notes,
  };
}
