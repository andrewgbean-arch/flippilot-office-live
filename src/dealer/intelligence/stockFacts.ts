import type { Vehicle } from "@/types/Vehicle";
import { daysInStock, isSold, motState } from "@/dealer/inventory/vehicleListModel";

// Plain counts and averages from the dealer's own stock, in one place so the
// snapshot bar, the Motors dashboard and the Risk Hub all mean the same thing
// by "in stock", "MOT due" and "days in stock".
//
// These replace the FlipScore, market, risk-percentage and stability figures
// those screens used to show. Every one of those was computed from inputs a
// real car never carries (a market price, a demand figure, a condition
// grade), so they read as measurements when they were defaults. Nothing here
// is a guess: each number is a count of cars, or an average of dates and
// prices the dealer typed in.

// A car is still to be sold unless its status says it has been.
export function unsoldCars(vehicles: readonly Vehicle[]): Vehicle[] {
  return vehicles.filter(v => !isSold(v));
}

export interface MotCounts {
  expired: number;
  // 30 days or fewer left, the same window the rest of the app calls "due soon".
  dueSoon: number;
  // No expiry date recorded (or one that can't be read): unknown, not "fine".
  noDate: number;
  valid: number;
}

export function motCounts(cars: readonly Vehicle[], now: Date): MotCounts {
  const counts: MotCounts = { expired: 0, dueSoon: 0, noDate: 0, valid: 0 };
  for (const car of cars) {
    // The server will store a car with no `mot` object at all, so read it defensively.
    switch (motState(car.mot?.expiry, now).kind) {
      case "expired":
        counts.expired += 1;
        break;
      case "soon":
        counts.dueSoon += 1;
        break;
      case "unknown":
        counts.noDate += 1;
        break;
      case "valid":
        counts.valid += 1;
        break;
    }
  }
  return counts;
}

export interface AverageDays {
  // Whole days, or null when no car has a usable "date added".
  average: number | null;
  // How many cars the average is over. Older records have no date added, so
  // this can be fewer than the cars in stock, and the screen says so.
  counted: number;
}

export function averageDaysInStock(cars: readonly Vehicle[], now: Date): AverageDays {
  let total = 0;
  let counted = 0;
  for (const car of cars) {
    const days = daysInStock(car.createdAt, now);
    if (days === null) continue;
    total += days;
    counted += 1;
  }
  return { average: counted === 0 ? null : Math.round(total / counted), counted };
}

// How many advisories a car's current MOT carries (0 when none or unreadable).
export function advisoryCount(car: Pick<Vehicle, "mot">): number {
  const advisories = car.mot?.advisories;
  return Array.isArray(advisories) ? advisories.length : 0;
}

// "£1,450", "-£300", "£0". Whole pounds: these are counts of the dealer's own
// prices, not measurements that deserve pence.
export function formatMoney(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const sign = amount < 0 && rounded !== 0 ? "-" : "";
  return `${sign}£${rounded.toLocaleString("en-GB")}`;
}

// "1 car", "3 cars", "0 cars".
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
