import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
export function calcFlipScore(vehicle: FlipRecord): number {
  let score = 0;
  const buy = vehicle.buyPrice || 0;
  const sell = vehicle.sellPrice || 0;
  const profit = sell - buy;
  if (profit > 0) score += Math.min(30, profit / 50);
  const roi = buy > 0 ? ((sell - buy) / buy) * 100 : 0;
  score += Math.min(20, roi / 5);
  if (vehicle.aiPriceConfidence != null) {
    score += Math.min(10, vehicle.aiPriceConfidence * 10);
  }
  if (vehicle.market?.demandScore != null) {
    score += Math.min(15, vehicle.market.demandScore / 2);
  }
  if (vehicle.mot?.motStatus === "Valid") score += 10;
  if (vehicle.mot?.motStatus === "Expired") score -= 5;
  if (vehicle.aiPrice?.riskLevel === "low") score += 10;
  if (vehicle.aiPrice?.riskLevel === "medium") score += 5;
  if (vehicle.aiPrice?.riskLevel === "high") score -= 5;
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return Math.round(score);
}
