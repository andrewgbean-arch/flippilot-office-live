import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export interface BuyOrWalkResult {
  recommendedBuyPrice: number;
  riskScore: number; // 0–100
  profitPotential: number; // 0–100
  confidence: number; // 0–100
  verdict: "BUY" | "MAYBE" | "WALK AWAY";
  notes: string[];
}

export function evaluateBuyOrWalk(vehicle: FlipRecord): BuyOrWalkResult {
  const notes: string[] = [];

  /* -------------------------------------------------------
     BASE VALUATION
  ------------------------------------------------------- */
  const valuation =
    vehicle.aiValuation?.estimatedValue ??
    vehicle.valuation ??
    vehicle.price ??
    0;

  /* -------------------------------------------------------
     MARKET SIGNALS
  ------------------------------------------------------- */
  const demand = vehicle.market?.demandScore ?? 50;

  const lowest =
    vehicle.market?.lowest ??
    (valuation > 0 ? valuation * 0.8 : 0);

  const highest =
    vehicle.market?.highest ??
    (valuation > 0 ? valuation * 1.2 : 0);

  /* -------------------------------------------------------
     RISK FACTORS
  ------------------------------------------------------- */
  const motFailures = vehicle.mot?.failures?.length ?? 0;
  const advisories = vehicle.mot?.advisories?.length ?? 0;
  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? 0;

  let riskScore = 0;

  riskScore += motFailures * 20;     // failures are serious
  riskScore += advisories * 5;       // advisories are mild
  riskScore += mileage > 120000 ? 20 : mileage > 100000 ? 10 : 0;
  riskScore += demand < 40 ? 10 : 0; // low demand increases risk

  riskScore = Math.min(100, riskScore);

  /* -------------------------------------------------------
     PROFIT POTENTIAL
  ------------------------------------------------------- */
  const estimatedSellPrice =
    vehicle.aiPrice?.recommendedSellPrice ??
    vehicle.aiPrice?.max ??
    highest;

  const recommendedBuyPrice = Math.round(estimatedSellPrice * 0.65);

  const profitPotential =
    estimatedSellPrice > recommendedBuyPrice
      ? Math.round(
          Math.min(
            100,
            ((estimatedSellPrice - recommendedBuyPrice) / estimatedSellPrice) * 100
          )
        )
      : 5;

  /* -------------------------------------------------------
     CONFIDENCE
  ------------------------------------------------------- */
  const confidenceBase = vehicle.aiValuation?.confidence ?? 60;

  const confidence = Math.max(
    0,
    Math.min(100, confidenceBase - riskScore * 0.3)
  );

  /* -------------------------------------------------------
     VERDICT
  ------------------------------------------------------- */
  let verdict: "BUY" | "MAYBE" | "WALK AWAY" = "MAYBE";

  if (riskScore < 30 && profitPotential > 40 && confidence > 50) {
    verdict = "BUY";
  }

  if (riskScore > 65 || profitPotential < 20 || confidence < 35) {
    verdict = "WALK AWAY";
  }

  /* -------------------------------------------------------
     NOTES
  ------------------------------------------------------- */
  if (motFailures > 0) notes.push(`${motFailures} MOT failures detected.`);
  if (advisories > 0) notes.push(`${advisories} advisories present.`);
  if (mileage > 120000) notes.push("High mileage risk.");
  if (profitPotential > 50) notes.push("Strong profit margin potential.");
  if (confidence < 40) notes.push("Low AI confidence due to risk factors.");
  if (demand < 40) notes.push("Low market demand for this model.");

  return {
    recommendedBuyPrice,
    riskScore,
    profitPotential,
    // Rounded only here for display — the verdict/notes logic above
    // uses the raw value so this doesn't shift any boundary decisions.
    // Confirmed live: this was rendering as "82.5%"/"93.5%" for real
    // vehicles whenever confidenceBase - riskScore*0.3 landed on a
    // fraction, same unrounded-float class as profitPotential/
    // finalScore fixed earlier.
    confidence: Math.round(confidence),
    verdict,
    notes,
  };
}
