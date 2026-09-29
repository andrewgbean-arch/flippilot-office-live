// The dashboard's "Profit This Month". A sale whose profit can't be worked out
// (no purchase record, for example a car imported from a CSV) is left out of
// the total rather than counted as £0, and is counted in `missing` so the card
// can say the total is partial instead of quietly showing a smaller figure.

/** "2026-09" for the month as the dealer sees it, not in UTC. */
export function localMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthProfit(
  sales: { vehicleId: string; date?: string }[],
  profitOf: (vehicleId: string) => { profit: number } | null,
  monthKey: string
): { total: number; counted: number; missing: number } {
  let total = 0;
  let counted = 0;
  let missing = 0;
  for (const s of sales) {
    if (!s.date?.startsWith(monthKey)) continue;
    const p = profitOf(s.vehicleId);
    if (p === null) {
      missing += 1;
      continue;
    }
    total += p.profit;
    counted += 1;
  }
  return { total, counted, missing };
}

/** The line under the figure when some sales this month have no profit yet. */
export function missingProfitNote(missing: number): string | null {
  if (missing <= 0) return null;
  return `Leaves out ${missing} sale${missing === 1 ? "" : "s"} with no purchase price`;
}
