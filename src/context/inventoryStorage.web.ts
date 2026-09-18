import type { Vehicle } from "../types/Vehicle";
import { authHeaders } from "@/lib/authToken";

import { BASE_URL } from "@/lib/apiBaseUrl";

// GET /inventory used to return two hardcoded vehicles (Ford Fiesta /
// BMW 1 Series) regardless of what the app did — no real persistence
// existed. Same whole-collection load/save pattern as leads/staff, now
// backed by src/backend/src/routes/inventory.ts. This endpoint now
// requires auth (see backend/src/server.ts), hence authHeaders() below.
//
// Returns null — NOT an empty list — when the stock couldn't be read
// (dropped connection, 401/402/403/5xx, a response that isn't a stock
// list). This used to return [] for both "this dealer genuinely has no
// vehicles yet" and "the request failed", and the caller treated both
// as a first run: it showed demo cars and, on the next save, wrote
// them over the dealer's real stock. An empty array from here now only
// ever means the server answered successfully and the list really is
// empty.
export async function loadInventoryFromServer(): Promise<Vehicle[] | null> {
  try {
    const res = await fetch(`${BASE_URL}/inventory`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : null;
  } catch (err) {
    console.error("loadInventoryFromServer: could not load stock", err);
    return null;
  }
}

export async function saveInventoryToServer(vehicles: Vehicle[]) {
  try {
    await fetch(`${BASE_URL}/inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items: vehicles }),
    });
  } catch (err) {
    console.error("saveInventoryToServer: backend unreachable", err);
  }
}
