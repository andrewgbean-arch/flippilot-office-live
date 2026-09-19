// Pilot Brain used to know how many cars were in stock and their total value,
// but not which cars. This turns the real in-stock vehicles into a compact
// list for the business snapshot: what it is, how far it has done, what it's
// advertised at and how long it has been sitting, oldest first, because the
// cars that have waited longest are the ones worth talking about.
//
// Only what any team member can already see on the stock list: no purchase
// price, no registration, no photos. Text a person typed (make, model,
// condition) is flattened to one short line first.

import { oneLine } from "./promptText";
import { formatMoney } from "./vehicleMargins";

export interface StockVehicle {
  make?: unknown;
  model?: unknown;
  year?: unknown;
  mileage?: unknown;
  priceRetail?: unknown;
  condition?: unknown;
  createdAt?: unknown;
  status?: unknown;
}

const DAY_MS = 86400000;
export const MAX_STOCK_LINES = 30;

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

interface Row {
  label: string;
  days: number | null;
  line: string;
}

export function summariseStock(vehicles: StockVehicle[], now: number): string[] {
  const inStock = vehicles.filter(
    v => typeof v === "object" && v !== null && String(v.status ?? "").toLowerCase() !== "sold"
  );
  if (inStock.length === 0) return [];

  const rows: Row[] = inStock.map(v => {
    const label =
      [isNumber(v.year) ? String(v.year) : "", oneLine(v.make, 30), oneLine(v.model, 30)].filter(Boolean).join(" ") ||
      "Vehicle with no details recorded";

    const added = typeof v.createdAt === "string" ? new Date(v.createdAt).getTime() : NaN;
    const days = Number.isNaN(added) || added > now + DAY_MS ? null : Math.max(0, Math.floor((now - added) / DAY_MS));

    const condition = oneLine(v.condition, 30);
    const parts = [
      isNumber(v.mileage) ? `${Math.round(v.mileage).toLocaleString("en-GB")} miles` : "mileage not recorded",
      isNumber(v.priceRetail) && v.priceRetail > 0 ? `asking ${formatMoney(v.priceRetail)}` : "no asking price set",
      days === null ? "time in stock unknown" : `${days} ${days === 1 ? "day" : "days"} in stock`,
      ...(condition && condition.toLowerCase() !== "unknown" ? [`condition: ${condition}`] : []),
    ];
    return { label, days, line: `- ${label}, ${parts.join(", ")}` };
  });

  // Longest-waiting first; cars with no known age go last (nothing to say
  // about how long they've waited), then by name so the order is stable.
  rows.sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || a.label.localeCompare(b.label));

  const shown = rows.slice(0, MAX_STOCK_LINES);
  const hidden = rows.length - shown.length;
  return [
    `Stock list (${rows.length} in stock, longest-waiting first${hidden > 0 ? `, first ${shown.length} shown` : ""}):`,
    ...shown.map(r => r.line),
    ...(hidden > 0 ? [`- …and ${hidden} more, the most recently added, not listed.`] : []),
  ];
}
