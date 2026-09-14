import React from "react";
import SupernovaCard from "@/components/SupernovaCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import {
  FiAlertTriangle,
  FiTrendingUp,
  FiActivity,
  FiPieChart,
} from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";
import { useIntelligence } from "@/context/IntelligenceProvider";
import { marketVolatility, buyingConfidence } from "@/engines/RiskEngine";

const VOLATILITY_SCORE: Record<"low" | "medium" | "high", number> = {
  low: 20,
  medium: 50,
  high: 80,
};

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// Every number on this page used to be a hardcoded literal ("32%",
// "12%", etc) regardless of what was actually in stock. All four are
// now real, computed from the same per-vehicle risk/market/MOT scoring
// IntelligenceProvider already runs for AI Insights and the dealer HUD.
export default function DealerRiskHub() {
  const { vehicles, loading: inventoryLoading } = useInventory();
  const { riskScores, motHealth, loading: intelLoading } = useIntelligence();

  const inStock = vehicles.filter((v) => v.status !== "sold");

  const overallRisk = Math.round(average(inStock.map((v) => riskScores[v.id] ?? 0)));
  const marketVolatilityPct = Math.round(
    average(inStock.map((v) => VOLATILITY_SCORE[marketVolatility(v)]))
  );
  const motRisk = Math.round(
    average(inStock.map((v) => 100 - (motHealth[v.id]?.healthScore ?? 100)))
  );
  const stockStability = Math.round(
    average(inStock.map((v) => buyingConfidence(v)))
  );

  const mot30Days = inStock.filter((v) => {
    if (!v.mot?.expiry) return false;
    const days = (new Date(v.mot.expiry).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;
  const highAdvisoryCount = inStock.filter(
    (v) => (v.mot?.advisories?.length ?? 0) >= 3
  ).length;
  const highRiskCount = inStock.filter((v) => (riskScores[v.id] ?? 0) >= 60).length;

  const loading = inventoryLoading || intelLoading;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto animate-fadeIn">

      <SupernovaSectionDivider label="Risk Intelligence Hub" />

      <p className="text-white/60 mb-6">
        AI‑powered dealership risk scoring, MOT risk signals, and market
        stability — computed from your {inStock.length} in-stock vehicle{inStock.length === 1 ? "" : "s"}.
      </p>

      {loading || inStock.length === 0 ? (
        <SupernovaCard title="Dealership Risk Overview" accent="red">
          <p className="text-white/60">
            {loading ? "Loading…" : "Add vehicles to your inventory to see risk scoring."}
          </p>
        </SupernovaCard>
      ) : (
        <>
          <SupernovaCard title="Dealership Risk Overview" accent="red">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white/70">
              <div>
                <div className="flex items-center gap-2 text-red-400 font-semibold">
                  <FiAlertTriangle /> Overall Risk
                </div>
                <p className="mt-1">{overallRisk}%</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                  <FiTrendingUp /> Market Volatility
                </div>
                <p className="mt-1">{marketVolatilityPct}%</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-blue-400 font-semibold">
                  <FiActivity /> MOT Risk
                </div>
                <p className="mt-1">{motRisk}%</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-green-400 font-semibold">
                  <FiPieChart /> Stock Stability
                </div>
                <p className="mt-1">{stockStability}%</p>
              </div>
            </div>
          </SupernovaCard>

          <SupernovaCard
            title="AI Risk Insights"
            subtitle="Patterns detected across your real MOT, stock, and risk data."
            accent="gold"
          >
            {mot30Days === 0 && highAdvisoryCount === 0 && highRiskCount === 0 ? (
              <p className="text-white/60">No elevated risk signals detected right now.</p>
            ) : (
              <ul className="list-disc pl-6 text-white/70 space-y-2">
                {mot30Days > 0 && (
                  <li>{mot30Days} vehicle{mot30Days === 1 ? "" : "s"} have an MOT due within 30 days.</li>
                )}
                {highAdvisoryCount > 0 && (
                  <li>{highAdvisoryCount} vehicle{highAdvisoryCount === 1 ? "" : "s"} have 3+ MOT advisories, which tends to reduce buyer confidence.</li>
                )}
                {highRiskCount > 0 && (
                  <li>{highRiskCount} vehicle{highRiskCount === 1 ? "" : "s"} are scoring 60+ on overall risk.</li>
                )}
              </ul>
            )}
          </SupernovaCard>
        </>
      )}
    </div>
  );
}
