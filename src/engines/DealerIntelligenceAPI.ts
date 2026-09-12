// src/features/dealer-ai/DealerIntelligenceAPI.ts

import { FlipRecord } from "../features/vehicles/models/FlipRecord";
import { motAiEngine } from "@/engines/motAiEngine";
import { matchEngine } from "./MatchEngine";

/* -------------------------------------------------------
   TYPES
------------------------------------------------------- */

export type MarketHeatSummary = {
  totalVehicles: number;
  soldCount: number;
  stockCount: number;
  avgFlipTimeDays: number;
  totalProfit: number;
};

export type RiskRadarSummary = {
  motFailures: number;
  motAdvisoriesHeavy: number;
  lossMakingFlips: number;
};

export type ProfitConsistencySummary = {
  avgProfit: number;
  bestProfit: number;
  worstProfit: number;
  profitableCount: number;
  lossCount: number;
};

export type MotHealthSummary = {
  expiredMOT: number;
  mot30Days: number;
  mot60Days: number;
};

export type FlipTimeSummary = {
  avgFlipTimeDays: number;
  fastestFlipDays: number | null;
  slowestFlipDays: number | null;
};

export type PriceEfficiencySummary = {
  avgMargin: number;
  underpricedCount: number;
  overpricedCount: number;
};

export type SmartAlertsSummary = {
  alerts: string[];
};

export type BusinessScoreSummary = {
  score: number;
  band: string;
};

export type DealerSummary = {
  marketHeat: MarketHeatSummary;
  riskRadar: RiskRadarSummary;
  profitConsistency: ProfitConsistencySummary;
  motHealth: MotHealthSummary;
  flipTime: FlipTimeSummary;
  priceEfficiency: PriceEfficiencySummary;
  smartAlerts: SmartAlertsSummary;
  businessScore: BusinessScoreSummary;
};

export type VehicleIntelligence = {
  matchScore: number;
  matchBand: string;
  motRiskPercent: number;
  profitForecast: number;
  aiPriceSuggestion: number;
  flipAdvice: string;
  autoListing: string;
};

export type MotAiIntelligence = ReturnType<typeof motAiEngine>;

export type MarketIntel = {
  marketAvg: number;
  demandIndex: number;
  competitorCount: number;
  priceDelta: number;
  sellTimeDays: number;
  pressureLevel: "undervalued" | "fair" | "overpriced";
  dealerRankPercent: number;
  sentimentScore: number;
};

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function daysBetween(
  start: string | null | undefined,
  end: string | null | undefined
): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return null;
  return Math.ceil((e - s) / 86400000);
}

function parseUkDate(dateStr?: string | null) {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

/* -------------------------------------------------------
   MARKET INTEL ENGINES
------------------------------------------------------- */

function marketValueEngine(vehicle: FlipRecord): number {
  const base =
    vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? 0;
  const mileage = vehicle.mileage ?? 60000;

  let adj = base;

  if (mileage > 120000) adj -= 800;
  else if (mileage > 90000) adj -= 500;
  else if (mileage < 40000) adj += 400;

  return Math.max(0, Math.round(adj));
}

function marketDemandEngine(vehicle: FlipRecord): number {
  const age = (vehicle as any).age ?? 8;
  const segment = (vehicle as any).segment ?? "hatchback";

  let demand = 50;

  if (segment === "suv") demand += 15;
  if (segment === "ev") demand += 10;
  if (segment === "diesel") demand -= 10;

  if (age > 10) demand -= 10;
  if (age < 5) demand += 10;

  return Math.min(100, Math.max(0, demand));
}

function competitorEngine(vehicle: FlipRecord, marketAvg: number): number {
  const mileage = vehicle.mileage ?? 80000;

  let competitors = Math.round((marketAvg / 5000) * 3);

  if (mileage < 60000) competitors += 2;
  if (mileage > 120000) competitors -= 1;

  return Math.max(1, competitors);
}

function pricingPressureEngine(
  vehicle: FlipRecord,
  marketAvg: number
): "undervalued" | "fair" | "overpriced" {
  const price =
    vehicle.sellPrice ?? vehicle.valuation ?? marketAvg;

  const delta = price - marketAvg;

  if (delta < -300) return "undervalued";
  if (delta > 700) return "overpriced";
  return "fair";
}

function sentimentEngine(vehicle: FlipRecord, marketAvg: number): number {
  const flipScore = vehicle.flipScore ?? 50;
  const priceDelta =
    (vehicle.sellPrice ?? vehicle.valuation ?? marketAvg) - marketAvg;

  let sentiment = flipScore;

  if (priceDelta < 0) sentiment += 10;
  if (priceDelta > 500) sentiment -= 10;

  return Math.min(100, Math.max(0, sentiment));
}

function sellTimeEngine(demand: number, daysListed: number): number {
  let days = 14 - demand / 8 + daysListed / 4;
  return Math.max(3, Math.round(days));
}

export function marketIntelEngine(vehicle: FlipRecord): MarketIntel {
  const marketAvg = marketValueEngine(vehicle);
  const demandIndex = marketDemandEngine(vehicle);
  const competitorCount = competitorEngine(vehicle, marketAvg);
  const pressureLevel = pricingPressureEngine(vehicle, marketAvg);
  const sentimentScore = sentimentEngine(vehicle, marketAvg);
  const sellTimeDays = sellTimeEngine(
    demandIndex,
    (vehicle as any).daysListed ?? 0
  );

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

/* -------------------------------------------------------
   MARKET HEAT
------------------------------------------------------- */

export function getMarketHeatSummary(
  vehicles: FlipRecord[]
): MarketHeatSummary {
  const sold = vehicles.filter(v => v.sellDate);
  const stock = vehicles.filter(v => !v.sellDate);

  const totalProfit = sold.reduce((sum, v) => {
    const profit =
      (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
    return sum + profit;
  }, 0);

  const flipTimes = sold
    .map(v =>
      daysBetween(v.buyDate ?? v.timestamp, v.sellDate ?? v.timestamp)
    )
    .filter((d): d is number => d !== null);

  const avgFlipTime =
    flipTimes.length > 0
      ? Math.round(
          flipTimes.reduce((a, b) => a + b, 0) / flipTimes.length
        )
      : 0;

  return {
    totalVehicles: vehicles.length,
    soldCount: sold.length,
    stockCount: stock.length,
    avgFlipTimeDays: avgFlipTime,
    totalProfit,
  };
}

/* -------------------------------------------------------
   RISK RADAR
------------------------------------------------------- */

export function getRiskRadarSummary(
  vehicles: FlipRecord[]
): RiskRadarSummary {
  let motFailures = 0;
  let motAdvisoriesHeavy = 0;
  let lossMakingFlips = 0;

  vehicles.forEach(v => {
    const mot = v.mot ?? {};
    const failures = mot.failures ?? [];
    const advisories = mot.advisories ?? [];
    const status = mot.motStatus ?? "pass";

    if (status === "fail" || failures.length > 0) motFailures++;
    if (advisories.length > 3) motAdvisoriesHeavy++;

    const profit =
      (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
    if (v.sellDate && profit < 0) lossMakingFlips++;
  });

  return {
    motFailures,
    motAdvisoriesHeavy,
    lossMakingFlips,
  };
}

/* -------------------------------------------------------
   PROFIT CONSISTENCY
------------------------------------------------------- */

export function getProfitConsistencySummary(
  vehicles: FlipRecord[]
): ProfitConsistencySummary {
  const sold = vehicles.filter(v => v.sellDate);
  const profits = sold.map(
    v => (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0)
  );

  const avgProfit =
    profits.length > 0
      ? Math.round(
          (profits.reduce((a, b) => a + b, 0) / profits.length) *
            100
        ) / 100
      : 0;

  const bestProfit = profits.length > 0 ? Math.max(...profits) : 0;
  const worstProfit = profits.length > 0 ? Math.min(...profits) : 0;

  const profitableCount = profits.filter(p => p > 0).length;
  const lossCount = profits.filter(p => p < 0).length;

  return {
    avgProfit,
    bestProfit,
    worstProfit,
    profitableCount,
    lossCount,
  };
}

/* -------------------------------------------------------
   MOT HEALTH
------------------------------------------------------- */

export function getMotHealthSummary(
  vehicles: FlipRecord[]
): MotHealthSummary {
  const now = new Date();

  const expiredMOT = vehicles.filter(v => {
    const d = parseUkDate(
      v.mot?.motExpiry ?? v.mot?.expiryDate ?? null
    );
    return d !== null && d.getTime() < now.getTime();
  });

  const mot30 = vehicles.filter(v => {
    const d = parseUkDate(
      v.mot?.motExpiry ?? v.mot?.expiryDate ?? null
    );
    if (!d) return false;
    const diffDays = Math.ceil(
      (d.getTime() - now.getTime()) / 86400000
    );
    return diffDays > 0 && diffDays <= 30;
  });

  const mot60 = vehicles.filter(v => {
    const d = parseUkDate(
      v.mot?.motExpiry ?? v.mot?.expiryDate ?? null
    );
    if (!d) return false;
    const diffDays = Math.ceil(
      (d.getTime() - now.getTime()) / 86400000
    );
    return diffDays > 30 && diffDays <= 60;
  });

  return {
    expiredMOT: expiredMOT.length,
    mot30Days: mot30.length,
    mot60Days: mot60.length,
  };
}

/* -------------------------------------------------------
   FLIP TIME
------------------------------------------------------- */

export function getFlipTimeSummary(
  vehicles: FlipRecord[]
): FlipTimeSummary {
  const sold = vehicles.filter(v => v.sellDate);

  const flipTimes = sold
    .map(v =>
      daysBetween(v.buyDate ?? v.timestamp, v.sellDate ?? v.timestamp)
    )
    .filter((d): d is number => d !== null);

  const avgFlipTime =
    flipTimes.length > 0
      ? Math.round(
          flipTimes.reduce((a, b) => a + b, 0) / flipTimes.length
        )
      : 0;

  const fastestFlip =
    flipTimes.length > 0 ? Math.min(...flipTimes) : null;
  const slowestFlip =
    flipTimes.length > 0 ? Math.max(...flipTimes) : null;

  return {
    avgFlipTimeDays: avgFlipTime,
    fastestFlipDays: fastestFlip,
    slowestFlipDays: slowestFlip,
  };
}

/* -------------------------------------------------------
   PRICE EFFICIENCY
------------------------------------------------------- */

export function getPriceEfficiencySummary(
  vehicles: FlipRecord[]
): PriceEfficiencySummary {
  const sold = vehicles.filter(v => v.sellDate);

  const margins = sold.map(v => {
    const sell = v.sellPrice ?? v.valuation ?? 0;
    const buy = v.buyPrice ?? 0;
    return sell - buy;
  });

  const avgMargin =
    margins.length > 0
      ? Math.round(
          (margins.reduce((a, b) => a + b, 0) / margins.length) *
            100
        ) / 100
      : 0;

  let underpricedCount = 0;
  let overpricedCount = 0;

  sold.forEach(v => {
    const aiPrice =
      v.aiPrice?.recommendedSellPrice ?? v.valuation ?? null;
    const sell = v.sellPrice ?? null;
    if (aiPrice == null || sell == null) return;

    if (sell < aiPrice * 0.9) underpricedCount++;
    if (sell > aiPrice * 1.1) overpricedCount++;
  });

  return {
    avgMargin,
    underpricedCount,
    overpricedCount,
  };
}

/* -------------------------------------------------------
   SMART ALERTS
------------------------------------------------------- */

export function getSmartAlertsSummary(
  vehicles: FlipRecord[]
): SmartAlertsSummary {
  const alerts: string[] = [];

  vehicles.forEach(v => {
    const mot = v.mot ?? {};
    const failures = mot.failures ?? [];
    const advisories = mot.advisories ?? [];
    const status = mot.motStatus ?? "pass";
    const reg = mot.reg ?? v.title;

    if (status === "fail") alerts.push(`❗ ${reg}: MOT failed`);
    if (advisories.length > 3)
      alerts.push(`⚠️ ${reg}: High advisory count`);
    if (failures.length > 0)
      alerts.push(`🔧 ${reg}: MOT failures present`);

    const profit =
      (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
    if (v.sellDate && profit < 0)
      alerts.push(`📉 ${reg}: Sold at a loss`);
  });

  return { alerts };
}

/* -------------------------------------------------------
   BUSINESS SCORE
------------------------------------------------------- */

export function getBusinessScoreSummary(
  vehicles: FlipRecord[]
): BusinessScoreSummary {
  const market = getMarketHeatSummary(vehicles);
  const profit = getProfitConsistencySummary(vehicles);
  const risk = getRiskRadarSummary(vehicles);

  let score = 50;

  score += Math.min(30, profit.avgProfit / 100);
  score += Math.max(-20, -risk.lossMakingFlips * 2);
  score += Math.max(-20, -risk.motFailures * 2);

  if (market.avgFlipTimeDays <= 14) score += 10;
  else if (market.avgFlipTimeDays >= 45) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let band = "Average";
  if (score >= 80) band = "Elite";
  else if (score >= 60) band = "Strong";
  else if (score <= 40) band = "Weak";

  return { score, band };
}

/* -------------------------------------------------------
   DEALER SUMMARY (ALL ENGINES)
------------------------------------------------------- */

export function getDealerSummary(
  vehicles: FlipRecord[]
): DealerSummary {
  return {
    marketHeat: getMarketHeatSummary(vehicles),
    riskRadar: getRiskRadarSummary(vehicles),
    profitConsistency: getProfitConsistencySummary(vehicles),
    motHealth: getMotHealthSummary(vehicles),
    flipTime: getFlipTimeSummary(vehicles),
    priceEfficiency: getPriceEfficiencySummary(vehicles),
    smartAlerts: getSmartAlertsSummary(vehicles),
    businessScore: getBusinessScoreSummary(vehicles),
  };
}

/* -------------------------------------------------------
   VEHICLE INTELLIGENCE (AI + MATCH ENGINE + MARKET INTEL)
------------------------------------------------------- */

export function getVehicleIntelligence(
  vehicle: FlipRecord,
  buyer: any,
  ai: any
): VehicleIntelligence & { market: MarketIntel } {
  const match = matchEngine.evaluate(vehicle, buyer, ai);

  const motRisk = ai.motRiskScore(vehicle);
  const profitForecast = ai.profitForecast(vehicle);
  const aiPrice = ai.priceVehicle(vehicle);
  const flipAdvice = ai.flipAdvice(vehicle);
  const autoListing = ai.autoWriteListing(vehicle);

  const market = marketIntelEngine(vehicle);

  return {
    matchScore: match.score,
    matchBand: match.band,
    motRiskPercent: Math.round(motRisk),
    profitForecast,
    aiPriceSuggestion: aiPrice,
    flipAdvice,
    autoListing,
    market,
  };
}

/* -------------------------------------------------------
   MOT AI INTELLIGENCE
------------------------------------------------------- */

export function getMotAiIntelligence(
  vehicle: FlipRecord
): MotAiIntelligence {
  return motAiEngine(vehicle.mot ?? {}, [
    { mileage: vehicle.mileage ?? 0 },
  ]);
}

/* -------------------------------------------------------
   FLEET INTELLIGENCE / FORECAST
------------------------------------------------------- */

export function forecastDealerPerformance(vehicles: FlipRecord[]) {
  const summary = getDealerSummary(vehicles);

  const projectedProfit3Months =
    summary.marketHeat.totalProfit * 1.1;

  const riskIndex =
    summary.riskRadar.motFailures * 2 +
    summary.riskRadar.lossMakingFlips * 3 +
    summary.riskRadar.motAdvisoriesHeavy;

  return {
    summary,
    projectedProfit3Months,
    riskIndex,
  };
}

/* -------------------------------------------------------
   ⭐ V3 — DEALERSHIP SCORE (FLEET-LEVEL)
------------------------------------------------------- */

export function scoreDealership(vehicles: FlipRecord[]) {
  const summary = getDealerSummary(vehicles);

  const { marketHeat, profitConsistency, riskRadar, motHealth } =
    summary;

  let score = 50;

  score += Math.min(25, profitConsistency.avgProfit / 100);
  score += Math.min(15, marketHeat.soldCount * 1.5);
  score += Math.max(-10, -marketHeat.stockCount * 0.5);

  score += Math.max(-20, -riskRadar.motFailures * 2);
  score += Math.max(-15, -riskRadar.lossMakingFlips * 2);
  score += Math.max(-10, -motHealth.expiredMOT * 1.5);

  if (marketHeat.avgFlipTimeDays <= 14) score += 10;
  else if (marketHeat.avgFlipTimeDays >= 45) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let band: "Elite" | "Strong" | "Average" | "Weak" = "Average";
  if (score >= 80) band = "Elite";
  else if (score >= 60) band = "Strong";
  else if (score <= 40) band = "Weak";

  return {
    score,
    band,
    summary,
  };
}

/* -------------------------------------------------------
   ⭐ V3 — FLEET INTELLIGENCE SNAPSHOT
------------------------------------------------------- */

export function getFleetIntelligence(vehicles: FlipRecord[]) {
  const summary = getDealerSummary(vehicles);
  const forecast = forecastDealerPerformance(vehicles);
  const dealership = scoreDealership(vehicles);

  return {
    summary,
    forecast,
    dealership,
  };
}

/* -------------------------------------------------------
   ⭐ V3 — DEALER REPORT (STRUCTURED OBJECT)
------------------------------------------------------- */

export function generateDealerReport(vehicles: FlipRecord[]) {
  const fleet = getFleetIntelligence(vehicles);

  const { summary, forecast, dealership } = fleet;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      vehicleCount: summary.marketHeat.totalVehicles,
    },
    dealershipScore: dealership.score,
    dealershipBand: dealership.band,
    marketHeat: summary.marketHeat,
    riskRadar: summary.riskRadar,
    profitConsistency: summary.profitConsistency,
    motHealth: summary.motHealth,
    flipTime: summary.flipTime,
    priceEfficiency: summary.priceEfficiency,
    smartAlerts: summary.smartAlerts,
    businessScore: summary.businessScore,
    forecast: {
      projectedProfit3Months: forecast.projectedProfit3Months,
      riskIndex: forecast.riskIndex,
    },
  };
}

/* -------------------------------------------------------
   ⭐ V4 — SOURCING AI (Find Best Cars to Buy Next)
------------------------------------------------------- */

export function sourcingRecommendations(vehicles: FlipRecord[]) {
  return vehicles
    .filter(v => !v.sellDate)
    .map(v => {
      const margin =
        (v.valuation ?? v.sellPrice ?? 0) - (v.buyPrice ?? 0);
      const risk = v.mot?.failures?.length ?? 0;
      const score = margin - risk * 150;

      return {
        vehicle: v,
        score,
        reason:
          score > 1500
            ? "High profit potential"
            : score > 800
            ? "Good flip candidate"
            : score > 300
            ? "Moderate opportunity"
            : "Low sourcing priority",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/* -------------------------------------------------------
   ⭐ V4 — DEALERSHIP RISK MATRIX
------------------------------------------------------- */

export function dealershipRiskMatrix(vehicles: FlipRecord[]) {
  return vehicles
    .map(v => {
      const motRisk = v.mot?.failures?.length ?? 0;
      const fraudRisk = v.mot?.motStatus === "fail" ? 40 : 0;
      const flipRisk = (v.flipScore ?? 50) < 40 ? 30 : 0;

      const totalRisk = motRisk * 10 + fraudRisk + flipRisk;

      return {
        vehicle: v,
        totalRisk,
        band:
          totalRisk >= 80
            ? "Critical"
            : totalRisk >= 50
            ? "High"
            : totalRisk >= 25
            ? "Medium"
            : "Low",
      };
    })
    .sort((a, b) => b.totalRisk - a.totalRisk);
}

/* -------------------------------------------------------
   ⭐ V4 — MULTI‑VEHICLE FORECASTING
------------------------------------------------------- */

export function forecastFleet(vehicles: FlipRecord[]) {
  const summary = getDealerSummary(vehicles);

  const projectedSales = Math.round(
    summary.marketHeat.soldCount * 1.2
  );
  const projectedProfit = Math.round(
    summary.marketHeat.totalProfit * 1.15
  );

  const riskLevel =
    summary.riskRadar.motFailures * 2 +
    summary.riskRadar.lossMakingFlips * 3 +
    summary.riskRadar.motAdvisoriesHeavy;

  return {
    projectedSales,
    projectedProfit,
    riskLevel,
    band:
      riskLevel >= 80
        ? "Critical"
        : riskLevel >= 50
        ? "High"
        : riskLevel >= 25
        ? "Medium"
        : "Low",
  };
}

/* -------------------------------------------------------
   ⭐ V4 — CRM SCORING ENGINE
------------------------------------------------------- */

export function crmIntelligence(leads: any[]) {
  return leads.map(lead => {
    const msg = lead.message?.toLowerCase() ?? "";
    const lengthScore =
      msg.length > 80 ? 30 : msg.length > 40 ? 20 : 10;
    const urgencyScore = msg.includes("today")
      ? 30
      : msg.includes("urgent")
      ? 20
      : 5;
    const intentScore = lead.requestedTestDrive
      ? 40
      : lead.sentMultipleMessages
      ? 25
      : 10;

    const total = lengthScore + urgencyScore + intentScore;

    return {
      lead,
      score: Math.min(100, total),
      band:
        total >= 80
          ? "Hot Lead"
          : total >= 60
          ? "Warm Lead"
          : total >= 40
          ? "Cool Lead"
          : "Cold Lead",
    };
  });
}

/* -------------------------------------------------------
   ⭐ V4 — MARKETING INTELLIGENCE
------------------------------------------------------- */

export function marketingIntelligence(vehicles: FlipRecord[]) {
  return vehicles.map(v => {
    const views =
      Math.floor(Math.random() * (300 - 80 + 1)) + 80;
    const saves =
      Math.floor(Math.random() * (20 - 3 + 1)) + 3;
    const messages =
      Math.floor(Math.random() * (12 - 1 + 1)) + 1;

    const engagementScore = Math.round(
      views * 0.3 + saves * 5 + messages * 10
    );

    return {
      vehicle: v,
      engagementScore,
      band:
        engagementScore >= 120
          ? "High"
          : engagementScore >= 80
          ? "Medium"
          : "Low",
      strategy:
        engagementScore >= 120
          ? "Boost listing — high traction"
          : engagementScore >= 80
          ? "Refresh photos — moderate traction"
          : "Reduce price — low traction",
    };
  });
}

/* -------------------------------------------------------
   ⭐ V4 — FULL DEALERSHIP INTELLIGENCE PACKAGE
------------------------------------------------------- */

export function getDealershipIntelligence(
  vehicles: FlipRecord[],
  leads: any[]
) {
  return {
    summary: getDealerSummary(vehicles),
    forecast: forecastFleet(vehicles),
    sourcing: sourcingRecommendations(vehicles),
    riskMatrix: dealershipRiskMatrix(vehicles),
    crm: crmIntelligence(leads),
    marketing: marketingIntelligence(vehicles),
    dealershipScore: scoreDealership(vehicles),
    report: generateDealerReport(vehicles),
  };
}

/* -------------------------------------------------------
   ⭐ V5 — DEALERSHIP HEALTH SCORE (Global Intelligence)
------------------------------------------------------- */

export function dealershipHealthScore(vehicles: FlipRecord[]) {
  const summary = getDealerSummary(vehicles);

  const { marketHeat, profitConsistency, riskRadar, motHealth, priceEfficiency } =
    summary;

  let score = 50;

  score += Math.min(20, profitConsistency.avgProfit / 150);

  score +=
    marketHeat.avgFlipTimeDays <= 20
      ? 15
      : marketHeat.avgFlipTimeDays <= 35
      ? 5
      : -10;

  score -= riskRadar.motFailures * 2;
  score -= riskRadar.lossMakingFlips * 3;

  score -= motHealth.expiredMOT * 1.5;

  score += Math.min(10, priceEfficiency.avgMargin / 200);

  score = Math.max(0, Math.min(100, Math.round(score)));

  const band =
    score >= 80
      ? "Excellent"
      : score >= 60
      ? "Strong"
      : score >= 40
      ? "Moderate"
      : "Weak";

  return { score, band };
}

/* -------------------------------------------------------
   ⭐ V5 — STOCK ROTATION OPTIMIZER
------------------------------------------------------- */

export function stockRotationOptimizer(vehicles: FlipRecord[]) {
  return vehicles.map(v => {
    const days = (v as any).daysListed ?? 0;

    const flipScore = v.flipScore ?? 50;
    const motRisk = v.mot?.failures?.length ?? 0;

    let action = "Hold";

    if (days > 60 && flipScore < 40) action = "Wholesale";
    else if (days > 45) action = "Reduce Price";
    else if (days > 30) action = "Refresh Photos";
    else if (motRisk > 2) action = "Repair MOT Issues";

    return {
      vehicle: v,
      daysListed: days,
      flipScore,
      motRisk,
      recommendedAction: action,
    };
  });
}

/* -------------------------------------------------------
   ⭐ V5 — PROFITABILITY SIMULATOR
------------------------------------------------------- */

export function profitabilitySimulator(
  vehicle: FlipRecord,
  adjustments: {
    priceChange?: number;
    reconCost?: number;
    aprChange?: number;
    depositChange?: number;
  }
) {
  const baseSell = vehicle.sellPrice ?? vehicle.valuation ?? 0;
  const baseBuy = vehicle.buyPrice ?? 0;

  const newSell = baseSell + (adjustments.priceChange ?? 0);
  const recon = adjustments.reconCost ?? 0;

  const profit = newSell - baseBuy - recon;

  const aprImpact = adjustments.aprChange
    ? adjustments.aprChange * 12
    : 0;
  const depositImpact = adjustments.depositChange ?? 0;

  return {
    originalProfit: baseSell - baseBuy,
    newProfit: profit,
    aprImpact,
    depositImpact,
    recommendation:
      profit > 1500
        ? "Strong profit — list immediately"
        : profit > 800
        ? "Good profit — proceed"
        : profit > 300
        ? "Moderate — consider price boost"
        : "Weak — consider wholesale",
  };
}

/* -------------------------------------------------------
   ⭐ V5 — BUYER–VEHICLE MATCHING ENGINE
------------------------------------------------------- */

export function buyerVehicleMatch(
  vehicle: FlipRecord,
  buyer: any
) {
  const credit = buyer?.creditScore ?? 600;
  const budget = buyer?.budget ?? vehicle.price ?? 0;
  const persona = buyer?.persona ?? "General";

  const price = vehicle.price ?? vehicle.valuation ?? 0;
  const condition = (vehicle as any).conditionScore ?? 70;

  let score = 50;

  score += price <= budget ? 20 : -10;

  score += credit > 700 ? 15 : credit > 550 ? 5 : -10;

  score += condition > 70 ? 10 : condition < 50 ? -10 : 0;

  if (persona === "Premium" && price > 8000) score += 10;
  if (persona === "Budget" && price < 3000) score += 10;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    band:
      score >= 80
        ? "Perfect Match"
        : score >= 60
        ? "Strong Match"
        : score >= 40
        ? "Moderate Match"
        : "Weak Match",
  };
}

/* -------------------------------------------------------
   ⭐ V5 — WHOLESALE VS RETAIL AI
------------------------------------------------------- */

export function wholesaleVsRetailAI(vehicle: FlipRecord) {
  const profit =
    (vehicle.sellPrice ?? vehicle.valuation ?? 0) -
    (vehicle.buyPrice ?? 0);
  const motRisk = vehicle.mot?.failures?.length ?? 0;
  const flipScore = vehicle.flipScore ?? 50;

  let recommendation = "Retail";

  if (motRisk > 3) recommendation = "Wholesale";
  if (flipScore < 40) recommendation = "Wholesale";
  if (profit < 300) recommendation = "Wholesale";

  return {
    profit,
    motRisk,
    flipScore,
    recommendation,
  };
}

/* -------------------------------------------------------
   ⭐ V5 — DEALER STRATEGY ENGINE
------------------------------------------------------- */

export function dealerStrategyEngine(vehicles: FlipRecord[]) {
  const health = dealershipHealthScore(vehicles);
  const risk = dealershipRiskMatrix(vehicles);
  const avgRisk =
    risk.reduce((a, b) => a + b.totalRisk, 0) / risk.length;

  let strategy = "Balanced";

  if (health.score >= 80) strategy = "Aggressive Growth";
  else if (avgRisk > 60) strategy = "Risk Reduction";
  else if (health.score < 40) strategy = "Stock Rotation Priority";
  else if (avgRisk < 25) strategy = "Marketing Boost";

  return {
    health,
    avgRisk,
    strategy,
  };
}

/* -------------------------------------------------------
   ⭐ V5 — FULL DEALERSHIP HEALTH PACKAGE
------------------------------------------------------- */

export function getDealershipHealthPackage(
  vehicles: FlipRecord[],
  leads: any[]
) {
  return {
    healthScore: dealershipHealthScore(vehicles),
    rotation: stockRotationOptimizer(vehicles),
    strategy: dealerStrategyEngine(vehicles),
    wholesaleRetail: vehicles.map(v => wholesaleVsRetailAI(v)),
    buyerMatches: leads.map(l => ({
      lead: l,
      matches: vehicles.map(v => buyerVehicleMatch(v, l)),
    })),
    profitability: vehicles.map(v =>
      profitabilitySimulator(v, { priceChange: 0 })
    ),
  };
}

/* -------------------------------------------------------
   ⭐ V6 — DEALER GROWTH PROJECTION ENGINE
------------------------------------------------------- */

export function dealerGrowthProjection(vehicles: FlipRecord[]) {
  const summary = getDealerSummary(vehicles);

  const salesGrowth =
    summary.marketHeat.soldCount > 0
      ? Math.round(summary.marketHeat.soldCount * 1.3)
      : 0;

  const profitGrowth =
    summary.marketHeat.totalProfit > 0
      ? Math.round(summary.marketHeat.totalProfit * 1.25)
      : 0;

  const risk =
    summary.riskRadar.motFailures * 2 +
    summary.riskRadar.lossMakingFlips * 3;

  const growthBand =
    profitGrowth >= 5000
      ? "High Growth"
      : profitGrowth >= 2500
      ? "Moderate Growth"
      : profitGrowth >= 1000
      ? "Low Growth"
      : "Stagnant";

  return {
    projectedSalesNextQuarter: salesGrowth,
    projectedProfitNextQuarter: profitGrowth,
    risk,
    growthBand,
  };
}

/* -------------------------------------------------------
   ⭐ V6 — VEHICLE LIFECYCLE INTELLIGENCE
------------------------------------------------------- */

export function vehicleLifecycleIntelligence(
  vehicle: FlipRecord
) {
  const year = (vehicle as any).year;
  const age = year ? new Date().getFullYear() - year : 0;

  const mileage = vehicle.mileage ?? 0;

  let stage = "Active Retail";

  if (age > 15 || mileage > 150000) stage = "End of Life";
  else if (age > 10 || mileage > 120000) stage = "Late Retail";
  else if (age > 7 || mileage > 90000) stage = "Mid Retail";
  else if (age > 3 || mileage > 60000) stage = "Early Retail";

  const risk =
    (vehicle.mot?.failures?.length ?? 0) * 20 +
    ((vehicle.flipScore ?? 50) < 40 ? 20 : 0);

  return {
    stage,
    age,
    mileage,
    risk,
    recommendation:
      stage === "End of Life"
        ? "Wholesale recommended"
        : stage === "Late Retail"
        ? "Price reduction recommended"
        : stage === "Mid Retail"
        ? "Standard listing"
        : "Premium listing",
  };
}

/* -------------------------------------------------------
   ⭐ V6 — AI STOCK ACQUISITION PLANNER
------------------------------------------------------- */

export function stockAcquisitionPlanner(vehicles: FlipRecord[]) {
  return vehicles
    .map(v => {
      const profit =
        (v.valuation ?? v.sellPrice ?? 0) - (v.buyPrice ?? 0);
      const motRisk = v.mot?.failures?.length ?? 0;
      const flipScore = v.flipScore ?? 50;

      const acquisitionScore =
        profit / 10 - motRisk * 5 + flipScore * 1.2;

      return {
        vehicle: v,
        acquisitionScore,
        band:
          acquisitionScore >= 120
            ? "High Priority"
            : acquisitionScore >= 80
            ? "Medium Priority"
            : acquisitionScore >= 40
            ? "Low Priority"
            : "Avoid",
      };
    })
    .sort((a, b) => b.acquisitionScore - a.acquisitionScore);
}

/* -------------------------------------------------------
   ⭐ V6 — DEALER EFFICIENCY SCORE
------------------------------------------------------- */

export function dealerEfficiencyScore(vehicles: FlipRecord[]) {
  const summary = getDealerSummary(vehicles);

  const flipSpeedScore =
    summary.flipTime.avgFlipTimeDays <= 20
      ? 30
      : summary.flipTime.avgFlipTimeDays <= 35
      ? 15
      : 5;

  const pricingScore =
    summary.priceEfficiency.avgMargin > 800
      ? 30
      : summary.priceEfficiency.avgMargin > 400
      ? 15
      : 5;

  const riskScore =
    summary.riskRadar.lossMakingFlips === 0
      ? 20
      : summary.riskRadar.lossMakingFlips <= 2
      ? 10
      : 0;

  const total =
    flipSpeedScore + pricingScore + riskScore;

  const band =
    total >= 70
      ? "Highly Efficient"
      : total >= 50
      ? "Efficient"
      : total >= 30
      ? "Moderate"
      : "Inefficient";

  return {
    score: total,
    band,
  };
}
