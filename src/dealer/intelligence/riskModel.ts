import type { Vehicle } from "@/types/Vehicle";
import { ageBand, daysInStock, motState, registrationOf, vehicleTitle } from "@/dealer/inventory/vehicleListModel";
import { calendarDaysFromToday, motTiming } from "./motorsModel";
import { advisoryCount, motCounts, plural, unsoldCars, type MotCounts } from "./stockFacts";

// The counts behind the Risk Hub. This screen used to show "Overall Risk %",
// "MOT Risk %", "Market Volatility %" and "Stock Stability %". Market
// Volatility was 50% for every dealer (it read a demand figure no car
// carries), Stock Stability was just 100 minus Overall Risk, and the other two
// turned mileage and advisory counts into a percentage with weights nobody
// chose. Each number here is a number of cars.

// The MOT advisory count at which the Risk Hub starts flagging a car.
export const MANY_ADVISORIES = 3;

export interface RiskCarRow {
  id: string;
  title: string;
  reg: string | null;
  // Plain reasons this car is listed, e.g. "MOT expired 3 days ago".
  flags: string[];
}

export interface RiskModel {
  inStock: number;
  mot: MotCounts;
  // Cars with MANY_ADVISORIES or more on the current MOT.
  manyAdvisories: number;
  // Cars in stock 90 days or more (the same "old" mark the vehicle list uses).
  ageing: number;
  // Cars with no usable date added, so their age is unknown and they are not in `ageing`.
  ageUnknown: number;
  // Cars with at least one flag, most urgent first.
  rows: RiskCarRow[];
}

// Lower is more urgent.
const URGENCY = { expired: 0, soon: 1, noDate: 2, advisories: 3, ageing: 4 } as const;

export function computeRiskModel(vehicles: readonly Vehicle[], now: Date): RiskModel {
  const cars = unsoldCars(vehicles);

  let manyAdvisories = 0;
  let ageing = 0;
  let ageUnknown = 0;
  const ranked: { row: RiskCarRow; urgency: number }[] = [];

  for (const car of cars) {
    const flags: string[] = [];
    let urgency: number = Number.POSITIVE_INFINITY;
    const flag = (text: string, rank: number) => {
      flags.push(text);
      urgency = Math.min(urgency, rank);
    };

    const mot = motState(car.mot?.expiry, now);
    if (mot.kind === "expired" || mot.kind === "soon") {
      const days = calendarDaysFromToday(car.mot.expiry, now);
      const timing = days === null ? mot.label : motTiming(mot.kind, days);
      flag(`MOT ${timing}`, URGENCY[mot.kind]);
    } else if (mot.kind === "unknown") {
      flag("No MOT date recorded", URGENCY.noDate);
    }

    const advisories = advisoryCount(car);
    if (advisories >= MANY_ADVISORIES) {
      manyAdvisories += 1;
      flag(`${plural(advisories, "advisory", "advisories")} on the MOT`, URGENCY.advisories);
    }

    const days = daysInStock(car.createdAt, now);
    if (days === null) ageUnknown += 1;
    else if (ageBand(days) === "old") {
      ageing += 1;
      flag(`${plural(days, "day")} in stock`, URGENCY.ageing);
    }

    if (flags.length > 0) {
      ranked.push({ row: { id: car.id, title: vehicleTitle(car), reg: registrationOf(car), flags }, urgency });
    }
  }

  ranked.sort(
    (a, b) =>
      a.urgency - b.urgency ||
      b.row.flags.length - a.row.flags.length ||
      a.row.title.localeCompare(b.row.title, "en-GB")
  );

  return {
    inStock: cars.length,
    mot: motCounts(cars, now),
    manyAdvisories,
    ageing,
    ageUnknown,
    rows: ranked.map(r => r.row),
  };
}
