import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import MotAiRiskGauge from "@/components/motors/MotAiRiskGauge";

interface CosmicIdentityBlockProps {
  vehicle: FlipRecord;
}

export function CosmicIdentityBlock({ vehicle }: CosmicIdentityBlockProps) {
  const make = vehicle.make ?? "Unknown";
  const model = vehicle.model ?? "";
  const year = vehicle.mot?.year ?? "—";
  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? "—";

  const flipScore = vehicle.flipScore ?? vehicle.ai?.conditionScore ?? 50;
  const demand = vehicle.market?.demandScore ?? 50;
  const valuation = vehicle.aiValuation?.estimatedValue ?? vehicle.valuation ?? vehicle.price ?? null;

  return (
    <SupernovaGlowCard>
      <SupernovaSectionDivider label="Vehicle Identity" />

      <div className="space-y-6">

        {/* ⭐ Title */}
        <p className="text-4xl font-extrabold text-white">
          {make} {model} <span className="text-white/50">({year})</span>
        </p>

  {/* ⭐ Quick Stats */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-6">

  <div>
    <p className="text-white/60 text-sm">Mileage</p>
    <p className="text-white font-bold text-xl">
      {mileage ? `${mileage.toLocaleString()} mi` : "—"}
    </p>
  </div>

  <div>
    <p className="text-white/60 text-sm">AI Valuation</p>
    <p className="text-white font-bold text-xl">
      {valuation ? `£${valuation.toLocaleString()}` : "—"}
    </p>
  </div>

  <div>
    <p className="text-white/60 text-sm">Market Demand</p>
    <p className="text-white font-bold text-xl">{demand}/100</p>
  </div>

  <div>
    <p className="text-white/60 text-sm">Flip Score</p>
    <p className="text-white font-bold text-xl">{flipScore}/100</p>
  </div>
</div>

{/* ⭐ Risk Gauge */}
<div className="pt-4">
  <p className="text-white/60 text-sm">Risk Level</p>
  <p className="text-white font-bold text-xl">
    {vehicle.aiPrice?.riskLevel ?? "medium"}
  </p>
</div>

{/* ⭐ AI Confidence */}
<div className="pt-2">
  <p className="text-white/60 text-sm">AI Confidence</p>
  <p className="text-white font-bold text-xl">
    {vehicle.aiValuation?.confidence ?? 50}%
  </p>
</div>



      </div>
    </SupernovaGlowCard>
  );
}
