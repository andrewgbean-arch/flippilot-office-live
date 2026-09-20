import { computeRiskScore } from "@/engines/RiskEngine";
import { hasMotRecord } from "@/dealer/inventory/stockFacts";
import type { Vehicle } from "@/types/Vehicle";

// The two rules behind the Profit tab that have to give an honest answer.

// A price of 0 (or none at all) means "not set" on a car, not "it cost nothing".
function isSet(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// What is left of the sale price once the purchase price and every cost logged
// against the car (VAT the dealer cannot reclaim included) are taken off. It is
// BEFORE any VAT due on the sale itself: under the margin scheme that is a
// sixth of (sale price - purchase price), which this does not take off.
//
// When either price isn't set there is nothing honest to work out. This used to
// treat a missing purchase price as £0, so a car with no prices but £300 of
// costs showed a "Real Profit" of minus £300.
export function profitBeforeSaleVat(input: {
  purchasePrice: number | null | undefined;
  expectedSale: number | null | undefined;
  grossCosts: number;
}): number | null {
  const { purchasePrice, expectedSale, grossCosts } = input;
  if (!isSet(purchasePrice) || !isSet(expectedSale)) return null;
  return expectedSale - grossCosts - purchasePrice;
}

export type RiskCheck = "Low" | "Medium" | "High" | "Not enough data";

// A rule of thumb, not a prediction: RiskEngine.computeRiskScore adds points
// for high mileage, MOT advisories, recorded MOT failures and age, and this
// bands the total. Half of those inputs come from the car's MOT record, so a
// car nobody has run an MOT lookup on is "Not enough data" rather than "Low"
// (with nothing recorded, the score is simply 0).
export function riskCheck(vehicle: Vehicle | undefined): RiskCheck {
  if (!vehicle || !hasMotRecord(vehicle)) return "Not enough data";
  const score = computeRiskScore(vehicle);
  if (score >= 70) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}
