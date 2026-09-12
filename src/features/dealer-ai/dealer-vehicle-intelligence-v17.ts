import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export function getVehicleIntelligenceV17(
  vehicle: FlipRecord,
  buyer: any,
  lead: any,
  ai: any
) {
  // Normalised safe values
  const price = vehicle.price ?? 0;
  const mileage = vehicle.mileage ?? 0;
  const year = (vehicle as any).year ?? 0;

  const age = year ? new Date().getFullYear() - year : 0;

  // MATCH SCORE
  const matchScore = ai.matchEngine(vehicle, buyer, lead);

  // PRICE SUGGESTION
  const aiPriceSuggestion = ai.priceEngine(vehicle);

  // RISK
  const motRiskPercent =
    (vehicle.mot?.failures?.length ?? 0) * 20 +
    ((vehicle.flipScore ?? 50) < 40 ? 20 : 0);

  // PROFIT FORECAST (fallback)
  const profitForecast = price - (vehicle.price ?? 0);

  // FLIP ADVICE
  const flipAdvice =
    profitForecast < 500
      ? "Low margin — consider wholesale."
      : motRiskPercent > 40
      ? "High MOT risk — price aggressively."
      : "Strong retail candidate.";

  // AUTO LISTING
  const autoListing = ai.listingEngine(vehicle);

  return {
    matchScore,
    matchBand:
      matchScore > 80
        ? "Excellent"
        : matchScore > 60
        ? "Strong"
        : matchScore > 40
        ? "Moderate"
        : "Weak",

    aiPriceSuggestion,
    motRiskPercent,
    profitForecast,
    flipAdvice,
    autoListing,
  };
}
