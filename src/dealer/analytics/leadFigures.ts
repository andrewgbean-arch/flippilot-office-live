import type { Lead } from "@/dealer/leads/leadTypes";

// The lead-conversion figures, kept free of React so they can be tested. All of
// it is counted from the dealer's own leads.

type LeadFacts = Pick<Lead, "source" | "status">;

// A source with fewer leads than this is shown, but marked as too small to
// compare: one win out of one lead is "100%", and it should not read as the
// best source the dealer has.
export const SMALL_SAMPLE = 10;

export interface SourceConversion {
  source: string;
  total: number;
  won: number;
  rate: number; // whole percent of this source's leads that were won
  smallSample: boolean;
}

// Won leads per source. The biggest sources come first (their percentages mean
// the most); this used to sort by percentage alone, which put every source with
// a single lucky lead above the ones that actually feed the business.
export function conversionBySource(leads: readonly LeadFacts[]): SourceConversion[] {
  const bySource = new Map<string, { total: number; won: number }>();
  for (const lead of leads) {
    const key = lead.source || "Unknown";
    const entry = bySource.get(key) ?? { total: 0, won: 0 };
    entry.total += 1;
    if (lead.status === "won") entry.won += 1;
    bySource.set(key, entry);
  }
  return [...bySource.entries()]
    .map(([source, { total, won }]) => ({
      source,
      total,
      won,
      rate: total > 0 ? Math.round((won / total) * 100) : 0,
      smallSample: total < SMALL_SAMPLE,
    }))
    .sort((a, b) => b.total - a.total || b.rate - a.rate || a.source.localeCompare(b.source));
}

export interface OverallConversion {
  total: number;
  won: number;
  rate: number; // won as a whole percent of ALL leads, open and lost ones included
}

export function overallConversion(leads: readonly LeadFacts[]): OverallConversion {
  const won = leads.filter(l => l.status === "won").length;
  return { total: leads.length, won, rate: leads.length > 0 ? Math.round((won / leads.length) * 100) : 0 };
}
