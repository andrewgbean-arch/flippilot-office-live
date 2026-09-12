import { FlipRecord } from "@/features/vehicles/models/FlipRecord";


export function calcFlipScore(vehicle: FlipRecord): number {
  let score = 0;

  // Profit (0–30)
  const buy = vehicle.buyPrice || 0;
  const sell = vehicle.sellPrice || 0;
  const profit = sell - buy;
  if (profit > 0) score += Math.min(30, profit / 50);

  // ROI (0–20)
  const roi = buy > 0 ? ((sell - buy) / buy) * 100 : 0;
  score += Math.min(20, roi / 5);

  // AI Confidence (0–10)
  if (vehicle.aiPriceConfidence != null) {
    score += Math.min(10, vehicle.aiPriceConfidence * 10);
  }

  // Market Demand (0–15)
  if (vehicle.market?.demandScore != null) {
    score += Math.min(15, vehicle.market.demandScore / 2);
  }

  // MOT Status (0–10)
  if (vehicle.mot?.motStatus === "Valid") score += 10;
  if (vehicle.mot?.motStatus === "Expired") score -= 5;

  // Risk Level (0–10)
  if (vehicle.aiPrice?.riskLevel === "low") score += 10;
  if (vehicle.aiPrice?.riskLevel === "medium") score += 5;
  if (vehicle.aiPrice?.riskLevel === "high") score -= 5;

  // Clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return Math.round(score);
}
