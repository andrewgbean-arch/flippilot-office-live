// Pilot Brain used to know only how many leads were open — not where they
// come from or which sources actually turn into sales. This builds the
// plain-text "lead sources" lines for the business snapshot, in the same
// evidence-only style as the rest of it: every figure is a count of real
// stored leads, and it says so when there are too few to call a rate.
//
// Only counts per source go to the model — never a lead's name, phone,
// email or notes. (The source itself is text a member of staff typed, so it
// is flattened to one short line first.)

import { oneLine } from "./promptText";

export interface SourceLead {
  source?: unknown;
  status?: unknown;
  createdAt?: unknown;
}

const DAY_MS = 86400000;
export const LEAD_WINDOW_DAYS = 90;
const MAX_SOURCES_SHOWN = 6;
const MAX_SOURCE_LABEL = 40;
// The same floor the Advisor uses before it will call any source "the best".
const MIN_LEADS_FOR_RATE = 3;
export const NO_SOURCE_LABEL = "(no source recorded)";

// The public booking form also creates a lead for an MOT booking. That's the
// customer's own car, so it can never be won as a sale — counting it would
// drag "Website Booking" conversion down for no real reason.
export const MOT_BOOKING_STATUS = "mot_booked";

interface Bucket {
  spellings: Map<string, number>;
  total: number;
  won: number;
  lost: number;
  open: number;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// "AutoTrader", "Auto Trader" and "auto-trader" are one source.
function sourceKey(label: string): string {
  return label.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function labelOf(bucket: Bucket): string {
  let best = "";
  let bestCount = 0;
  for (const [spelling, count] of bucket.spellings) {
    if (count > bestCount) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

function sourceLine(label: string, b: Bucket): string {
  const rate =
    b.total >= MIN_LEADS_FOR_RATE
      ? ` (${Math.round((b.won / b.total) * 100)}% conversion)`
      : "";
  const caution = b.total < MIN_LEADS_FOR_RATE ? " (too few leads to call a conversion rate)" : "";
  return `- ${label}: ${b.total} ${plural(b.total, "lead", "leads")}, ${b.won} won${rate}, ${b.lost} lost, ${b.open} still open${caution}`;
}

export function summariseLeadSources(leads: SourceLead[], now: number): string[] {
  if (leads.length === 0) return ["Lead sources: no leads recorded yet."];

  const cutoff = now - LEAD_WINDOW_DAYS * DAY_MS;
  const buckets = new Map<string, Bucket>();
  let motBookings = 0;
  let undated = 0;

  for (const lead of leads) {
    const created = typeof lead.createdAt === "string" ? new Date(lead.createdAt).getTime() : NaN;
    // A day's grace for a phone or laptop whose clock runs a little fast;
    // anything further ahead than that isn't a real creation date.
    if (Number.isNaN(created) || created > now + DAY_MS) {
      undated += 1;
      continue;
    }
    if (created < cutoff) continue;

    const status = typeof lead.status === "string" ? lead.status.trim().toLowerCase() : "";
    if (status === MOT_BOOKING_STATUS) {
      motBookings += 1;
      continue;
    }

    const spelling = oneLine(lead.source, MAX_SOURCE_LABEL);
    const key = sourceKey(spelling);
    const bucket = buckets.get(key) ?? { spellings: new Map(), total: 0, won: 0, lost: 0, open: 0 };
    bucket.spellings.set(spelling, (bucket.spellings.get(spelling) ?? 0) + 1);
    bucket.total += 1;
    if (status === "won") bucket.won += 1;
    else if (status === "lost") bucket.lost += 1;
    else bucket.open += 1;
    buckets.set(key, bucket);
  }

  const notes: string[] = [];
  if (motBookings > 0) {
    notes.push(
      `${motBookings} website MOT ${plural(motBookings, "booking", "bookings")} in that window ${plural(motBookings, "is", "are")} left out — that's the customer's own car, so it can't become a sale.`
    );
  }
  if (undated > 0) {
    notes.push(
      `${undated} ${plural(undated, "lead has", "leads have")} no usable created date and ${plural(undated, "is", "are")} left out.`
    );
  }

  const all = [...buckets.entries()].map(([key, bucket]) => ({
    label: key === "" ? NO_SOURCE_LABEL : labelOf(bucket),
    bucket,
  }));

  if (all.length === 0) {
    return [`Lead sources (leads created in the last ${LEAD_WINDOW_DAYS} days): none in that window.`, ...notes];
  }

  all.sort((a, b) => b.bucket.total - a.bucket.total || b.bucket.won - a.bucket.won || a.label.localeCompare(b.label));

  const total = all.reduce((sum, s) => sum + s.bucket.total, 0);
  const won = all.reduce((sum, s) => sum + s.bucket.won, 0);
  const lost = all.reduce((sum, s) => sum + s.bucket.lost, 0);
  const open = all.reduce((sum, s) => sum + s.bucket.open, 0);

  const lines = [
    `Lead sources (leads created in the last ${LEAD_WINDOW_DAYS} days): ${total} in all — ${won} won, ${lost} lost, ${open} still open. Conversion is won ÷ all leads from that source, so leads still open count against it until they're decided.`,
    ...all.slice(0, MAX_SOURCES_SHOWN).map(s => sourceLine(s.label, s.bucket)),
  ];

  const rest = all.slice(MAX_SOURCES_SHOWN);
  if (rest.length > 0) {
    const restLeads = rest.reduce((sum, s) => sum + s.bucket.total, 0);
    const restWon = rest.reduce((sum, s) => sum + s.bucket.won, 0);
    lines.push(
      `- ${rest.length} other ${plural(rest.length, "source", "sources")}: ${restLeads} ${plural(restLeads, "lead", "leads")} between them, ${restWon} won`
    );
  }

  return [...lines, ...notes];
}
