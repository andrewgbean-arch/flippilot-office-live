// Pilot Brain used to see profit only as period totals. This gives it the
// per-car picture — what each recent sale cost to buy and prepare, what it
// sold for, and what was made — as plain-text lines for the business
// snapshot, in the same evidence-only style as the rest of it.
//
// "Profit" here is deliberately the Bookkeeping screen's own definition
// (sale price − purchase price − recorded costs, no VAT adjustment), so
// Pilot Brain never contradicts the figure the dealer can see on screen.
// Where a number needed for that isn't recorded, the car is reported as
// UNKNOWN and left out of every total — never guessed at, never counted as
// zero. Only vehicle details and money go to the model: nothing about the
// buyer.

import { oneLine } from "./promptText";

export interface MarginVehicle {
  id?: unknown;
  make?: unknown;
  model?: unknown;
  year?: unknown;
}

// Deliberately loose: a stored document can be missing a list, or hold a
// value that isn't a number, and neither should be able to break a chat.
export interface MarginBookkeeping {
  purchases?: unknown;
  sales?: unknown;
  costs?: unknown;
}

const DAY_MS = 86400000;
export const MARGIN_WINDOW_DAYS = 90;
const SMALL_SAMPLE = 5;
const PER_CAR_LINES_EACH_END = 3;
const MAX_CAR_LABEL = 50;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    : [];
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatMoney(n: number): string {
  const whole = Math.round(n);
  if (whole === 0) return "£0";
  return `${whole < 0 ? "-" : ""}£${Math.abs(whole).toLocaleString("en-GB")}`;
}

// The first entry for each car — what the Bookkeeping screen's own profit
// calculation picks too.
function firstByVehicle(entries: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const e of entries) {
    if (typeof e.vehicleId === "string" && !out.has(e.vehicleId)) out.set(e.vehicleId, e);
  }
  return out;
}

function carLabel(vehicle: MarginVehicle | undefined): string {
  if (!vehicle) return "A vehicle no longer in inventory";
  const year = typeof vehicle.year === "number" && Number.isFinite(vehicle.year) ? String(vehicle.year) : "";
  const text = oneLine(
    [year, oneLine(vehicle.make, 30), oneLine(vehicle.model, 30)].filter(Boolean).join(" "),
    MAX_CAR_LABEL
  );
  return text || "A vehicle with no details recorded";
}

interface KnownSale {
  label: string;
  purchase: number;
  costs: number;
  costEntries: number;
  sale: number;
  profit: number;
}

function carLine(k: KnownSale): string {
  const costs = k.costEntries > 0 ? ` + ${formatMoney(k.costs)} costs` : " (no costs recorded)";
  const margin = k.sale > 0 ? ` (${((k.profit / k.sale) * 100).toFixed(1)}%)` : "";
  return `- ${k.label}: bought ${formatMoney(k.purchase)}${costs}, sold ${formatMoney(k.sale)}, profit ${formatMoney(k.profit)}${margin}`;
}

export function summariseVehicleMargins(
  bookkeeping: MarginBookkeeping,
  vehicles: MarginVehicle[],
  now: number
): string[] {
  const cutoff = now - MARGIN_WINDOW_DAYS * DAY_MS;
  const purchases = firstByVehicle(list(bookkeeping.purchases));
  const sales = firstByVehicle(list(bookkeeping.sales));
  const costsByCar = new Map<string, Record<string, unknown>[]>();
  for (const c of list(bookkeeping.costs)) {
    if (typeof c.vehicleId !== "string") continue;
    costsByCar.set(c.vehicleId, [...(costsByCar.get(c.vehicleId) ?? []), c]);
  }
  const vehicleById = new Map<string, MarginVehicle>();
  for (const v of list(vehicles)) if (typeof v.id === "string") vehicleById.set(v.id, v);

  const heading = `Vehicle profit (cars sold in the last ${MARGIN_WINDOW_DAYS} days, from the Bookkeeping ledger)`;

  const recentSales = [...sales.entries()].filter(([, sale]) => {
    const t = typeof sale.date === "string" ? new Date(sale.date).getTime() : NaN;
    // A day's grace for a clock that runs a little fast, as with lead dates.
    return !Number.isNaN(t) && t >= cutoff && t <= now + DAY_MS;
  });

  if (recentSales.length === 0) {
    return [`${heading}: no sales recorded in that window.`];
  }

  const known: KnownSale[] = [];
  for (const [vehicleId, sale] of recentSales) {
    const salePrice = num(sale.salePrice);
    const purchasePrice = num(purchases.get(vehicleId)?.purchasePrice);
    if (salePrice === null || purchasePrice === null) continue;

    const costEntries = costsByCar.get(vehicleId) ?? [];
    const amounts = costEntries.map(c => num(c.amount));
    // A cost that isn't a real number means the total can't be trusted.
    if (amounts.some(a => a === null)) continue;
    const costs = amounts.reduce<number>((sum, a) => sum + (a ?? 0), 0);

    known.push({
      label: carLabel(vehicleById.get(vehicleId)),
      purchase: purchasePrice,
      costs,
      costEntries: costEntries.length,
      sale: salePrice,
      profit: salePrice - purchasePrice - costs,
    });
  }

  const unknown = recentSales.length - known.length;
  const unknownNote =
    unknown > 0
      ? ` (${unknown} ${plural(unknown, "has", "have")} no usable purchase, sale or cost figure recorded, so ${plural(unknown, "its", "their")} profit is UNKNOWN and left out of everything below)`
      : "";
  const lines = [
    `${heading}: ${recentSales.length} sold, profit known for ${known.length}${unknownNote}.`,
  ];

  if (known.length === 0) return lines;

  const totalProfit = known.reduce((sum, k) => sum + k.profit, 0);
  const totalSales = known.reduce((sum, k) => sum + k.sale, 0);
  const atALoss = known.filter(k => k.profit < 0).length;
  const overallMargin = totalSales > 0 ? ` — overall margin ${((totalProfit / totalSales) * 100).toFixed(1)}% of sale price` : "";
  const caution =
    known.length < SMALL_SAMPLE ? ` Only ${known.length} — too few to call a trend.` : "";

  lines.push(
    `Profit = sale price − purchase price − recorded costs, worked out exactly as the Bookkeeping screen does it (VAT is not separated out). Total ${formatMoney(totalProfit)} on ${formatMoney(totalSales)} of sales${overallMargin}, average ${formatMoney(totalProfit / known.length)} per car. ${atALoss > 0 ? `${atALoss} sold at a loss.` : "None sold at a loss."}${caution}`
  );

  const noCosts = known.filter(k => k.costEntries === 0).length;
  if (noCosts > 0) {
    lines.push(
      `${noCosts} of those ${known.length} ${plural(noCosts, "has", "have")} no costs recorded at all, so the profit shown for ${plural(noCosts, "it", "them")} may be overstated if prep or repair costs were never logged.`
    );
  }

  const ranked = [...known].sort((a, b) => b.profit - a.profit || a.label.localeCompare(b.label));
  if (ranked.length <= PER_CAR_LINES_EACH_END * 2) {
    lines.push("Per car, most to least profitable:", ...ranked.map(carLine));
  } else {
    lines.push(
      "Most profitable:",
      ...ranked.slice(0, PER_CAR_LINES_EACH_END).map(carLine),
      "Least profitable:",
      ...ranked.slice(-PER_CAR_LINES_EACH_END).map(carLine)
    );
  }

  return lines;
}
