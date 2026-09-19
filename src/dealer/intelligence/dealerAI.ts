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
    if (typeof adv !== "string") return; // not text: nothing to read a repair from
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A car read back from the server can lack pieces the scoring and the screens
 * take for granted: the server stores whatever car it is sent, and another
 * client (or an older version) may not have sent them. A car with no `mot`
 * object made the enrichment throw, and one throw made the whole stock fail to
 * load. This fills in the nested objects that are missing (and the two numbers
 * the scoring does arithmetic on) and touches nothing the car does have, so a
 * well-formed car comes back equal to how it went in.
 */
export function withSafeDefaults(car: Vehicle): Vehicle {
  const mot: Record<string, unknown> = isPlainObject(car.mot) ? car.mot : {};
  const finance: Record<string, unknown> = isPlainObject(car.finance) ? car.finance : {};
  return {
    ...car,
    marketHeat: car.marketHeat ?? 0,
    riskScore: car.riskScore ?? 0,
    mot: {
      ...mot,
      expiry: mot.expiry ?? "",
      advisories: Array.isArray(mot.advisories) ? mot.advisories : [],
      historyScore: mot.historyScore ?? 0,
      history: Array.isArray(mot.history) ? mot.history : [],
    },
    finance: {
      ...finance,
      apr: finance.apr ?? 0,
      depositMin: finance.depositMin ?? 0,
      lenderTier: finance.lenderTier ?? "A",
    },
    depreciationCurve: Array.isArray(car.depreciationCurve) ? car.depreciationCurve : [],
  } as Vehicle;
}

/**
 * Main entry: enrich a Vehicle with AI intelligence fields.
 */
export function enrichVehicleWithAI(car: Vehicle): Vehicle {
  const base = withSafeDefaults(car);
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

/**
 * Readies ONE car read from the server for display: fills in what it lacks and
 * adds the AI scores. If that fails for any reason the car is kept exactly as it
 * came, only without the scores, rather than costing the dealer their whole
 * stock over one odd record.
 */
export function prepareVehicle(car: Vehicle): Vehicle {
  try {
    return enrichVehicleWithAI(car);
  } catch (err) {
    console.error(`Could not add AI scores to vehicle ${String(car?.id)}; showing it without them.`, err);
    return car;
  }
}

/**
 * Readies a whole stock list, one car at a time, so one bad record can never
 * hide the rest. An entry that isn't a car at all (null, a number, text: the
 * server keeps whatever it once stored) can't be shown and is left out of what
 * is displayed. The server's copy is untouched, since saving never removes a car
 * just because it is missing from what is sent.
 */
export function prepareStock(list: readonly Vehicle[]): Vehicle[] {
  return list.filter((entry): entry is Vehicle => isPlainObject(entry)).map(prepareVehicle);
}
