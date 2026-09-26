import type { Lead } from "./leadTypes";
import { authHeaders } from "@/lib/authToken";
import { loadList } from "@/lib/loadJson";

import { BASE_URL } from "@/lib/apiBaseUrl";

// Was localStorage-only — leads never left the one browser they were
// created in, with no backup and no way for a second device/browser to
// see the same data. Same function signatures, now backed by the real
// backend (src/backend/src/routes/leads.ts) instead. This endpoint now
// requires auth (see backend/src/server.ts), hence authHeaders() below.
// Says whether the server kept it: a refused save (for example removing a
// lead or job without the right role) must not look like it worked.
export interface SaveResult { ok: boolean; error?: string }

async function putList(path: string, items: unknown[]): Promise<SaveResult> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: typeof data.error === "string" ? data.error : "That couldn't be saved. Please try again." };
  } catch {
    return { ok: false, error: "Couldn't reach FlipPilot, so that wasn't saved. Please try again." };
  }
}

export async function saveLeads(leads: Lead[]): Promise<SaveResult> {
  return putList("/leads", leads);
}

// null = the leads couldn't be read (dropped connection, 401/402/403/5xx,
// not a list). [] only ever means the server said there are none. Every
// add/update/remove re-reads this list and saves it back with the change,
// so a failed read taken for "no leads" replaced ALL of them with just
// the one being added (see loadJson.ts).
export async function loadLeads(): Promise<Lead[] | null> {
  return loadList<Lead>("/leads");
}
