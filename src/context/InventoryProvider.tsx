import React, { createContext, useContext, useState, useEffect } from "react";

import { ultraInventory } from "../dealer/ultraInventory";
import { dummyVehicles } from "../dealer/dummyVehicles";

import fetchMarketFromServer from "../lib/fetchMarketFromServer";

import type { Vehicle } from "../types/Vehicle";

// ⭐ AI enrichment layer
import { enrichVehicleWithAI } from "../dealer/intelligence/dealerAI";

interface InventoryContextType {
  vehicles: Vehicle[];
  loading: boolean;
  refreshInventory: () => void;

  updateVehicleMOT: (vehicleId: string, motData: Vehicle["mot"]) => void;
  createVehicleFromMOT: (motData: any) => Vehicle;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ SAFE LOAD — NEVER THROWS
  const loadInventory = async () => {
    setLoading(true);

    try {
      const local = ultraInventory || [];
      const fallback = dummyVehicles || [];

      // ⭐ Prevent crash if backend is offline
      const market = await fetchMarketFromServer("default").catch(() => null);

      const mergedRaw = [
        ...local,
        ...fallback,
        ...(market?.vehicles || [])
      ];

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
    setVehicles(prev =>
      prev.map(v =>
        v.id === vehicleId
          ? { ...v, mot: motData }
          : v
      )
    );
  }

  // ⭐ AUTO‑CREATE VEHICLE FROM MOT LOOKUP
  function createVehicleFromMOT(mot: any): Vehicle {
    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),

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
    setVehicles(prev => [...prev, enriched]);

    return enriched;
  }

  return (
    <InventoryContext.Provider
      value={{
        vehicles,
        loading,
        refreshInventory: loadInventory,
        updateVehicleMOT,
        createVehicleFromMOT,
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
