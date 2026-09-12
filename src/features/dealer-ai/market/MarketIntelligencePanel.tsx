import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { evaluateMarketIntel } from "./MarketIntelligenceEngine";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

interface MarketIntelligencePanelProps {
  vehicle: FlipRecord;
}

export function MarketIntelligencePanel({ vehicle }: MarketIntelligencePanelProps) {
  const intel = evaluateMarketIntel(vehicle);

  const tierColor =
    intel.demandTier === "HOT"
      ? "text-green-400"
      : intel.demandTier === "WARM"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <SupernovaGlowCard>
      <SupernovaSectionDivider label="Market Intelligence" />

      <div className="space-y-6">

        {/* ⭐ Demand Tier */}
        <p className={`text-4xl font-extrabold ${tierColor}`}>
          {intel.demandTier} MARKET
        </p>

        {/* ⭐ Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">

          <div>
            <p className="text-white/60 text-sm">Price Pressure</p>
            <p className="text-white font-bold text-xl">{intel.pricePressure}/100</p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Market Saturation</p>
            <p className="text-white font-bold text-xl">{intel.saturation}/100</p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Competitors</p>
            <p className="text-white font-bold text-xl">{intel.competitorCount}</p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Recommended List Price</p>
            <p className="text-white font-bold text-xl">
              £{intel.recommendedListPrice.toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Time to Sell</p>
            <p className="text-white font-bold text-xl">
              {intel.timeToSellDays} days
            </p>
          </div>
        </div>

        {/* ⭐ Notes */}
        <div>
          <p className="text-white/60 mb-1">AI Notes:</p>
          <ul className="list-disc list-inside text-white/80">
            {intel.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </SupernovaGlowCard>
  );
}
