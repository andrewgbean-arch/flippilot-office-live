import React from "react";
import SupernovaCard from "../components/SupernovaCard";
import AiValuationSummary from "../vehicle-ai/AiValuationSummary";
import MotAiRiskGauge from "../vehicle-ai/MotAiRiskGauge";
import MotAiVerdictCard from "../vehicle-ai/MotAiVerdictCard";
import { MotAiResult } from "@/engines/motAiEngine";

import DashboardFooter from "../components/DashboardFooter";

export default function AIInsights() {
  const mockAi: MotAiResult = {
    healthScore: 70,
    riskLevel: "medium",
    predictedPassChance: 65,
    advisorySeverity: 20,
    failureSeverity: 10,
    mileageRisk: 30,
    nextTestRisk: "Moderate risk of advisories next MOT",
    verdict: "Moderate chance of passing"
  };

  const mockValuation = {
    estimatedValue: 8500,
    confidence: 78,
    notes: "Based on market comparables and vehicle condition."
  };

  const market = {
    segment: "Hatchback / Supermini",
    averagePrice: 8250,
    stockVolume: 142,
    trend: "Rising"
  };

  const flip = {
    score: 87,
    riskBand: "Medium‑Low",
    strategy: "List at market +3% with MOT bundle."
  };

  const nova = {
    score: 92,
    confidence: "High",
    insight: "Focus on 3–5 year old stock with clean MOT history for fastest turn."
  };

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
              Live intelligence from FlipPilot’s valuation, risk, and market models.
              Use this screen as your AI command center.
            </p>
          </header>

          {/* Row 1 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 relative z-10">
            <SupernovaCard title="AI Valuation Summary">
              <AiValuationSummary
                aiValuation={mockValuation}
                theme={{ card: "#111", accent: "#d4af37", text: "#ccc" }}
              />
            </SupernovaCard>

            <SupernovaCard title="MOT Risk Gauge">
              <div className="space-y-4">
                <MotAiRiskGauge
                  ai={mockAi}
                  theme={{ card: "#111", accent: "#d4af37", text: "#ccc", blackSoft: "#222" }}
                />
                <MotAiVerdictCard
                  ai={mockAi}
                  theme={{ card: "#111", accent: "#d4af37", text: "#ccc" }}
                />
              </div>
            </SupernovaCard>
          </section>

          {/* Row 2 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 relative z-10">
            <SupernovaCard title="Market Intelligence Snapshot">
              <div className="space-y-2 text-sm text-white/80">
                <p>Segment: {market.segment}</p>
                <p>Avg. asking price: £{market.averagePrice}</p>
                <p>Stock volume: {market.stockVolume} vehicles</p>
                <p>Demand trend: {market.trend}</p>
              </div>
            </SupernovaCard>

            <SupernovaCard title="FlipScore AI">
              <div className="space-y-3 text-sm text-white/80">
                <p>FlipScore: {flip.score}/100</p>
                <p>Risk band: {flip.riskBand}</p>
                <p>Suggested strategy: {flip.strategy}</p>
              </div>
            </SupernovaCard>
          </section>

          {/* Row 3 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
            <SupernovaCard title="Supernova Dealer Brain">
              <div className="space-y-2 text-sm text-white/80">
                <p>Supernova score: {nova.score}/100</p>
                <p>Confidence: {nova.confidence}</p>
                <p>Insight: {nova.insight}</p>
              </div>
            </SupernovaCard>

            <SupernovaCard title="AI Recommendations">
              <ul className="list-disc list-inside text-sm text-white/80 space-y-1">
                <li>Promote vehicles with fresh MOT and low advisory count.</li>
                <li>Bundle finance offers with high FlipScore stock.</li>
                <li>Use MOT risk data to pre‑empt buyer objections.</li>
                <li>Feed sold data back into Supernova for sharper pricing.</li>
              </ul>
            </SupernovaCard>
          </section>
        </main>

        {/* FOOTER */}
        <DashboardFooter />

      </div>
    </div>
  );
}
