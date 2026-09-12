import { FlipRecord } from "./FlipRecord";
import { runSupernovaEngine } from "./SupernovaEngine";

export interface SupernovaScoreResult {
  score: number;            // 0–100
  risk: number;             // 0–100
  profit: number;           // 0–100
  motHealth: number;        // 0–100
  buyEfficiency: number;    // 0–100
  flipSpeed: number;        // 0–100
  confidence: number;       // 0–100

  insights: string[];
}

export function calculateSupernovaScore(vehicles: FlipRecord[]): SupernovaScoreResult {
  if (vehicles.length === 0) {
    return {
      score: 0,
      risk: 0,
      profit: 0,
      motHealth: 0,
      buyEfficiency: 0,
      flipSpeed: 0,
      confidence: 0,
      insights: ["No vehicles yet — Supernova Score unavailable."]
    };
  }

  const results = vehicles.map((v) => runSupernovaEngine(v));

  // RISK SCORE (lower risk = higher score)
  const riskValues = results.map((r) =>
    r.riskLevel === "low" ? 100 :
    r.riskLevel === "medium" ? 60 :
    20
  );
  const risk = avg(riskValues);

  // PROFIT SCORE
  const profitValues = results.map((r) =>
    r.expectedProfit != null
      ? Math.min(100, Math.max(0, r.expectedProfit / 20))
      : 50
  );
  const profit = avg(profitValues);

  // MOT HEALTH SCORE
  const motValues = results.map((r) =>
    r.motRiskLabel === "healthy" ? 100 :
    r.motRiskLabel === "warning" ? 70 :
    r.motRiskLabel === "critical" ? 40 :
    20
  );
  const motHealth = avg(motValues);

  // BUY EFFICIENCY SCORE
  const buyValues = vehicles.map((v) => {
    const valuation = v.valuation ?? v.aiValuation?.estimatedValue ?? null;
    if (!valuation || !v.buyPrice) return 50;
    const eff = (valuation - v.buyPrice) / valuation;
    return Math.min(100, Math.max(0, eff * 100));
  });
  const buyEfficiency = avg(buyValues);

  // FLIP SPEED SCORE
  const speedValues = results.map((r) =>
    r.expectedFlipTimeDays != null
      ? r.expectedFlipTimeDays <= 14 ? 100 :
        r.expectedFlipTimeDays <= 30 ? 70 :
        r.expectedFlipTimeDays <= 60 ? 40 :
        20
      : 50
  );
  const flipSpeed = avg(speedValues);

  // CONFIDENCE SCORE
  const confidence = avg(results.map((r) => r.confidence));

  // FINAL SUPERNOVA SCORE (weighted)
  const score = Math.round(
    risk * 0.25 +
    profit * 0.25 +
    motHealth * 0.15 +
    buyEfficiency * 0.15 +
    flipSpeed * 0.10 +
    confidence * 0.10
  );

  const insights = generateInsights(score, risk, profit, motHealth, buyEfficiency, flipSpeed);

  return {
    score,
    risk,
    profit,
    motHealth,
    buyEfficiency,
    flipSpeed,
    confidence,
    insights,
  };
}

function avg(arr: number[]): number {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function generateInsights(
  score: number,
  risk: number,
  profit: number,
  motHealth: number,
  buyEfficiency: number,
  flipSpeed: number
): string[] {
  const insights: string[] = [];

  if (score >= 85) insights.push("Your dealership is operating at Supernova level.");
  else if (score >= 70) insights.push("Strong dealership performance — close to Supernova.");
  else if (score >= 50) insights.push("Moderate performance — improvements possible.");
  else insights.push("Dealership performance is weak — high risk or low profit.");

  if (risk >= 80) insights.push("Risk profile is excellent.");
  else if (risk <= 40) insights.push("High-risk vehicles detected.");

  if (profit >= 80) insights.push("Profit margins are strong.");
  else if (profit <= 40) insights.push("Profit margins are weak.");

  if (motHealth >= 80) insights.push("MOT health is strong.");
  else if (motHealth <= 40) insights.push("MOT risk is dragging down performance.");

  if (buyEfficiency >= 80) insights.push("Buying efficiency is excellent.");
  else if (buyEfficiency <= 40) insights.push("You may be overpaying for vehicles.");

  if (flipSpeed >= 80) insights.push("Flip speed is excellent.");
  else if (flipSpeed <= 40) insights.push("Slow flip times detected.");

  return insights;
}
