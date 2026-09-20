import React, { createContext, useContext, useState, useEffect } from "react";

import { useInventory } from "./InventoryProvider";

import { motAiEngine, type MotAiResult } from "../engines/motAiEngine";

// This provider used to work out four things for every car: a FlipScore, a
// risk score, a "market" reading and an MOT health result. The first three
// were built from the dealer's own buy and asking prices (a "market average"
// that was their own price back again, a FlipScore capped at 50 because most
// of its inputs were never supplied), so they and their consumers are gone.
// Only the MOT health map is still read, by the vehicle page.
interface IntelligenceContextType {
  motHealth: Record<string, MotAiResult>;
  loading: boolean;
}

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(undefined);

// One shared object for "no cars", so clearing an already empty map doesn't re-render.
const NO_MOT_HEALTH: Record<string, MotAiResult> = {};

export function IntelligenceProvider({ children }: { children: React.ReactNode }) {
  const { vehicles } = useInventory();

  const [motHealth, setMotHealth] = useState<Record<string, MotAiResult>>(NO_MOT_HEALTH);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicles || vehicles.length === 0) {
      // Nothing to work out. This used to return here without touching
      // `loading`, which starts true, so a dealer with no cars was "loading"
      // for ever (the header's Refresh button stayed disabled on "Refreshing…"
      // and the Risk Hub said "Loading..."). It also left the previous
      // stock's results behind after the last car was deleted.
      setMotHealth(NO_MOT_HEALTH);
      setLoading(false);
      return;
    }

    setLoading(true);

    const mh: Record<string, MotAiResult> = {};

    vehicles.forEach((v) => {
      // Was missing expiry entirely, so an expired MOT scored as healthy;
      // every other real caller of motAiEngine passes the full mot object.
      const motData = {
        expiry: v.mot?.expiry ?? null,
        advisories: v.mot?.advisories ?? [],
        failures: (v.mot as any)?.failures ?? [],
      };

      const history = [{ mileage: v.mileage }];

      mh[v.id] = motAiEngine(motData, history);
    });

    setMotHealth(mh);
    setLoading(false);
  }, [vehicles]);

  return (
    <IntelligenceContext.Provider value={{ motHealth, loading }}>
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence() {
  const ctx = useContext(IntelligenceContext);
  if (!ctx) throw new Error("useIntelligence must be used inside IntelligenceProvider");
  return ctx;
}
