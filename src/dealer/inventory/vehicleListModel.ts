import type { Vehicle } from "@/types/Vehicle";

// The rules behind the Vehicle List, kept free of React so they can be tested
// on their own: what a car's MOT looks like today, how long it has been in
// stock, how prices and dates are written, and how the list is searched,
// filtered and sorted.

const DAY_MS = 86_400_000;

// A car counts as "in stock" whenever it isn't sold: new arrivals, cars on
// the forecourt and reserved ones all still need selling.
export type StatusFilter = "in-stock" | "sold" | "all";
export type SortKey = "newest" | "longest" | "price-high" | "price-low" | "name";

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  longest: "Longest in stock",
  "price-high": "Price: high to low",
  "price-low": "Price: low to high",
  name: "Make and model, A to Z",
};

export function isSold(v: Pick<Vehicle, "status">): boolean {
  return String(v.status ?? "").trim().toLowerCase() === "sold";
}

export function prettyStatus(status: string | null | undefined): string {
  const s = String(status ?? "").trim().replace(/[_-]+/g, " ");
  if (s === "") return "No status";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function vehicleTitle(v: Pick<Vehicle, "make" | "model">): string {
  const title = [v.make, v.model]
    .map(part => String(part ?? "").trim())
    .filter(part => part !== "")
    .join(" ");
  return title === "" ? "Unnamed vehicle" : title;
}

// The registration as a dealer would write it, or null when none is recorded.
export function registrationOf(v: Pick<Vehicle, "reg" | "mot">): string | null {
  const raw = v.reg ?? v.mot?.reg ?? "";
  const reg = String(raw).trim().toUpperCase();
  return reg === "" ? null : reg;
}

// --- Dates ------------------------------------------------------------------

// "12 Mar 2027". UTC so a date-only value like 2027-03-12 never slips to the
// day before in some other time zone. Returns null for anything unreadable.
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Whole days since the car was added, or null when there is no usable date
// (older records have none). Never negative.
export function daysInStock(createdAt: string | null | undefined, now: Date): number | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export type AgeBand = "fresh" | "ageing" | "old";

// The same 60 and 90 day marks the dashboard and Pilot Brain use for ageing stock.
export function ageBand(days: number | null): AgeBand {
  if (days === null || days < 60) return "fresh";
  return days < 90 ? "ageing" : "old";
}

export interface MotState {
  kind: "expired" | "soon" | "valid" | "unknown";
  label: string; // "MOT expired", "MOT due soon", "MOT valid", "No MOT date"
  date: string | null; // the expiry as "12 Mar 2027", when known
}

// Where a car's MOT stands today. A date-only expiry (2027-03-12) is valid
// THROUGH that day, so it only counts as expired once the day has ended.
// "Due soon" means 30 days or fewer left, the same window the app's MOT
// warnings use.
export function motState(expiry: string | null | undefined, now: Date): MotState {
  const unknown: MotState = { kind: "unknown", label: "No MOT date", date: null };
  if (!expiry) return unknown;
  const start = new Date(expiry).getTime();
  if (Number.isNaN(start)) return unknown;

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiry.trim());
  const end = dateOnly ? start + DAY_MS : start;
  const date = formatDate(expiry);

  if (end <= now.getTime()) return { kind: "expired", label: "MOT expired", date };
  const daysLeft = Math.ceil((end - now.getTime()) / DAY_MS);
  if (daysLeft <= 30) return { kind: "soon", label: "MOT due soon", date };
  return { kind: "valid", label: "MOT valid", date };
}

// --- Money and distance -----------------------------------------------------

// "£7,995", or null when no price is recorded (0 and missing both mean "not set").
export function formatPrice(amount: number | null | undefined): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  return `£${Math.round(amount).toLocaleString("en-GB")}`;
}

export function formatMileage(miles: number | null | undefined): string | null {
  if (typeof miles !== "number" || !Number.isFinite(miles) || miles < 0) return null;
  return `${Math.round(miles).toLocaleString("en-GB")} miles`;
}

export interface ShownPrice {
  amount: number | null;
  label: "Asking" | "Sold for";
}

// A sold car shows what it sold for (falling back to the asking price if the
// sale price was never recorded); anything else shows the asking price.
export function shownPrice(v: Pick<Vehicle, "status" | "priceRetail" | "sellPrice">): ShownPrice {
  if (isSold(v)) {
    const sold = typeof v.sellPrice === "number" && v.sellPrice > 0 ? v.sellPrice : v.priceRetail;
    return { amount: sold ?? null, label: "Sold for" };
  }
  return { amount: v.priceRetail ?? null, label: "Asking" };
}

// --- Search, filter, sort ---------------------------------------------------

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, "");

// Every word typed must appear somewhere in the car's make, model, year,
// colour, registration or status. Registrations match with or without the
// space, so "ab12cde" finds "AB12 CDE".
export function matchesQuery(v: Vehicle, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t !== "");
  if (terms.length === 0) return true;

  const text = [v.make, v.model, v.year, v.colour, v.status, v.mot?.colour]
    .filter(part => part !== null && part !== undefined)
    .map(part => String(part).toLowerCase())
    .join(" ");
  const reg = squash(registrationOf(v) ?? "");

  return terms.every(term => text.includes(term) || (reg !== "" && reg.includes(squash(term))));
}

export function matchesStatus(v: Vehicle, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  return filter === "sold" ? isSold(v) : !isSold(v);
}

export function statusCounts(vehicles: readonly Vehicle[]): Record<StatusFilter, number> {
  const sold = vehicles.filter(isSold).length;
  return { all: vehicles.length, sold, "in-stock": vehicles.length - sold };
}

export interface ListOptions {
  query: string;
  status: StatusFilter;
  sort: SortKey;
}

function timeOf(v: Vehicle): number | null {
  if (!v.createdAt) return null;
  const t = new Date(v.createdAt).getTime();
  return Number.isNaN(t) ? null : t;
}

function priceOf(v: Vehicle): number | null {
  const amount = shownPrice(v).amount;
  return typeof amount === "number" && amount > 0 ? amount : null;
}

// Missing values (no date, no price) always go to the END, whichever way the
// list is sorted, so they never crowd the top. Ties keep the order the cars
// were stored in.
function compareOptional(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

export function filterAndSort(vehicles: readonly Vehicle[], options: ListOptions): Vehicle[] {
  const indexed = vehicles
    .map((v, index) => ({ v, index }))
    .filter(({ v }) => matchesStatus(v, options.status) && matchesQuery(v, options.query));

  const compare = (a: { v: Vehicle; index: number }, b: { v: Vehicle; index: number }): number => {
    switch (options.sort) {
      case "newest":
        return compareOptional(timeOf(a.v), timeOf(b.v), -1);
      case "longest":
        return compareOptional(timeOf(a.v), timeOf(b.v), 1);
      case "price-high":
        return compareOptional(priceOf(a.v), priceOf(b.v), -1);
      case "price-low":
        return compareOptional(priceOf(a.v), priceOf(b.v), 1);
      case "name":
        return vehicleTitle(a.v).localeCompare(vehicleTitle(b.v), "en-GB", { sensitivity: "base" });
    }
  };

  return indexed.sort((a, b) => compare(a, b) || a.index - b.index).map(({ v }) => v);
}
