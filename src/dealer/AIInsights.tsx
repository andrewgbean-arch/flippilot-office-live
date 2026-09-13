import React from "react";
import SupernovaCard from "../components/SupernovaCard";
import AiValuationSummary from "../vehicle-ai/AiValuationSummary";
import MotAiRiskGauge from "../vehicle-ai/MotAiRiskGauge";
import MotAiVerdictCard from "../vehicle-ai/MotAiVerdictCard";

import DashboardFooter from "../components/DashboardFooter";

import { useInventory } from "@/context/InventoryProvider";
import { useIntelligence } from "@/context/IntelligenceProvider";
import {
  getDealerSummary,
  getBusinessScoreSummary,
  getSmartAlertsSummary,
} from "@/core/superbrain/SuperBrainEngine";
import type { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export default function AIInsights() {
  const { vehicles, loading: inventoryLoading } = useInventory();
  const { flipScores, marketIntel, motHealth, loading: intelLoading } =
    useIntelligence();

  if (inventoryLoading || intelLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">Crunching your inventory…</p>
      </div>
    );
  }

  const featured = vehicles[0];

  if (!featured) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">
          Add vehicles to your inventory to see AI insights.
        </p>
      </div>
    );
  }

  // Same Vehicle → FlipRecord mapping IntelligenceProvider uses, so the
  // fleet-level SuperBrainEngine summaries line up with the per-vehicle
  // scores it already computed.
  const flipRecords: FlipRecord[] = vehicles.map((v) => ({
    id: v.id,
    title: `${v.make} ${v.model}`,
    buyPrice: v.priceTrade ?? 0,
    sellPrice: v.priceRetail ?? null,
    valuation: v.priceRetail ?? null,
    mileage: v.mileage,
    flipScore: flipScores[v.id] ?? 0,
    timestamp: new Date().toISOString(),
    mot: { motExpiry: v.mot?.expiry ?? null },
  }));

  const dealerSummary = getDealerSummary(flipRecords);
  const businessScore = getBusinessScoreSummary(flipRecords);
  const smartAlerts = getSmartAlertsSummary(flipRecords);

  const featuredIntel = marketIntel[featured.id];
  const featuredMot = motHealth[featured.id] ?? null;
  const featuredFlipScore = flipScores[featured.id] ?? 0;

  const valuation = featuredIntel
    ? {
        estimatedValue: featuredIntel.marketAvg,
        confidence: featuredFlipScore,
        notes: `Market pressure: ${featuredIntel.pressureLevel} • Demand index ${featuredIntel.demandIndex}/100`,
      }
    : null;

  return (
    <div className="min-h-screen bg-black text-white flex">

      {/* MAIN PANEL */}
      <div className="flex-1 flex flex-col">

        {/* CONTENT */}
        <main className="flex-1 p-10 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black to-[#1A1A1A] pointer-events-none" />

          {/* Page Title */}
          <header className="mb-8 relative z-10">
            <h1 className="text-4xl font-bold mb-2 text-gold">AI Insights</h1>
            <p className="text-white/70 max-w-2xl">
              Live intelligence from FlipPilot's valuation, risk, and market
              models, computed from your {vehicles.length}-vehicle inventory.
            </p>
          </header>

          {/* Row 1 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 relative z-10">
            <SupernovaCard title={`AI Valuation Summary — ${featured.make} ${featured.model}`}>
              <AiValuationSummary
                aiValuation={valuation}
                theme={{ card: "#111", accent: "#d4af37", text: "#ccc" }}
              />
            </SupernovaCard>

            <SupernovaCard title="MOT Risk Gauge">
              <div className="space-y-4">
                <MotAiRiskGauge
                  ai={featuredMot}
                  theme={{ card: "#111", accent: "#d4af37", text: "#ccc", blackSoft: "#222" }}
                />
                <MotAiVerdictCard
                  ai={featuredMot}
                  theme={{ card: "#111", accent: "#d4af37", text: "#ccc" }}
                />
              </div>
            </SupernovaCard>
          </section>

          {/* Row 2 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 relative z-10">
            <SupernovaCard title="Market Intelligence Snapshot">
              <div className="space-y-2 text-sm text-white/80">
                <p>Fleet size: {dealerSummary.marketHeat.totalVehicles} vehicles</p>
                <p>
                  In stock: {dealerSummary.marketHeat.stockCount} • Sold:{" "}
                  {dealerSummary.marketHeat.soldCount}
                </p>
                <p>Avg. flip time: {dealerSummary.flipTime.avgFlipTimeDays} days</p>
                <p>Total profit: £{dealerSummary.marketHeat.totalProfit.toLocaleString()}</p>
              </div>
            </SupernovaCard>

            <SupernovaCard title="FlipScore AI">
              <div className="space-y-3 text-sm text-white/80">
                <p>{featured.make} {featured.model} FlipScore: {featuredFlipScore}/100</p>
                <p>Fleet avg. margin: £{dealerSummary.priceEfficiency.avgMargin.toLocaleString()}</p>
                <p>
                  Pricing: {dealerSummary.priceEfficiency.underpricedCount} underpriced •{" "}
                  {dealerSummary.priceEfficiency.overpricedCount} overpriced
                </p>
              </div>
            </SupernovaCard>
          </section>

          {/* Row 3 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
            <SupernovaCard title="Supernova Dealer Brain">
              <div className="space-y-2 text-sm text-white/80">
                <p>Business score: {businessScore.score}/100</p>
                <p>Band: {businessScore.band}</p>
                <p>
                  MOT health: {dealerSummary.motHealth.expiredMOT} expired •{" "}
                  {dealerSummary.motHealth.mot30Days} due within 30 days
                </p>
              </div>
            </SupernovaCard>

            <SupernovaCard title="AI Recommendations">
              {smartAlerts.alerts.length === 0 ? (
                <p className="text-sm text-white/60">No alerts — fleet looks healthy.</p>
              ) : (
                <ul className="list-disc list-inside text-sm text-white/80 space-y-1">
                  {smartAlerts.alerts.map((alert, i) => (
                    <li key={i}>{alert}</li>
                  ))}
                </ul>
              )}
            </SupernovaCard>
          </section>
        </main>

        {/* FOOTER */}
        <DashboardFooter />

      </div>
    </div>
  );
}
