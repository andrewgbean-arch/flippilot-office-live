import { FlipRecord } from "../features/vehicles/models/FlipRecord";


export type SupernovaRiskLevel = "low" | "medium" | "high";

export interface SupernovaResult {
  id: string;
  title: string;

  // Core pricing
  recommendedBuyPrice: number | null;
  recommendedSellPrice: number | null;

  // Risk + MOT
  riskLevel: SupernovaRiskLevel;
  motRiskDays: number | null;
  motRiskLabel: string | null;

  // Flip dynamics
  expectedFlipTimeDays: number | null;
  expectedProfit: number | null;

  // Confidence + action
  confidence: number;
  recommendedAction: "buy" | "hold" | "sell" | "avoid";

  // Breakdown
  reasons: string[];
}

/* -------------------------------------------------------
   SUPERNOVA ENGINE
------------------------------------------------------- */

export function runSupernovaEngine(vehicle: FlipRecord): SupernovaResult {
  const reasons: string[] = [];

  // Base values
  const valuation = vehicle.valuation ?? vehicle.aiValuation?.estimatedValue ?? vehicle.price ?? null;
  const buyPrice = vehicle.buyPrice ?? null;
  const sellPrice = vehicle.sellPrice ?? vehicle.aiPrice?.recommendedSellPrice ?? null;

  // MOT risk
  const motExpiry = vehicle.mot?.motExpiry ?? vehicle.mot?.expiryDate ?? null;
  let motRiskDays: number | null = null;
  let motRiskLabel: string | null = null;

  if (motExpiry) {
    const diffMs = new Date(motExpiry).getTime() - Date.now();
    motRiskDays = Math.ceil(diffMs / 86400000);

    if (motRiskDays <= 0) {
      motRiskLabel = "expired";
      reasons.push("MOT has expired.");
    } else if (motRiskDays <= 30) {
      motRiskLabel = "critical";
      reasons.push(`MOT expiring soon (${motRiskDays} days).`);
    } else if (motRiskDays <= 90) {
      motRiskLabel = "warning";
      reasons.push(`MOT within ${motRiskDays} days.`);
    } else {
      motRiskLabel = "healthy";
      reasons.push("MOT status is healthy.");
    }
  }

  // Mileage risk
  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? null;
  let mileageRisk: SupernovaRiskLevel = "low";

  if (mileage != null) {
    if (mileage >= 140000) {
      mileageRisk = "high";
      reasons.push(`Very high mileage (${mileage.toLocaleString()} miles).`);
    } else if (mileage >= 100000) {
      mileageRisk = "medium";
      reasons.push(`High mileage (${mileage.toLocaleString()} miles).`);
    } else {
      reasons.push(`Mileage is reasonable (${mileage.toLocaleString()} miles).`);
    }
  }

  // Price efficiency
  let priceEfficiency: number | null = null;
  if (valuation != null && buyPrice != null && valuation > 0) {
    priceEfficiency = (valuation - buyPrice) / valuation;
    if (priceEfficiency >= 0.25) {
      reasons.push("Strong buy margin vs valuation.");
    } else if (priceEfficiency >= 0.10) {
      reasons.push("Decent buy margin vs valuation.");
    } else if (priceEfficiency >= 0.0) {
      reasons.push("Thin margin vs valuation.");
    } else {
      reasons.push("Overpaying vs valuation.");
    }
  }

  // Expected profit
  let expectedProfit: number | null = null;
  if (sellPrice != null && buyPrice != null) {
    expectedProfit = sellPrice - buyPrice;
    if (expectedProfit >= 2000) {
      reasons.push(`High expected profit (~£${Math.round(expectedProfit)}).`);
    } else if (expectedProfit >= 800) {
      reasons.push(`Solid expected profit (~£${Math.round(expectedProfit)}).`);
    } else if (expectedProfit >= 300) {
      reasons.push(`Low expected profit (~£${Math.round(expectedProfit)}).`);
    } else {
      reasons.push(`Weak expected profit (~£${Math.round(expectedProfit)}).`);
    }
  }

  // Flip time estimate
  let expectedFlipTimeDays: number | null = null;
  const sellSpeed = vehicle.sellSpeed ?? vehicle.flipPotential ?? null;
  if (sellSpeed) {
    const speed = sellSpeed.toLowerCase();
    if (speed.includes("fast")) expectedFlipTimeDays = 14;
    else if (speed.includes("medium")) expectedFlipTimeDays = 30;
    else if (speed.includes("slow")) expectedFlipTimeDays = 60;
  }

  // Risk fusion
  let riskLevel: SupernovaRiskLevel = "medium";

  const motIsHighRisk =
    motRiskLabel === "expired" || motRiskLabel === "critical";
  const profitIsStrong = expectedProfit != null && expectedProfit >= 1500;
  const profitIsWeak = expectedProfit != null && expectedProfit < 400;

  if (motIsHighRisk || mileageRisk === "high") {
    riskLevel = "high";
  } else if (mileageRisk === "medium") {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

  // Confidence score (0–100)
  let confidence = 50;
  if (valuation != null) confidence += 10;
  if (vehicle.aiPrice?.confidence != null) confidence += Math.min(20, vehicle.aiPrice.confidence);
  if (vehicle.aiValuation?.confidence != null) confidence += Math.min(20, vehicle.aiValuation.confidence);
  if (vehicle.flipScore != null) confidence += Math.min(20, vehicle.flipScore);

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  // Recommended action
  let recommendedAction: SupernovaResult["recommendedAction"] = "hold";

  if (riskLevel === "high" && profitIsWeak) {
    recommendedAction = "avoid";
    reasons.push("High risk with weak profit — avoid this flip.");
  } else if (riskLevel === "high" && profitIsStrong) {
    recommendedAction = "buy";
    reasons.push("High risk but strong profit — buy only if you’re comfortable with risk.");
  } else if (riskLevel === "medium" && profitIsStrong) {
    recommendedAction = "buy";
    reasons.push("Balanced risk with strong profit — good candidate.");
  } else if (riskLevel === "low" && profitIsStrong) {
    recommendedAction = "buy";
    reasons.push("Low risk and strong profit — ideal flip.");
  } else if (riskLevel === "low" && profitIsWeak) {
    recommendedAction = "hold";
    reasons.push("Low risk but weak profit — only buy if stock is needed.");
  } else if (sellPrice != null && buyPrice != null && sellPrice > buyPrice) {
    recommendedAction = "sell";
    reasons.push("Already profitable — consider selling now.");
  }

  return {
    id: vehicle.id,
    title: vehicle.title,

    recommendedBuyPrice: buyPrice,
    recommendedSellPrice: sellPrice,

    riskLevel,
    motRiskDays,
    motRiskLabel,

    expectedFlipTimeDays,
    expectedProfit,

    confidence,
    recommendedAction,

    reasons,
  };
}
