// The words and numbers the Car Passport page shows, decided here (not inside
// the view) so they can be tested. Nothing in this file makes anything up: each
// helper turns real data into a sentence, or returns nothing.

import { getUlezStatus } from "@/features/vehicles/utils/ulezUtils";
import { formatMoney } from "@/lib/formatMoney";
import type { PassportMarket, PassportMot, PassportMotTest } from "./passportTypes";

export type Tone = "good" | "warn" | "bad" | "plain";

// The GOV.UK service anyone can use to check a car's MOT history themselves.
export const GOV_MOT_CHECKER_URL = "https://www.check-mot.service.gov.uk/";

// "1 Sep 2030", from a YYYY-MM-DD day, without the time zone moving it.
export function formatDay(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+|-)/)
    .map(part => (/^[a-z]/.test(part) ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join("");
}

export function carTitle(car: { year?: number | undefined; make: string; model: string }): string {
  return [car.year, car.make, car.model].filter(Boolean).join(" ");
}

export function priceText(askingPrice: number | null): string {
  return askingPrice !== null && askingPrice > 0 ? formatMoney(askingPrice) : "Price on request";
}

export function mileageText(mileage: number | undefined): string | null {
  return mileage === undefined ? null : `${mileage.toLocaleString("en-GB")} miles`;
}

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function bookingHref(dealershipId: string, carId: string): string {
  return `/book/${encodeURIComponent(dealershipId)}?vehicle=${encodeURIComponent(carId)}`;
}

// ---- MOT ----

export function motHeadline(mot: PassportMot): { text: string; tone: Tone } | null {
  if (!mot.expiry) return null;
  const day = formatDay(mot.expiry);
  if (!day) return null;
  if (mot.state === "expired") return { text: `MOT expired ${day}`, tone: "bad" };
  if (mot.state !== "valid") return null;
  const left = mot.daysLeft;
  if (left === undefined) return { text: `MOT until ${day}`, tone: "good" };
  if (left === 0) return { text: `MOT expires today (${day})`, tone: "warn" };
  if (left <= 30) return { text: `MOT until ${day} (${left} ${left === 1 ? "day" : "days"} left)`, tone: "warn" };
  return { text: `MOT until ${day}`, tone: "good" };
}

export const RESULT_LABEL: Record<PassportMotTest["result"], string> = {
  pass: "Pass",
  fail: "Fail",
  unknown: "Result not recorded",
};

export const RESULT_TONE: Record<PassportMotTest["result"], Tone> = { pass: "good", fail: "bad", unknown: "plain" };

export function testLabel(test: PassportMotTest): string {
  return test.date ? formatDay(test.date) : test.year !== undefined ? String(test.year) : "Date not recorded";
}

export interface MileagePoint {
  label: string;
  mileage: number;
}

// Mileage at each MOT that recorded one, oldest first.
export function mileageSeries(mot: PassportMot): MileagePoint[] {
  return [...mot.tests]
    .filter(t => t.mileage !== undefined && (t.date !== undefined || t.year !== undefined))
    .sort((a, b) => (a.date ?? `${a.year}`).localeCompare(b.date ?? `${b.year}`))
    .map(t => ({ label: testLabel(t), mileage: t.mileage! }));
}

// Where to draw each point of the mileage chart, inside a width x height box
// with padding. Even spacing left to right (tests are about a year apart), and
// the vertical scale starts at the lowest reading so the shape is visible.
export function chartPoints(series: MileagePoint[], width: number, height: number, pad: number): { x: number; y: number }[] {
  if (series.length < 2) return [];
  const values = series.map(p => p.mileage);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  return series.map((p, i) => ({
    x: pad + (i * (width - 2 * pad)) / (series.length - 1),
    y: height - pad - ((p.mileage - lo) / span) * (height - 2 * pad),
  }));
}

// ---- emissions ----

export function ulezChip(emissions: { fuelType: string; euroStatus?: string } | undefined): { text: string; tone: Tone; detail: string } | null {
  if (!emissions) return null;
  const result = getUlezStatus(emissions.fuelType, emissions.euroStatus);
  const detail = [titleCase(emissions.fuelType), emissions.euroStatus].filter(Boolean).join(", ");
  if (result.status === "compliant") return { text: "ULEZ compliant", tone: "good", detail };
  if (result.status === "non-compliant") return { text: "Not ULEZ compliant", tone: "warn", detail };
  return null;
}

// ---- the market comparison ----

export interface MarketSummary {
  headline: string;
  detail: string;
  tone: Tone;
  // Where the average and this car's price fall between the lowest and highest
  // asking price seen, as 0-100, when that range is known.
  bar?: { avgPct: number; askingPct: number; lowest: number; highest: number; outside: boolean };
}

export function marketSummary(market: PassportMarket, make: string, model: string, asking: number | null): MarketSummary {
  const diff = market.difference;
  const close = Math.abs(diff) <= Math.max(50, market.averageAsking * 0.02);
  const headline = close
    ? "In line with the average asking price"
    : diff < 0
      ? `${formatMoney(-diff)} below the average asking price`
      : `${formatMoney(diff)} above the average asking price`;

  const detail = `The average of ${market.listings} dealer listings for the ${[make, model].filter(Boolean).join(" ")} on eBay, checked ${formatDay(market.checkedOn)}. These are asking prices, not what cars sold for, and age, mileage and specification vary.`;

  const summary: MarketSummary = { headline, detail, tone: !close && diff < 0 ? "good" : "plain" };

  const { lowest, highest } = market;
  if (lowest !== undefined && highest !== undefined && highest > lowest && asking !== null) {
    const pct = (v: number) => Math.min(100, Math.max(0, ((v - lowest) / (highest - lowest)) * 100));
    summary.bar = {
      avgPct: pct(market.averageAsking),
      askingPct: pct(asking),
      lowest,
      highest,
      outside: asking < lowest || asking > highest,
    };
  }
  return summary;
}
