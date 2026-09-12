import type { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import type { MarketIntel } from "@/features/vehicles/models/MarketIntel";

export function simulateMarketIntel(vehicle: FlipRecord): MarketIntel {
  const market = vehicle.market ?? {};

  // Base market price (fallback to buy/sell/valuation blend)
  const baseMarket =
    market.average ??
    ((vehicle.buyPrice ?? 3000) +
      (vehicle.sellPrice ?? vehicle.valuation ?? 4500)) / 2;

  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? 80000;
  const flipScore = vehicle.flipScore ?? 50;

  // Compute days listed from timestamps
  const timestampMs = new Date(vehicle.timestamp).getTime();
  const endMs = vehicle.sellDate
    ? new Date(vehicle.sellDate).getTime()
    : Date.now();

  const daysListed = Math.max(
    1,
    Math.round((endMs - timestampMs) / 86400000)
  );

  // Demand score (market + flipScore)
  const demandIndex = Math.max(
    10,
    Math.min(
      100,
      (market.demandScore ?? flipScore) +
        (baseMarket > 8000 ? -10 : 5)
    )
  );

  // Competitor count (market + mileage influence)
  const competitorCount = Math.max(
    1,
    market.soldCount ??
      Math.round((baseMarket / 5000) * 3 + (100000 - mileage) / 30000)
  );

  // Price delta (sell vs market)
  const priceDelta =
    (vehicle.sellPrice ?? vehicle.valuation ?? baseMarket) - baseMarket;

  // Predicted sell time
  const sellTimeDays = Math.max(
    3,
    Math.round(14 - demandIndex / 8 + daysListed / 4)
  );

  // Market pressure level
  const pressureLevel =
    priceDelta < -300
      ? "undervalued"
      : priceDelta > 700
      ? "overpriced"
      : "fair";

  // Dealer rank (lower is better)
  const dealerRankPercent = Math.max(
    5,
    Math.min(100, 50 - (flipScore - 50) + daysListed / 2)
  );

  // Buyer sentiment (AI)
  const sentimentScore = Math.max(
    10,
    Math.min(
      100,
      flipScore + (priceDelta < 0 ? 10 : -5)
    )
  );

  return {
    marketAvg: Math.round(baseMarket),
    demandIndex: Math.round(demandIndex),
    competitorCount,
    priceDelta: Math.round(priceDelta),
    sellTimeDays,
    pressureLevel,
    dealerRankPercent: Math.round(dealerRankPercent),
    sentimentScore: Math.round(sentimentScore),
  };
}
