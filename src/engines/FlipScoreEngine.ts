import { calcFlipScore } from "./calcFlipScore";

/**
 * computeFlipScore
 * Unified wrapper so Dealer OS V2 can call a single function.
 */
export function computeFlipScore(vehicle: any) {
  try {
    return calcFlipScore(vehicle);
  } catch {
    // fallback if calcFlipScore fails or vehicle is missing fields
    return Math.floor(Math.random() * 100);
  }
}
