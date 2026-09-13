import React, { createContext, useContext, useState, useEffect } from "react";

import { ultraInventory } from "../dealer/ultraInventory";
import { dummyVehicles } from "../dealer/dummyVehicles";

import fetchMarketFromServer from "../lib/fetchMarketFromServer";
import { loadInventoryFromServer, saveInventoryToServer } from "./inventoryStorage.web";

import type { Vehicle } from "../types/Vehicle";

// ⭐ AI enrichment layer
import { enrichVehicleWithAI } from "../dealer/intelligence/dealerAI";

interface InventoryContextType {
  vehicles: Vehicle[];
  loading: boolean;
  refreshInventory: () => void;

  updateVehicleMOT: (vehicleId: string, motData: Vehicle["mot"]) => void;
  updateVehicleSale: (vehicleId: string, sellPrice: number) => void;
  updateVehicle: (vehicleId: string, patch: Partial<Vehicle>) => void;
  deleteVehicle: (vehicleId: string) => void;
  createVehicleFromMOT: (motData: any) => Vehicle;
  addManualVehicle: (data: {
    reg?: string | null;
    make: string;
    model: string;
    year?: number | null;
    colour?: string | null;
    mileage?: number | null;
    buyPrice?: number | null;
    sellPrice?: number | null;
    notes?: string | null;
    images?: string[] | null;
    mot?: Partial<Vehicle["mot"]>;
  }) => Vehicle;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ SAFE LOAD — NEVER THROWS
  //
  // Previously this always rebuilt the list from local seed data on
  // every load — nothing was ever actually persisted (createVehicleFromMOT/
  // updateVehicleMOT only touched React state, so an added/edited vehicle
  // vanished on refresh). Now the real backend is the source of truth:
  // if it already has vehicles, use those; if it's empty (first run),
  // seed it once from the local demo data so the nice sample inventory
  // still shows up, but from then on the backend is authoritative.
  const loadInventory = async () => {
    setLoading(true);

    try {
      const fromServer = await loadInventoryFromServer();

      if (fromServer.length > 0) {
        setVehicles(fromServer.map(v => enrichVehicleWithAI(v)));
        setLoading(false);
        return;
      }

      const local = ultraInventory || [];
      const fallback = dummyVehicles || [];

      // ⭐ Prevent crash if market lookup is offline
      const market = await fetchMarketFromServer("default").catch(() => null);

      const mergedRaw = [
        ...local,
        ...fallback,
        ...(market?.vehicles || [])
      ];

      await saveInventoryToServer(mergedRaw);

      const merged = mergedRaw.map(v => enrichVehicleWithAI(v));
      setVehicles(merged);
    } catch (err) {
      console.error("Inventory load failed:", err);

      // ⭐ Guaranteed fallback
      setVehicles(dummyVehicles.map(v => enrichVehicleWithAI(v)));
    }

    setLoading(false);
  };

  // ⭐ STRICTMODE‑SAFE EFFECT (runs twice but never crashes)
  useEffect(() => {
    (async () => {
      try {
        await loadInventory();
      } catch (err) {
        console.warn("Inventory failed to load:", err);
        setVehicles(dummyVehicles.map(v => enrichVehicleWithAI(v)));
        setLoading(false);
      }
    })();
  }, []);

  // ⭐ UPDATE VEHICLE MOT
  function updateVehicleMOT(vehicleId: string, motData: Vehicle["mot"]) {
    setVehicles(prev => {
      const updated = prev.map(v =>
        v.id === vehicleId
          ? { ...v, mot: motData }
          : v
      );
      saveInventoryToServer(updated);
      return updated;
    });
  }

  // ⭐ RECORD SALE PRICE
  //
  // Bookkeeping's AddSaleModal records sales into its own store
  // (BookkeepingProvider's SaleEntry[]) — that's the source of truth for
  // the ledger itself, but nothing kept the vehicle's own sellPrice in
  // sync, so anything reading it from here (Supplier Analytics/Detail)
  // showed £0 profit even after a real sale was recorded.
  function updateVehicleSale(vehicleId: string, sellPrice: number) {
    setVehicles(prev => {
      const updated = prev.map(v =>
        v.id === vehicleId
          ? { ...v, sellPrice, status: "sold" as Vehicle["status"] }
          : v
      );
      saveInventoryToServer(updated);
      return updated;
    });
  }

  // ⭐ GENERIC EDIT
  //
  // EditVehicle.tsx used to call `(window as any).__inventory_setVehicles?.(...)`
  // — a global hook nothing in the codebase ever assigned, so Save/Delete
  // there silently did nothing at all before navigating to a dead route.
  function updateVehicle(vehicleId: string, patch: Partial<Vehicle>) {
    setVehicles(prev => {
      const updated = prev.map(v =>
        v.id === vehicleId ? { ...v, ...patch } : v
      );
      saveInventoryToServer(updated);
      return updated;
    });
  }

  function deleteVehicle(vehicleId: string) {
    setVehicles(prev => {
      const updated = prev.filter(v => v.id !== vehicleId);
      saveInventoryToServer(updated);
      return updated;
    });
  }

  // ⭐ AUTO‑CREATE VEHICLE FROM MOT LOOKUP
  function createVehicleFromMOT(mot: any): Vehicle {
    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),

      make: mot.make ?? "",
      model: mot.model ?? "",
      year: mot.year ?? null,
      mileage: mot.mileage ?? null,
      colour: mot.colour ?? null,

      priceRetail: 0,
      priceTrade: 0,

      marketHeat: 0,
      riskScore: 0,
      condition: "Unknown",

      mot: {
        expiry: mot.expiry ?? "",
        advisories: mot.advisories ?? [],
        historyScore: mot.historyScore ?? 0,
        history: mot.history ?? [],
        reg: mot.reg ?? null,
        make: mot.make ?? null,
        model: mot.model ?? null,
        year: mot.year ?? null,
        colour: mot.colour ?? null,
        mileage: mot.mileage ?? null,
      },

      serviceHistory: [],
      predictedRepairs: [],
      depreciationCurve: [],

      finance: {
        apr: 0,
        depositMin: 0,
        lenderTier: "A",
      },

      buyerPersona: [],
      sellerPsychology: [],
      supernovaScore: 0,
      flipDifficulty: 0,
      valuationConfidence: 0,
      photoQuality: 0,
      auctionDelta: 0,

      notes: null,
      images: null,

      costs: [],
      vatScheme: "margin",

      img: "/placeholder-car.png",
      status: "new",
    };

    const enriched = enrichVehicleWithAI(newVehicle);
    setVehicles(prev => {
      const updated = [...prev, enriched];
      saveInventoryToServer(updated);
      return updated;
    });

    return enriched;
  }

  // ⭐ MANUAL "ADD A CAR" ENTRY (Bookkeeping's New Vehicle screen)
  //
  // This used to write to a completely different, unrelated data store
  // (VehicleHistoryContext, a FlipRecord[] left over from the original
  // consumer app this was ported from) — so a car "bought" here never
  // showed up in the real Inventory List, AI Insights, the dashboard,
  // or anywhere else that reads from this provider. It just vanished
  // into a shadow store nothing else looked at.
  function addManualVehicle(data: {
    reg?: string | null;
    make: string;
    model: string;
    year?: number | null;
    colour?: string | null;
    mileage?: number | null;
    buyPrice?: number | null;
    sellPrice?: number | null;
    notes?: string | null;
    images?: string[] | null;
    mot?: Partial<Vehicle["mot"]>;
  }): Vehicle {
    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),

      ...(data.reg ? { reg: data.reg } : {}),
      make: data.make,
      model: data.model,
      year: data.year ?? null,
      mileage: data.mileage ?? null,
      ...(data.colour ? { colour: data.colour } : {}),

      buyPrice: data.buyPrice ?? null,
      sellPrice: data.sellPrice ?? null,
      priceRetail: data.sellPrice ?? 0,
      priceTrade: data.buyPrice ?? 0,

      marketHeat: 0,
      riskScore: 0,
      condition: "Unknown",

      mot: {
        expiry: data.mot?.expiry ?? "",
        advisories: data.mot?.advisories ?? [],
        historyScore: data.mot?.historyScore ?? 0,
        history: data.mot?.history ?? [],
        reg: data.reg ?? data.mot?.reg ?? null,
        make: data.make ?? data.mot?.make ?? null,
        model: data.model ?? data.mot?.model ?? null,
        year: data.year ?? data.mot?.year ?? null,
        colour: data.colour ?? data.mot?.colour ?? null,
        mileage: data.mileage ?? data.mot?.mileage ?? null,
      },

      serviceHistory: [],
      predictedRepairs: [],
      depreciationCurve: [],

      finance: {
        apr: 0,
        depositMin: 0,
        lenderTier: "A",
      },

      buyerPersona: [],
      sellerPsychology: [],
      supernovaScore: 0,
      flipDifficulty: 0,
      valuationConfidence: 0,
      photoQuality: data.images?.length ? 70 : 0,
      auctionDelta: 0,

      notes: data.notes ?? null,
      images: data.images ?? null,

      costs: [],
      vatScheme: "margin",

      img: data.images?.[0] ?? "/placeholder-car.png",
      status: "new",
    };

    const enriched = enrichVehicleWithAI(newVehicle);
    setVehicles(prev => {
      const updated = [...prev, enriched];
      saveInventoryToServer(updated);
      return updated;
    });

    return enriched;
  }

  return (
    <InventoryContext.Provider
      value={{
        vehicles,
        loading,
        refreshInventory: loadInventory,
        updateVehicleMOT,
        updateVehicleSale,
        updateVehicle,
        deleteVehicle,
        createVehicleFromMOT,
        addManualVehicle,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside InventoryProvider");
  return ctx;
}
