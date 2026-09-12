import React from "react";
import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";

export default function RiskAnalysis() {
  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-10 animate-fadeIn">

      <SupernovaHeroHeader
        title="Risk Intelligence Engine"
        subtitle="AI‑powered risk scoring for stock decisions, valuations, and buying strategy."
      />

      <SupernovaSectionDivider label="Top Risk Indicators" />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-10">

        <SupernovaGlowCard>
          <h2 className="text-yellow-400 font-bold text-xl mb-3">Market Volatility</h2>
          <p className="text-white/70">Low</p>
          <p className="text-white/50">Stable conditions</p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <h2 className="text-red-400 font-bold text-xl mb-3">Stock Risk Score</h2>
          <p className="text-white/70">32</p>
          <p className="text-white/50">Lower = safer</p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Buying Confidence</h2>
          <p className="text-white/70">High</p>
          <p className="text-white/50">AI recommendation</p>
        </SupernovaGlowCard>

      </section>

      <SupernovaSectionDivider label="Key Risk Factors" />

      <SupernovaGlowCard>
        <h2 className="text-blue-400 font-bold text-xl mb-3">Risk Factors</h2>
        <ul className="space-y-3 text-white/70">
          <li>• Seasonal demand fluctuations</li>
          <li>• Regional pricing pressure</li>
          <li>• Auction volatility</li>
          <li>• Model‑specific depreciation curves</li>
        </ul>
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="AI Insights" />

      <SupernovaGlowCard>
        <h2 className="text-yellow-300 font-bold text-xl mb-3">AI Insights</h2>
        <p className="text-white/70">
          Your risk engine will soon include live depreciation forecasts, buying risk alerts,
          and automated stock recommendations powered by FlipPilot AI.
        </p>
      </SupernovaGlowCard>

    </div>
  );
}
