// The dealer's side of "tell me when you get one": the list of people who asked
// the dealer to watch for a car, and what they've done about each. Saved with the
// dealer's own login. (The form a customer fills in is in src/public/.)
import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

export type WantedStatus = "waiting" | "contacted" | "closed";

export interface WantedMatch {
  vehicleId: string;
  label: string;
  price: number | null;
  // Only when the car has a price above what they said they would spend.
  overBudgetBy?: number;
}

export interface WantedItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  make?: string;
  model?: string;
  maxPrice?: number;
  note?: string;
  status: WantedStatus;
  consent: { at: string; wording: string };
  createdAt: string;
  askedAt: string;
  statusChangedAt?: string;
  // Cars in stock right now that fit what they asked for.
  matches: WantedMatch[];
}

export interface WantedResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function call<T>(path: string, init: RequestInit, pick: (body: any) => T): Promise<WantedResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...authHeaders() } });
    const body = await res.json();
    if (!res.ok || !body.ok) return { ok: false, status: res.status, error: typeof body.error === "string" ? body.error : undefined };
    return { ok: true, status: res.status, data: pick(body) };
  } catch (err) {
    console.error("wantedApi: backend unreachable", err);
    return { ok: false, status: 0, error: "Network error" };
  }
}

export const loadWanted = () =>
  call("/wanted", { method: "GET" }, body => ({
    items: (Array.isArray(body.items) ? body.items : []) as WantedItem[],
    retentionDays: typeof body.retentionDays === "number" ? body.retentionDays : 365,
  }));

export const setWantedStatus = (id: string, status: WantedStatus) =>
  call(`/wanted/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status }) }, body => body.item as WantedItem);

export const deleteWanted = (id: string) => call(`/wanted/${encodeURIComponent(id)}`, { method: "DELETE" }, () => true);
