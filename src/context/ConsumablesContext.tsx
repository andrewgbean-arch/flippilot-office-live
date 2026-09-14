import React, { createContext, useContext, useState, useEffect } from "react";
import type { Consumable } from "@/consumables/consumableTypes";
import {
  loadConsumables,
  addConsumable as addConsumableApi,
  saveConsumables,
  deleteConsumable as deleteConsumableApi,
} from "@/consumables/consumableStorage.web";
import { useAuth } from "@/context/AuthContext";

interface ConsumablesContextType {
  consumables: Consumable[];
  loading: boolean;
  addConsumable: (input: {
    name: string;
    supplierName?: string;
    supplierEmail?: string;
    supplierPhone?: string;
    unit?: string;
    currentStock: number;
    reorderThreshold: number;
    notes?: string;
  }) => Promise<string | null>;
  updateConsumable: (id: string, patch: Partial<Consumable>) => Promise<void>;
  updateStock: (id: string, currentStock: number) => Promise<void>;
  removeConsumable: (id: string) => Promise<void>;
}

const ConsumablesContext = createContext<ConsumablesContextType | undefined>(undefined);

export function ConsumablesProvider({ children }: { children: React.ReactNode }) {
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setConsumables(await loadConsumables());
      setLoading(false);
    })();
  }, [user?.dealershipId]);

  async function addConsumable(input: {
    name: string;
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
    const updated = consumables.map(c => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c));
    setConsumables(updated);
    await saveConsumables(updated);
  }

  async function updateStock(id: string, currentStock: number) {
    await updateConsumable(id, { currentStock });
  }

  async function removeConsumable(id: string) {
    setConsumables(prev => prev.filter(c => c.id !== id));
    await deleteConsumableApi(id);
  }

  return (
    <ConsumablesContext.Provider
      value={{ consumables, loading, addConsumable, updateConsumable, updateStock, removeConsumable }}
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
