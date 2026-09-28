import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// "Recently deleted" (the server's recycleBin.ts): leads, jobs, contacts and
// consumables removed in the last 30 days, which the owner or a manager can
// restore or delete for good.

export type DeletedList = "leads" | "jobs" | "contacts" | "consumables";

export interface DeletedItem {
  id: string;
  list: DeletedList;
  label: string;
  deletedAt: string;
  deletedBy: string;
}

type Result<T> = { ok: true } & T | { ok: false; error: string };

async function call<T>(method: string, path: string): Promise<Result<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { method, headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "That didn't work. Please try again." };
    return { ok: true, ...(data as T) };
  } catch {
    return { ok: false, error: "Couldn't reach Dealer OS. Check your connection and try again." };
  }
}

export const fetchRecentlyDeleted = () => call<{ items: DeletedItem[]; keptForDays: number }>("GET", "/recently-deleted");
export const restoreDeleted = (id: string) => call<{ alreadyThere?: boolean }>("POST", `/recently-deleted/${encodeURIComponent(id)}/restore`);
export const deleteForGood = (id: string) => call<Record<string, never>>("DELETE", `/recently-deleted/${encodeURIComponent(id)}`);
