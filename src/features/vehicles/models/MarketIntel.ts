// features/vehicles/models/MarketIntel.ts (or same file for now)
export type MarketIntel = {
  marketAvg: number;
  demandIndex: number;        // 0–100
  competitorCount: number;
  priceDelta: number;         // vs marketAvg
  sellTimeDays: number;       // predicted days to sell
  pressureLevel: "undervalued" | "fair" | "overpriced";
  dealerRankPercent: number;  // 0–100 (lower = better)
  sentimentScore: number;     // 0–100
};
