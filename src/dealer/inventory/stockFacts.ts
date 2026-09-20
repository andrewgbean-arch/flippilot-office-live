import type { Vehicle } from "@/types/Vehicle";

import { daysInStock, isSold, motState } from "./vehicleListModel";

// Plain facts about the cars a dealer has on the forecourt, counted from their
// own records and nothing else. These replace the "AI" scores that used to sit
// on the analytics screens and the inventory dashboard (valuation confidence,
// predicted repairs, a demand level): those were worked out from inputs the app
// never had, so every dealer saw the same made-up numbers. Everything here is a
// count, an average or a date difference a dealer could check by hand, and
// "unknown" is left out of an average rather than counted as zero.
//
// Kept free of React so it can be tested on its own.

// A car counts as "on hand" until it is sold; sold cars are history, not stock.
export function unsold(vehicles: readonly Vehicle[]): Vehicle[] {
  return vehicles.filter(v => !isSold(v));
}

// 0 and missing both mean "no asking price set" (that is how a car added
// without a price is stored).
export function hasAskingPrice(v: Pick<Vehicle, "priceRetail">): boolean {
  return typeof v.priceRetail === "number" && Number.isFinite(v.priceRetail) && v.priceRetail > 0;
}

// Has anything been recorded about this car's MOT? A car nobody has run a
// lookup on has an empty expiry and no test history; showing "0 advisories,
// 0 failures" for it would read as a clean MOT rather than as no information.
export function hasMotRecord(v: Pick<Vehicle, "mot">): boolean {
  const mot = v.mot;
  if (!mot) return false;
  return Boolean(mot.expiry) || (Array.isArray(mot.history) && mot.history.length > 0);
}

export interface PriceSummary {
  count: number;
  average: number;
  lowest: number;
  highest: number;
}

// The asking prices of unsold cars that have one. Unpriced cars are left out
// rather than dragging the average down as £0.
export function askingPriceSummary(vehicles: readonly Vehicle[]): PriceSummary | null {
  const prices = unsold(vehicles)
    .filter(hasAskingPrice)
    .map(v => v.priceRetail as number);
  if (prices.length === 0) return null;
  const total = prices.reduce((sum, p) => sum + p, 0);
  return {
    count: prices.length,
    average: Math.round(total / prices.length),
    lowest: Math.min(...prices),
    highest: Math.max(...prices),
  };
}

export interface CountedAverage {
  count: number; // how many cars the average is over
  average: number;
}

// Cars added without a mileage store null (and a blank form field can store 0),
// so only a positive mileage counts as recorded.
export function averageMileage(vehicles: readonly Vehicle[]): CountedAverage | null {
  const miles = unsold(vehicles)
    .map(v => v.mileage)
    .filter((m): m is number => typeof m === "number" && Number.isFinite(m) && m > 0);
  if (miles.length === 0) return null;
  return { count: miles.length, average: Math.round(miles.reduce((sum, m) => sum + m, 0) / miles.length) };
}

// Days since each unsold car was added, averaged over the cars that have a date
// (older records have none). It runs from when the car was added to FlipPilot,
// so stock imported in bulk starts counting on the day it was imported.
export function averageDaysInStock(vehicles: readonly Vehicle[], now: Date): CountedAverage | null {
  const days = unsold(vehicles)
    .map(v => daysInStock(v.createdAt, now))
    .filter((d): d is number => d !== null);
  if (days.length === 0) return null;
  return { count: days.length, average: Math.round(days.reduce((sum, d) => sum + d, 0) / days.length) };
}

export interface MotCounts {
  expired: number;
  dueSoon: number; // 30 days or fewer left
  valid: number;
  noDate: number;
}

// Where the MOT of every unsold car stands. "Expired" and "due within 30 days"
// are kept apart: an expired MOT is a different job from one that is coming up.
export function motCounts(vehicles: readonly Vehicle[], now: Date): MotCounts {
  const counts: MotCounts = { expired: 0, dueSoon: 0, valid: 0, noDate: 0 };
  for (const v of unsold(vehicles)) {
    const state = motState(v.mot?.expiry, now);
    if (state.kind === "expired") counts.expired += 1;
    else if (state.kind === "soon") counts.dueSoon += 1;
    else if (state.kind === "valid") counts.valid += 1;
    else counts.noDate += 1;
  }
  return counts;
}

export interface AgeBands {
  under30: number;
  from30to59: number;
  from60to89: number;
  from90: number;
  unknown: number; // no date added on the record
}

// How long the unsold cars have been here. The 60 and 90 day marks are the
// ones the vehicle list uses for "ageing" and "old" stock.
export function stockAgeBands(vehicles: readonly Vehicle[], now: Date): AgeBands {
  const bands: AgeBands = { under30: 0, from30to59: 0, from60to89: 0, from90: 0, unknown: 0 };
  for (const v of unsold(vehicles)) {
    const days = daysInStock(v.createdAt, now);
    if (days === null) bands.unknown += 1;
    else if (days < 30) bands.under30 += 1;
    else if (days < 60) bands.from30to59 += 1;
    else if (days < 90) bands.from60to89 += 1;
    else bands.from90 += 1;
  }
  return bands;
}

// Unsold cars with at least one advisory on their latest MOT.
export function withMotAdvisories(vehicles: readonly Vehicle[]): Vehicle[] {
  return unsold(vehicles).filter(v => Array.isArray(v.mot?.advisories) && v.mot.advisories.length > 0);
}

// Unsold cars that have no asking price yet.
export function withoutAskingPrice(vehicles: readonly Vehicle[]): Vehicle[] {
  return unsold(vehicles).filter(v => !hasAskingPrice(v));
}

// Unsold cars that have been in stock for `days` days or more.
export function inStockAtLeast(vehicles: readonly Vehicle[], days: number, now: Date): Vehicle[] {
  return unsold(vehicles).filter(v => {
    const age = daysInStock(v.createdAt, now);
    return age !== null && age >= days;
  });
}

// Unsold cars with no photo.
export function withoutPhotos(vehicles: readonly Vehicle[]): Vehicle[] {
  return unsold(vehicles).filter(v => (v.images?.length ?? 0) === 0);
}
