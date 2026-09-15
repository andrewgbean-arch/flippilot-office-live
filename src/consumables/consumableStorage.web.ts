import { authHeaders } from "@/lib/authToken";
import type { Consumable } from "./consumableTypes";

const BASE_URL = "http://localhost:4001";

export async function loadConsumables(): Promise<Consumable[]> {
  try {
    const res = await fetch(`${BASE_URL}/consumables`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadConsumables: backend unreachable", err);
    return [];
  }
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
