// ===============================
// AI VALUATION v2
// ===============================
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";


export function aiValuationV2(vehicle: FlipRecord) {
  const basePrice =
    vehicle.aiPrice?.recommendedSellPrice ??
    vehicle.market?.average ??
    vehicle.sellPrice ??
    0;

  const volatility = Math.random() * 20;
  const confidence = Math.max(50, 100 - volatility);

  const recommendedPrice = Math.round(basePrice * (confidence / 100));
  const shouldSellNow = confidence > 70;

  return {
    basePrice,
    confidence,
    recommendedPrice,
    volatility,
    shouldSellNow,
    commentary: shouldSellNow
      ? "Market is stable — good time to sell."
      : "Market is fluctuating — consider waiting.",
  };
}

// ===============================
// PROFIT SUPERNOVA ENGINE
// ===============================
export function buildProfitSupernova(vehicle: FlipRecord) {
  const purchase = vehicle.buyPrice ?? 0;
  const repairs = 0; // You can wire repair costs later
  const sale = vehicle.sellPrice ?? 0;

  const profit = sale - (purchase + repairs);
  const roi = purchase > 0 ? Math.round((profit / purchase) * 100) : 0;

  const difficulty =
    roi > 50 ? "Easy"
    : roi > 20 ? "Medium"
    : "Hard";
const demandScore = vehicle.market?.demandScore ?? 0;

const supernovaTriggers = [
  profit > 1000 && "High Profit",
  roi > 50 && "Strong ROI",
  demandScore > 70 && "Hot Market",
].filter(Boolean);

 

  

  return {
    profit,
    roi,
    difficulty,
    supernovaTriggers,
    commentary:
      profit > 0
        ? "🔥 Strong flip — well played."
        : "⚠️ Profit negative — review repair costs.",
  };
}

// ===============================
// VEHICLE TIMELINE ENGINE
// ===============================
export function buildVehicleTimeline(vehicle: FlipRecord) {
  const timeline: {
    type: string;
    date: string;
    label: string;
  }[] = [];

  // Purchase
  if (vehicle.timestamp) {
    timeline.push({
      type: "purchase",
      date: vehicle.timestamp,
      label: "Purchased",
    });
  }

  // MOT expiry
  if (vehicle.mot?.motExpiry) {
    timeline.push({
      type: "mot-expiry",
      date: vehicle.mot.motExpiry,
      label: "MOT Expiry",
    });
  }

  // AI insights
  if (vehicle.insights) {
    timeline.push({
      type: "ai-insight",
      date: new Date().toISOString(),
      label: `AI Insight: ${vehicle.insights}`,
    });
  }

  // Market scan
  if (vehicle.market?.average) {
    timeline.push({
      type: "market-scan",
      date: new Date().toISOString(),
      label: `Market Avg £${vehicle.market.average}`,
    });
  }

  return timeline.sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
