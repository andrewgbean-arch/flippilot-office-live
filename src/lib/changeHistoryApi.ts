import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// The owner's Change History (the server's changeHistory.ts): who changed which
// record, when, and what it was before. Owner only; kept 90 days.

export type ChangeAction = "added" | "changed" | "removed" | "note";

export interface FieldChange {
  field: string;
  before?: string;
  after?: string;
}

export interface ChangeEntry {
  id: number;
  at: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  area: string;
  recordId: string | null;
  recordLabel: string;
  action: ChangeAction;
  changes: FieldChange[];
}

export interface ChangeHistoryPage {
  days: number;
  keptDays: number;
  entries: ChangeEntry[];
  nextBefore: number | null;
  people: { id: string | null; name: string }[];
  areas: string[];
}

export interface ChangeQuery {
  days: number;
  person?: string;
  area?: string;
  search?: string;
  before?: number;
}

export type ChangeHistoryResult = ({ ok: true } & ChangeHistoryPage) | { ok: false; error: string };

export async function fetchChangeHistory(q: ChangeQuery): Promise<ChangeHistoryResult> {
  const params = new URLSearchParams({ days: String(q.days) });
  if (q.person) params.set("person", q.person);
  if (q.area) params.set("area", q.area);
  if (q.search?.trim()) params.set("search", q.search.trim());
  if (q.before) params.set("before", String(q.before));
  try {
    const res = await fetch(`${BASE_URL}/change-history?${params}`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Couldn't load the change history. Please try again." };
    return { ok: true, ...(data as ChangeHistoryPage) };
  } catch {
    return { ok: false, error: "Couldn't reach Dealer OS. Check your connection and try again." };
  }
}
