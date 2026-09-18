import { authHeaders } from "@/lib/authToken";
import { loadList } from "@/lib/loadJson";
import type { Consumable } from "./consumableTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

// null = the consumables couldn't be read (dropped connection,
// 401/402/403/5xx, not a list). [] only ever means the server said there
// are none. Editing a stock level or importing a CSV saves the whole
// list back, so a failed read taken for "no consumables" wiped the rest
// on the next edit (see loadJson.ts).
export async function loadConsumables(): Promise<Consumable[] | null> {
  return loadList<Consumable>("/consumables");
}

export async function addConsumable(input: {
  name: string;
  partNumber?: string;
  description?: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  unit?: string;
  currentStock: number;
  reorderThreshold: number;
  notes?: string;
}): Promise<{ ok: boolean; error?: string; entry?: Consumable }> {
  try {
    const res = await fetch(`${BASE_URL}/consumables`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, entry: data.entry };
  } catch (err) {
    console.error("addConsumable: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function saveConsumables(items: Consumable[]): Promise<void> {
  try {
    await fetch(`${BASE_URL}/consumables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items }),
    });
  } catch (err) {
    console.error("saveConsumables: backend unreachable", err);
  }
}

export async function recordStockMovement(
  id: string,
  input: { type: "receive" | "adjust"; quantity: number; date?: string; cost?: number; supplier?: string; note?: string }
): Promise<{ ok: boolean; error?: string; item?: Consumable }> {
  try {
    const res = await fetch(`${BASE_URL}/consumables/${id}/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, item: data.item };
  } catch (err) {
    console.error("recordStockMovement: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function deleteConsumable(id: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/consumables/${id}`, { method: "DELETE", headers: authHeaders() });
  } catch (err) {
    console.error("deleteConsumable: backend unreachable", err);
  }
}
