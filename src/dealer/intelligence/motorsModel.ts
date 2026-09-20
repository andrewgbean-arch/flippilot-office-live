import type { Vehicle } from "@/types/Vehicle";
import { motState, registrationOf, vehicleTitle } from "@/dealer/inventory/vehicleListModel";
import { motCounts, plural, unsoldCars, type MotCounts } from "./stockFacts";

// The sums behind the Motors dashboard, kept free of React so they can be
// tested. Every figure is a count or a sum of things the dealer typed in:
// the FlipScore average, the "Total Valuation" that mixed asking, sale and
// buy prices, and the "2x higher risk" line are gone.

const DAY_MS = 86_400_000;

export interface MotAttentionRow {
  id: string;
  title: string;
  reg: string | null;
  kind: "expired" | "soon";
  // "12 Mar 2027", when the expiry can be read.
  date: string | null;
  // "expired 3 days ago", "expires today", "12 days left".
  timing: string;
  // Whole calendar days from today to the expiry date; negative once it has passed.
  daysFromToday: number;
  asking: number | null;
}

export interface NoMotDateRow {
  id: string;
  title: string;
  reg: string | null;
}

export interface MotorsModel {
  inStock: number;
  // Sum of the asking prices that have been entered, and how many cars that is.
  askingTotal: number;
  askingCounted: number;
  noAsking: number;
  // Average of (asking price - trade price) over cars with BOTH entered; null when none.
  marginAverage: number | null;
  marginCounted: number;
  mot: MotCounts;
  motAttention: MotAttentionRow[];
  noMotDate: NoMotDateRow[];
  makes: { make: string; count: number }[];
}

function positive(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

// Calendar days from today to the given date, both read as UTC dates so a
// date-only expiry never slips a day. null when the date is unreadable.
export function calendarDaysFromToday(date: string, now: Date): number | null {
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const expiryDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((expiryDay - today) / DAY_MS);
}

export function motTiming(kind: "expired" | "soon", daysFromToday: number): string {
  if (kind === "expired") {
    return daysFromToday < 0 ? `expired ${plural(-daysFromToday, "day")} ago` : "expired today";
  }
  return daysFromToday <= 0 ? "expires today" : `${plural(daysFromToday, "day")} left`;
}

export function computeMotorsModel(vehicles: readonly Vehicle[], now: Date): MotorsModel {
  const cars = unsoldCars(vehicles);

  let askingTotal = 0;
  let askingCounted = 0;
  let marginTotal = 0;
  let marginCounted = 0;
  for (const car of cars) {
    if (positive(car.priceRetail)) {
      askingTotal += car.priceRetail;
      askingCounted += 1;
      if (positive(car.priceTrade)) {
        marginTotal += car.priceRetail - car.priceTrade;
        marginCounted += 1;
      }
    }
  }

  const motAttention: MotAttentionRow[] = [];
  const noMotDate: NoMotDateRow[] = [];
  for (const car of cars) {
    const state = motState(car.mot?.expiry, now);
    if (state.kind === "unknown") {
      noMotDate.push({ id: car.id, title: vehicleTitle(car), reg: registrationOf(car) });
      continue;
    }
    if (state.kind !== "expired" && state.kind !== "soon") continue;
    const days = calendarDaysFromToday(car.mot.expiry, now);
    if (days === null) continue; // unreachable: motState already read this date
    motAttention.push({
      id: car.id,
      title: vehicleTitle(car),
      reg: registrationOf(car),
      kind: state.kind,
      date: state.date,
      timing: motTiming(state.kind, days),
      daysFromToday: days,
      asking: positive(car.priceRetail) ? car.priceRetail : null,
    });
  }
  // Soonest first, so the longest-expired car (or the one due next) leads.
  motAttention.sort((a, b) => a.daysFromToday - b.daysFromToday);

  // Makes are grouped ignoring case and stray spaces ("ford" and "Ford " are one make).
  const byMake = new Map<string, { make: string; count: number }>();
  for (const car of cars) {
    const make = String(car.make ?? "").trim();
    if (make === "") continue;
    const key = make.toLowerCase();
    const entry = byMake.get(key);
    if (entry) entry.count += 1;
    else byMake.set(key, { make, count: 1 });
  }
  const makes = [...byMake.values()].sort((a, b) => b.count - a.count || a.make.localeCompare(b.make, "en-GB"));

  return {
    inStock: cars.length,
    askingTotal,
    askingCounted,
    noAsking: cars.length - askingCounted,
    marginAverage: marginCounted === 0 ? null : marginTotal / marginCounted,
    marginCounted,
    mot: motCounts(cars, now),
    motAttention,
    noMotDate,
    makes,
  };
}
