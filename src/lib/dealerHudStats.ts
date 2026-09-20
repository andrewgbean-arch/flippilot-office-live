import type { Vehicle } from "@/types/Vehicle";
import { averageDaysInStock, motCounts, unsoldCars } from "@/dealer/intelligence/stockFacts";

// What the snapshot bar under the header shows: plain facts about the cars
// still to be sold, counted from the dealer's own records.
//
// This used to show "Market: rising (est.)", an average "FlipScore N/100", a
// risk level and an "Insights: up to date" light. The market trend came from
// each car's own buy and asking price (and could never say "rising"), the
// FlipScore was capped at 50 because most of its inputs are never supplied,
// and the sync light meant nothing to a dealer, so all of it was removed
// rather than replaced with another estimate.
export type DealerHudStats = {
  inStock: number;
  // Whole days, or null when no car has a date added to average.
  avgDaysInStock: number | null;
  // How many of the cars in stock the average is over.
  daysCounted: number;
  motExpired: number;
  // 30 days or fewer left.
  motDueSoon: number;
  // No expiry date recorded, so the MOT position is unknown.
  motNoDate: number;
};

export function computeDealerHudStats(vehicles: readonly Vehicle[], now: Date): DealerHudStats {
  const cars = unsoldCars(vehicles);
  const mot = motCounts(cars, now);
  const days = averageDaysInStock(cars, now);
  return {
    inStock: cars.length,
    avgDaysInStock: days.average,
    daysCounted: days.counted,
    motExpired: mot.expired,
    motDueSoon: mot.dueSoon,
    motNoDate: mot.noDate,
  };
}

// --- What the bar says ------------------------------------------------------
// Kept here, away from the component, so the wording can be tested without a DOM.

export type HudTone = "neutral" | "good" | "warn" | "bad";

export interface HudPill {
  key: string;
  to: string;
  tone: HudTone;
  text: string;
  title: string;
}

export function hudPills(stats: DealerHudStats): HudPill[] {
  const pills: HudPill[] = [
    {
      key: "stock",
      to: "/dealer/inventory/list",
      tone: "neutral",
      text: `In stock: ${stats.inStock}`,
      title: "Cars that have not been sold yet.",
    },
  ];

  if (stats.avgDaysInStock !== null) {
    const left = stats.inStock - stats.daysCounted;
    pills.push({
      key: "days",
      to: "/dealer/inventory/list",
      tone: "neutral",
      text: `Average ${stats.avgDaysInStock} ${stats.avgDaysInStock === 1 ? "day" : "days"} in stock`,
      title:
        left > 0
          ? `Average over the ${stats.daysCounted} cars that have a date added. The other ${left} were added before that was recorded, so they are left out.`
          : "Average number of days your unsold cars have been in stock, from the date each was added.",
    });
  }

  // Every state is a count of cars, and a car with no expiry date is its own
  // line: an unknown MOT is not a good one.
  if (stats.motExpired > 0) {
    pills.push({
      key: "expired",
      to: "/dealer/workflow/mot",
      tone: "bad",
      text: `MOT expired: ${stats.motExpired}`,
      title: "Unsold cars whose MOT has run out.",
    });
  }
  if (stats.motDueSoon > 0) {
    pills.push({
      key: "soon",
      to: "/dealer/workflow/mot",
      tone: "warn",
      text: `MOT due within 30 days: ${stats.motDueSoon}`,
      title: "Unsold cars with 30 days or fewer left on the MOT.",
    });
  }
  if (stats.motNoDate > 0) {
    pills.push({
      key: "nodate",
      to: "/dealer/workflow/mot",
      tone: "warn",
      text: `No MOT date: ${stats.motNoDate}`,
      title: "Unsold cars with no MOT expiry date recorded, so their MOT position is unknown.",
    });
  }
  if (stats.motExpired === 0 && stats.motDueSoon === 0 && stats.motNoDate === 0) {
    pills.push({
      key: "motok",
      to: "/dealer/workflow/mot",
      tone: "good",
      text: "MOT: all in date",
      title: "Every unsold car has an MOT with more than 30 days left.",
    });
  }
  return pills;
}

// The one line a phone shows before the bar is opened: everything the pills
// say, shortened.
export function hudSummaryLine(stats: DealerHudStats): string {
  const parts = [`${stats.inStock} in stock`];
  if (stats.avgDaysInStock !== null) parts.push(`${stats.avgDaysInStock} ${stats.avgDaysInStock === 1 ? "day" : "days"} average`);

  const mot: string[] = [];
  if (stats.motExpired > 0) mot.push(`${stats.motExpired} expired`);
  if (stats.motDueSoon > 0) mot.push(`${stats.motDueSoon} due within 30 days`);
  if (stats.motNoDate > 0) mot.push(`${stats.motNoDate} with no date`);
  parts.push(mot.length === 0 ? "MOT: all in date" : `MOT: ${mot.join(", ")}`);

  return parts.join(" · ");
}
