// Pilot Brain saw profit but not where the money goes. This totals the costs
// recorded against vehicles (parts, labour, MOT, tyres, detailing and so on)
// by type over the last 90 days, from the Bookkeeping ledger, for the
// business snapshot.
//
// Deliberately ONLY the vehicle costs. The ledger's general income/expense
// transactions are left out: their categories are free text, and one of them
// can easily be "Wages", which Pilot Brain must never be given (anyone on the
// team can talk to it). Vehicle costs are what the per-car profit figures
// already use, so this shows nothing new about people. Amounts are as
// recorded, VAT not separated out, like the rest of the profit figures.

import { oneLine } from "./promptText";
import { formatMoney } from "./vehicleMargins";

export interface CostBookkeeping {
  costs?: unknown;
}

const DAY_MS = 86400000;
export const COST_WINDOW_DAYS = 90;
const MAX_TYPES_SHOWN = 8;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

interface Group {
  total: number;
  entries: number;
}

export function summariseCostBreakdown(bookkeeping: CostBookkeeping, now: number): string[] {
  const cutoff = now - COST_WINDOW_DAYS * DAY_MS;
  const all = Array.isArray(bookkeeping.costs)
    ? bookkeeping.costs.filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    : [];

  const groups = new Map<string, Group>();
  let entries = 0;
  let uncategorised = 0;
  let unusable = 0;

  for (const cost of all) {
    const t = typeof cost.date === "string" ? new Date(cost.date).getTime() : NaN;
    if (Number.isNaN(t) || t < cutoff || t > now + DAY_MS) continue;
    if (typeof cost.amount !== "number" || !Number.isFinite(cost.amount)) {
      unusable += 1;
      continue;
    }
    const type = oneLine(cost.type, 20).toLowerCase() || "(no type)";
    const group = groups.get(type) ?? { total: 0, entries: 0 };
    group.total += cost.amount;
    group.entries += 1;
    groups.set(type, group);
    entries += 1;
    if (!oneLine(cost.category, 30)) uncategorised += 1;
  }

  const heading = `Vehicle costs (recorded in the last ${COST_WINDOW_DAYS} days, from the Bookkeeping ledger)`;
  if (entries === 0) return [`${heading}: none recorded.`];

  const ranked = [...groups.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
  const grand = ranked.reduce((sum, [, g]) => sum + g.total, 0);
  const percent = (n: number) => (grand > 0 ? `, ${Math.round((n / grand) * 100)}%` : "");

  const lines = [
    `${heading}: ${formatMoney(grand)} across ${entries} ${plural(entries, "entry", "entries")} (VAT not separated out).`,
    ...ranked
      .slice(0, MAX_TYPES_SHOWN)
      .map(([type, g]) => `- ${type}: ${formatMoney(g.total)} (${g.entries} ${plural(g.entries, "entry", "entries")}${percent(g.total)})`),
  ];

  const rest = ranked.slice(MAX_TYPES_SHOWN);
  if (rest.length > 0) {
    const restTotal = rest.reduce((sum, [, g]) => sum + g.total, 0);
    lines.push(`- ${rest.length} other ${plural(rest.length, "type", "types")}: ${formatMoney(restTotal)}`);
  }
  if (uncategorised > 0) {
    lines.push(
      `${uncategorised} of those ${entries} cost ${plural(entries, "entry", "entries")} ${plural(uncategorised, "has", "have")} no category set (the Operations screen can suggest one for each).`
    );
  }
  if (unusable > 0) {
    lines.push(
      `${unusable} cost ${plural(unusable, "entry has", "entries have")} no usable amount and ${plural(unusable, "is", "are")} left out of these totals.`
    );
  }
  return lines;
}
