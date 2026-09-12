// src/dealer/intelligence/dealerAI.ts

import type { Vehicle } from "../../types/Vehicle";

/**
 * Compute a Supernova-style overall intelligence score for the vehicle.
 */
function computeSupernovaScore(vehicle: Vehicle): number {
  const yearSafe = vehicle.year ?? 0;
  const mileageSafe = vehicle.mileage ?? 0;
  const retailSafe = vehicle.priceRetail ?? 0;
  const tradeSafe = vehicle.priceTrade ?? 0;

  const age = new Date().getFullYear() - yearSafe;

  const heatFactor = vehicle.marketHeat;
  const riskFactor = 100 - vehicle.riskScore;
  const mileageFactor = Math.max(0, 100 - mileageSafe / 1000);
  const priceSpread = Math.max(0, retailSafe - tradeSafe);

  const base =
    heatFactor * 0.3 +
    riskFactor * 0.25 +
    mileageFactor * 0.2 +
    (priceSpread > 0 ? 15 : 0) -
    age * 1.5;

  return Math.max(0, Math.min(100, Math.round(base)));
}

/**
 * Flip difficulty: how hard this car is to flip profitably.
 */
function computeFlipDifficulty(vehicle: Vehicle): number {
  const mileageSafe = vehicle.mileage ?? 0;

  const mileageFactor = mileageSafe / 1000;
  const riskFactor = vehicle.riskScore / 2;
  const heatFactor = (100 - vehicle.marketHeat) / 3;

  const base = mileageFactor + riskFactor + heatFactor;

  return Math.max(0, Math.min(100, Math.round(base)));
}

/**
 * Valuation confidence: how “solid” the pricing feels.
 */
function computeValuationConfidence(vehicle: Vehicle): number {
  const retailSafe = vehicle.priceRetail ?? 0;
  const tradeSafe = vehicle.priceTrade ?? 0;

  const spread = retailSafe - tradeSafe;
  const spreadScore = Math.max(0, 40 - spread / 250);
  const heatScore = vehicle.marketHeat / 2;
  const riskScore = (100 - vehicle.riskScore) / 3;

  const base = spreadScore + heatScore + riskScore;

  return Math.max(0, Math.min(100, Math.round(base)));
}

/**
 * Photo quality: simple heuristic based on condition + status.
 */
function computePhotoQuality(vehicle: Vehicle): number {
  const conditionBoost =
    vehicle.condition === "Excellent"
      ? 20
      : vehicle.condition === "Good"
      ? 10
      : 0;

  const statusBoost =
    vehicle.status === "In Stock"
      ? 10
      : vehicle.status === "In Prep"
      ? 5
      : 0;

  const base = 50 + conditionBoost + statusBoost;

  return Math.max(0, Math.min(100, Math.round(base)));
}

/**
 * Auction delta: estimated % difference between retail and auction.
 */
function computeAuctionDelta(vehicle: Vehicle): number {
  const riskFactor = vehicle.riskScore / 2;
  const heatFactor = (100 - vehicle.marketHeat) / 3;
  const basePercent = 5 + riskFactor * 0.3 + heatFactor * 0.2;

  return Math.max(0, Math.min(40, Math.round(basePercent)));
}

/**
 * Buyer persona generator.
 */
function generateBuyerPersona(vehicle: Vehicle): string[] {
  const retailSafe = vehicle.priceRetail ?? 0;

  const personas: string[] = [];

  if (retailSafe > 25000) {
    personas.push("Performance Enthusiast", "Status-Conscious Buyer");
  } else if (retailSafe > 15000) {
    personas.push("Comfort & Tech Seeker");
  } else {
    personas.push("Budget-Conscious Commuter");
  }

  if (vehicle.condition === "Excellent") {
    personas.push("Low-Risk Buyer");
  } else if (vehicle.condition === "Fair") {
    personas.push("DIY Mechanic / Enthusiast");
  }

  if (vehicle.marketHeat > 85) {
    personas.push("FOMO Buyer");
  }

  return Array.from(new Set(personas));
}

/**
 * Seller psychology tags.
 */
function generateSellerPsychology(vehicle: Vehicle): string[] {
  const retailSafe = vehicle.priceRetail ?? 0;
  const tradeSafe = vehicle.priceTrade ?? 0;

  const tags: string[] = [];
  const spread = retailSafe - tradeSafe;

  if (spread > 4000) tags.push("Profit Maximiser");
  else if (spread < 2000) tags.push("Quick Turnover Focused");

  if (vehicle.status === "In Prep") tags.push("Detail-Oriented Presentation");
  if (vehicle.riskScore > 50) tags.push("Risk Offloader");
  if (vehicle.marketHeat > 90) tags.push("Market Timing Strategist");

  return Array.from(new Set(tags));
}

/**
 * Predicted repairs based on MOT advisories + mileage.
 */
function predictRepairs(vehicle: Vehicle) {
  const mileageSafe = vehicle.mileage ?? 0;

  const predictions: {
    component: string;
    likelihood: number;
    cost: number;
  }[] = [];

  const advisories = vehicle.mot.advisories || [];

  advisories.forEach((adv) => {
    const lower = adv.toLowerCase();

    if (lower.includes("tyre")) {
      predictions.push({ component: "Tyres", likelihood: 80, cost: 300 });
    } else if (lower.includes("pads") || lower.includes("brake")) {
      predictions.push({ component: "Brakes", likelihood: 75, cost: 250 });
    } else if (lower.includes("oil leak")) {
      predictions.push({
        component: "Engine Seals / Gaskets",
        likelihood: 65,
        cost: 450,
      });
    } else if (lower.includes("suspension")) {
      predictions.push({
        component: "Suspension Components",
        likelihood: 70,
        cost: 500,
      });
    } else {
      predictions.push({
        component: "General Wear Item",
        likelihood: 50,
        cost: 200,
      });
    }
  });

  if (mileageSafe > 90000) {
    predictions.push({
      component: "Clutch / Drivetrain",
      likelihood: 60,
      cost: 700,
    });
  }

  return predictions;
}

/**
 * Main entry: enrich a Vehicle with AI intelligence fields.
 */
export function enrichVehicleWithAI(base: Vehicle): Vehicle {
  return {
    ...base,
    supernovaScore: computeSupernovaScore(base),
    flipDifficulty: computeFlipDifficulty(base),
    valuationConfidence: computeValuationConfidence(base),
    photoQuality: computePhotoQuality(base),
    auctionDelta: computeAuctionDelta(base),
    buyerPersona: generateBuyerPersona(base),
    sellerPsychology: generateSellerPsychology(base),
    predictedRepairs: predictRepairs(base),
  };
}
