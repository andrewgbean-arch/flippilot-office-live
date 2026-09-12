import { marketValueEngine } from "./MarketValueEngine";
import { marketDemandEngine } from "./MarketDemandEngine";
import { competitorEngine } from "./CompetitorEngine";
import { pricingPressureEngine } from "./PricingPressureEngine";
import { sentimentEngine } from "./SentimentEngine";
import { sellTimeEngine } from "./SellTimeEngine";

export function marketIntelEngine(vehicle: any) {
  const marketAvg = marketValueEngine(vehicle);
  const demandIndex = marketDemandEngine(vehicle);
  const competitorCount = competitorEngine(vehicle);
  const pressureLevel = pricingPressureEngine(vehicle, marketAvg);
  const sentimentScore = sentimentEngine(vehicle);
  const sellTimeDays = sellTimeEngine(demandIndex, vehicle.daysListed ?? 0);

  const priceDelta =
    (vehicle.sellPrice ?? vehicle.valuation ?? marketAvg) - marketAvg;

  return {
    marketAvg,
    demandIndex,
    competitorCount,
    priceDelta,
    sellTimeDays,
    pressureLevel,
    dealerRankPercent: Math.round(100 - demandIndex / 1.5),
    sentimentScore,
  };
}
