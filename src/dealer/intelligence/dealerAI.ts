// src/dealer/intelligence/dealerAI.ts

import type { Vehicle } from "../../types/Vehicle";

/**
 * What this file used to do: stamp ten "AI" fields on every car and save them
 * with it (marketHeat and riskScore as 0, then supernovaScore, flipDifficulty,
 * valuationConfidence, photoQuality, auctionDelta, buyerPersona,
 * sellerPsychology and a predictedRepairs table worked out from them).
 *
 * All of it was built from a market heat and a risk score that were 0 on every
 * real car, plus age, mileage and the dealer's own prices. So flip difficulty
 * read "High" for almost any used car, "valuation confidence" FELL as the
 * dealer's margin rose, the auction delta was 12 for every car, photo quality
 * ignored the real photos, and any car over 90,000 miles was "predicted" to need
 * a £700 clutch. None of it came from the market or from anything the dealer
 * knew, so it is no longer computed, and the values older versions saved with
 * the cars are cleared when a car is read (see RETIRED_FIELDS).
 *
 * What stays is the half that keeps the app from breaking: a car read back from
 * the server can lack pieces the screens take for granted, and one odd record
 * must not hide the rest of the stock.
 */

// The fields older versions computed and saved with every car. They mean
// nothing, so a car read from the server has them removed, and the next save
// takes them out of the server's copy too. (They are still declared, as
// deprecated, on the Vehicle type so code that has not been cleaned up yet
// keeps compiling.)
const RETIRED_FIELDS = [
  "marketHeat",
  "riskScore",
  "supernovaScore",
  "flipDifficulty",
  "valuationConfidence",
  "photoQuality",
  "auctionDelta",
  "buyerPersona",
  "sellerPsychology",
  "predictedRepairs",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A car read back from the server can lack pieces the screens take for granted:
 * the server stores whatever car it is sent, and another client (or an older
 * version) may not have sent them. A car with no `mot` object made the old
 * enrichment throw, and one throw made the whole stock fail to load. This fills
 * in the nested objects that are missing and touches nothing the car does have,
 * so a well-formed car comes back equal to how it went in.
 */
export function withSafeDefaults(car: Vehicle): Vehicle {
  const mot: Record<string, unknown> = isPlainObject(car.mot) ? car.mot : {};
  const finance: Record<string, unknown> = isPlainObject(car.finance) ? car.finance : {};
  return {
    ...car,
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

/** The same car without the fields older versions stamped on it (see RETIRED_FIELDS). */
export function withoutRetiredFields(car: Vehicle): Vehicle {
  const rest: Record<string, unknown> = { ...car };
  for (const key of RETIRED_FIELDS) delete rest[key];
  return rest as unknown as Vehicle;
}

/**
 * Makes a car safe to show and to save: missing pieces filled in, retired fields
 * cleared. It adds no scores of any kind. (The name is from when it did; it is
 * kept so the callers in InventoryProvider do not have to change.)
 */
export function enrichVehicleWithAI(car: Vehicle): Vehicle {
  return withoutRetiredFields(withSafeDefaults(car));
}

/**
 * Readies ONE car read from the server for display: fills in what it lacks and
 * clears the retired fields. If that fails for any reason the car is kept
 * exactly as it came, rather than costing the dealer their whole stock over one
 * odd record.
 */
export function prepareVehicle(car: Vehicle): Vehicle {
  try {
    return enrichVehicleWithAI(car);
  } catch (err) {
    console.error(`Could not get vehicle ${String(car?.id)} ready to show; keeping it as it was saved.`, err);
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
