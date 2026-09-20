import type { Lead, LeadStatus } from "@/dealer/leads/leadTypes";

// The counts behind the lead summary screen (formerly "CRM Intelligence").
// That screen showed an "Engagement", "Conversion Chance" and "Risk" percentage
// for every lead, taken from a table someone typed in per pipeline stage, and
// told staff that leads like this "convert 3x more often within 48 hours",
// which nothing in the app measures. What is here is only what the lead
// records say: which stage each lead is at, where it came from, and how long
// ago it was added.

const DAY_MS = 86_400_000;

export const STATUS_ORDER: readonly LeadStatus[] = [
  "new",
  "contacted",
  "viewing_booked",
  "test_drive",
  "negotiating",
  "won",
  "lost",
];

// Same words the Leads dashboard uses.
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  viewing_booked: "Viewing Booked",
  test_drive: "Test Drive",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export const NO_SOURCE_LABEL = "Source not recorded";

export interface StatusCount {
  status: string;
  label: string;
  count: number;
}

export interface SourceCount {
  source: string;
  total: number;
  won: number;
}

export interface AgeBucket {
  key: "week" | "month" | "older" | "unknown";
  label: string;
  count: number;
}

export interface OpenLeadRow {
  id: string;
  name: string;
  statusLabel: string;
  // Whole days since the lead was added; null when its date can't be read.
  days: number | null;
}

export interface LeadSummary {
  total: number;
  // Everything that is neither won nor lost, including a status this screen doesn't know.
  open: number;
  won: number;
  lost: number;
  byStatus: StatusCount[];
  bySource: SourceCount[];
  openByAge: AgeBucket[];
  // The open leads that have waited longest since they were added, oldest first.
  oldestOpen: OpenLeadRow[];
}

// How many of the longest-waiting open leads the screen names.
export const OLDEST_SHOWN = 10;

function isKnownStatus(status: string): status is LeadStatus {
  return (STATUS_ORDER as readonly string[]).includes(status);
}

export function leadAgeDays(createdAt: string | null | undefined, now: Date): number | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function summariseLeads(leads: readonly Lead[], now: Date): LeadSummary {
  const won = leads.filter(l => l.status === "won").length;
  const lost = leads.filter(l => l.status === "lost").length;

  const byStatus: StatusCount[] = STATUS_ORDER.map(status => ({
    status,
    label: STATUS_LABELS[status],
    count: leads.filter(l => l.status === status).length,
  }));
  const other = leads.filter(l => !isKnownStatus(String(l.status))).length;
  if (other > 0) byStatus.push({ status: "other", label: "Other", count: other });

  // Sources are grouped ignoring case and stray spaces ("autotrader" and "AutoTrader " are one source).
  const sources = new Map<string, SourceCount>();
  for (const lead of leads) {
    const shown = String(lead.source ?? "").trim() || NO_SOURCE_LABEL;
    const key = shown.toLowerCase();
    const entry = sources.get(key) ?? { source: shown, total: 0, won: 0 };
    entry.total += 1;
    if (lead.status === "won") entry.won += 1;
    sources.set(key, entry);
  }
  const bySource = [...sources.values()].sort(
    (a, b) => b.total - a.total || a.source.localeCompare(b.source, "en-GB")
  );

  const openLeads = leads.filter(l => l.status !== "won" && l.status !== "lost");
  const aged = openLeads.map(lead => ({ lead, days: leadAgeDays(lead.createdAt, now) }));

  const openByAge: AgeBucket[] = [
    { key: "week", label: "Added in the last 7 days", count: aged.filter(a => a.days !== null && a.days < 7).length },
    { key: "month", label: "Added 7 to 29 days ago", count: aged.filter(a => a.days !== null && a.days >= 7 && a.days < 30).length },
    { key: "older", label: "Added 30 or more days ago", count: aged.filter(a => a.days !== null && a.days >= 30).length },
    { key: "unknown", label: "No date recorded", count: aged.filter(a => a.days === null).length },
  ];

  // Longest wait first; leads with no readable date go last, since we can't say how long they have waited.
  const oldestOpen = [...aged]
    .sort((a, b) => {
      if (a.days === null && b.days === null) return 0;
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return b.days - a.days;
    })
    .slice(0, OLDEST_SHOWN)
    .map(({ lead, days }) => ({
      id: lead.id,
      name: String(lead.name ?? "").trim() || "Unnamed lead",
      statusLabel: isKnownStatus(String(lead.status)) ? STATUS_LABELS[lead.status] : "Other",
      days,
    }));

  return {
    total: leads.length,
    open: openLeads.length,
    won,
    lost,
    byStatus,
    bySource,
    openByAge,
    oldestOpen,
  };
}
