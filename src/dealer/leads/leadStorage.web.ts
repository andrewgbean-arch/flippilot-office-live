import type { Lead } from "./leadTypes";

const BASE_URL = "http://localhost:4001";

// Was localStorage-only — leads never left the one browser they were
// created in, with no backup and no way for a second device/browser to
// see the same data. Same function signatures, now backed by the real
// backend (src/backend/src/routes/leads.ts) instead.
export async function saveLeads(leads: Lead[]) {
  try {
    await fetch(`${BASE_URL}/leads`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: leads }),
    });
  } catch (err) {
    console.error("saveLeads: backend unreachable", err);
  }
}

export async function loadLeads(): Promise<Lead[]> {
  try {
    const res = await fetch(`${BASE_URL}/leads`);
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadLeads: backend unreachable", err);
    return [];
  }
}
