import React, { createContext, useContext, useState, useEffect } from "react";

import { useInventory } from "./InventoryProvider";
import { useDealer } from "./DealerContext";
import SuperBrainEngine from "../core/superbrain/SuperBrainEngine";

import { calcFlipScore } from "../engines/calcFlipScore";
import { computeRiskScore } from "../engines/RiskEngine";
import { simulateMarketIntel } from "../engines/simulatedMarketIntel";

import { motAiEngine, type MotAiResult } from "../engines/motAiEngine";

// FlipRecord model
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

interface IntelligenceContextType {
  flipScores: Record<string, number>;
  riskScores: Record<string, number>;
  marketIntel: Record<string, any>;
  motHealth: Record<string, MotAiResult>;
  loading: boolean;
}

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(undefined);

export function IntelligenceProvider({ children }: { children: React.ReactNode }) {
  const { vehicles } = useInventory();
  const { dealer } = useDealer();

  const [flipScores, setFlipScores] = useState<Record<string, number>>({});
  const [riskScores, setRiskScores] = useState<Record<string, number>>({});
  const [marketIntel, setMarketIntel] = useState<Record<string, any>>({});
  const [motHealth, setMotHealth] = useState<Record<string, MotAiResult>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicles || vehicles.length === 0) return;

    setLoading(true);

    const fs: Record<string, number> = {};
    const rs: Record<string, number> = {};
    const mh: Record<string, MotAiResult> = {};
    const mi: Record<string, any> = {};

    vehicles.forEach((v) => {
      // ⭐ Build FlipRecord directly from Vehicle (no CarRecord needed)
      const flipRecord: FlipRecord = {
        id: v.id,
        title: `${v.make} ${v.model}`,
        buyPrice: v.priceTrade ?? 0,
        sellPrice: v.priceRetail ?? null,
        valuation: v.priceRetail ?? null,
        mileage: v.mileage,
        flipScore: 0,
       timestamp: new Date().toISOString(),

        mot: {
          motExpiry: v.mot?.expiry ?? null,
        },
      };

      // ⭐ FlipScore
      fs[v.id] = calcFlipScore(flipRecord);
      // Feed the real computed score back in before this same
      // flipRecord is reused below — it was left at the literal 0
      // placeholder it started as, so simulateMarketIntel's demand
      // index (which falls back to flipScore when there's no real
      // market.demandScore) silently ignored the score just computed
      // and floored out at the same low value for every vehicle.
      flipRecord.flipScore = fs[v.id] ?? 0;

      // ⭐ RiskScore
      rs[v.id] = computeRiskScore(v);

      // ⭐ MOT AI
      // Was missing expiry entirely — every other real caller of
      // motAiEngine passes the full mot object (which already has it),
      // this was the one place stripping it down and losing it, which
      // is why the HUD could say "MOT: good" for a fleet with vehicles
      // sitting on expired MOTs.
      const motData = {
        expiry: v.mot?.expiry ?? null,
        advisories: v.mot?.advisories ?? [],
        failures: (v.mot as any)?.failures ?? [],
      };

      const history = [{ mileage: v.mileage }];

      mh[v.id] = motAiEngine(motData, history);

      // ⭐ Market Intel (expects ONE FlipRecord, not an array)
      mi[v.id] = simulateMarketIntel(flipRecord);
    });

    setFlipScores(fs);
    setRiskScores(rs);
    setMotHealth(mh);
    setMarketIntel(mi);

    setLoading(false);
  }, [vehicles, dealer]);

  return (
    <IntelligenceContext.Provider
      value={{ flipScores, riskScores, marketIntel, motHealth, loading }}
    >
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence() {
  const ctx = useContext(IntelligenceContext);
  if (!ctx) throw new Error("useIntelligence must be used inside IntelligenceProvider");
  return ctx;
}
