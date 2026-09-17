import type { Lead } from "./leadTypes";
import { authHeaders } from "@/lib/authToken";

import { BASE_URL } from "@/lib/apiBaseUrl";

// Was localStorage-only — leads never left the one browser they were
// created in, with no backup and no way for a second device/browser to
// see the same data. Same function signatures, now backed by the real
// backend (src/backend/src/routes/leads.ts) instead. This endpoint now
// requires auth (see backend/src/server.ts), hence authHeaders() below.
export async function saveLeads(leads: Lead[]) {
  try {
    await fetch(`${BASE_URL}/leads`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items: leads }),
    });
  } catch (err) {
    console.error("saveLeads: backend unreachable", err);
  }
}

export async function loadLeads(): Promise<Lead[]> {
  try {
    const res = await fetch(`${BASE_URL}/leads`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadLeads: backend unreachable", err);
    return [];
  }
}
