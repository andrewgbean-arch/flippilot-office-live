import React, { createContext, useContext, useState } from "react";
import type { Consumable } from "@/consumables/consumableTypes";
import {
  loadConsumables,
  addConsumable as addConsumableApi,
  saveConsumables,
  deleteConsumable as deleteConsumableApi,
  recordStockMovement as recordStockMovementApi,
} from "@/consumables/consumableStorage.web";
import { useAuth } from "@/context/AuthContext";
import { useGuardedLoad } from "@/lib/useGuardedLoad";

interface ConsumablesContextType {
  consumables: Consumable[];
  loading: boolean;
  addConsumable: (input: {
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
  }) => Promise<string | null>;
  // false = nothing was saved because the consumables haven't loaded.
  updateConsumable: (id: string, patch: Partial<Consumable>) => Promise<boolean>;
  updateStock: (id: string, currentStock: number) => Promise<boolean>;
  recordStockMovement: (
    id: string,
    input: { type: "receive" | "adjust"; quantity: number; date?: string; cost?: number; supplier?: string; note?: string }
  ) => Promise<string | null>;
  removeConsumable: (id: string) => Promise<void>;
  importConsumables: (rows: {
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
  }[]) => Promise<number>;
}

const ConsumablesContext = createContext<ConsumablesContextType | undefined>(undefined);

export function ConsumablesProvider({ children }: { children: React.ReactNode }) {
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const { user } = useAuth();

  // Editing a stock level and importing a CSV save the WHOLE list back,
  // so guardSave() refuses until the consumables have loaded for this
  // login. Add, stock movements and remove hit per-item endpoints, so
  // they need no guard.
  const { loading, guardSave } = useGuardedLoad<Consumable[]>({
    id: "consumables",
    label: "consumables",
    key: user?.dealershipId,
    load: loadConsumables,
    apply: setConsumables,
    clear: () => setConsumables([]),
  });

  async function addConsumable(input: {
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
  }) {
    const res = await addConsumableApi(input);
    if (res.ok && res.entry) setConsumables(prev => [...prev, res.entry!]);
    return res.ok ? null : res.error ?? "Could not add consumable";
  }

  async function updateConsumable(id: string, patch: Partial<Consumable>) {
    if (!guardSave()) return false;
    const updated = consumables.map(c => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c));
    setConsumables(updated);
    await saveConsumables(updated);
    return true;
  }

  async function updateStock(id: string, currentStock: number) {
    return updateConsumable(id, { currentStock });
  }

  async function recordStockMovement(
    id: string,
    input: { type: "receive" | "adjust"; quantity: number; date?: string; cost?: number; supplier?: string; note?: string }
  ) {
    const res = await recordStockMovementApi(id, input);
    if (res.ok && res.item) {
      setConsumables(prev => prev.map(c => (c.id === id ? res.item! : c)));
      return null;
    }
    return res.error ?? "Could not record stock movement";
  }

  async function removeConsumable(id: string) {
    setConsumables(prev => prev.filter(c => c.id !== id));
    await deleteConsumableApi(id);
  }

  // Bulk create (CSV import) — builds every row client-side (this
  // collection has no bulk-create backend endpoint, only single POST
  // and whole-collection PUT) and saves once via the same PUT the
  // rest of this context already uses for edits.
  async function importConsumables(rows: {
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
  }[]) {
    // Throws rather than returning 0: the import screen reports success
    // unless this throws, and it must not claim rows were imported when
    // nothing was saved.
    if (!guardSave()) {
      throw new Error("Consumables haven't loaded, so this import was not saved.");
    }
    const now = new Date().toISOString();
    const newItems: Consumable[] = rows.map(r => ({
      id: crypto.randomUUID(),
      name: r.name,
      ...(r.partNumber ? { partNumber: r.partNumber } : {}),
      ...(r.description ? { description: r.description } : {}),
      ...(r.supplierName ? { supplierName: r.supplierName } : {}),
      ...(r.supplierEmail ? { supplierEmail: r.supplierEmail } : {}),
      ...(r.supplierPhone ? { supplierPhone: r.supplierPhone } : {}),
      ...(r.unit ? { unit: r.unit } : {}),
      currentStock: r.currentStock,
      reorderThreshold: r.reorderThreshold,
      ...(r.notes ? { notes: r.notes } : {}),
      updatedAt: now,
    }));
    const updated = [...consumables, ...newItems];
    setConsumables(updated);
    await saveConsumables(updated);
    return newItems.length;
  }

  return (
    <ConsumablesContext.Provider
      value={{ consumables, loading, addConsumable, updateConsumable, updateStock, recordStockMovement, removeConsumable, importConsumables }}
    >
      {children}
    </ConsumablesContext.Provider>
  );
}

export function useConsumables() {
  const ctx = useContext(ConsumablesContext);
  if (!ctx) throw new Error("useConsumables must be used inside ConsumablesProvider");
  return ctx;
}
