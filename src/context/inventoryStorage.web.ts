import type { Vehicle } from "../types/Vehicle";
import { authHeaders } from "@/lib/authToken";

import { BASE_URL } from "@/lib/apiBaseUrl";

// GET /inventory used to return two hardcoded vehicles (Ford Fiesta /
// BMW 1 Series) regardless of what the app did — no real persistence
// existed. Same whole-collection load/save pattern as leads/staff, now
// backed by src/backend/src/routes/inventory.ts. This endpoint now
// requires auth (see backend/src/server.ts), hence authHeaders() below.
export async function loadInventoryFromServer(): Promise<Vehicle[]> {
  try {
    const res = await fetch(`${BASE_URL}/inventory`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadInventoryFromServer: backend unreachable", err);
    return [];
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
