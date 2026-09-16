import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

interface CosmicIdentityBlockProps {
  vehicle: FlipRecord;
}

// Deliberately just identity — make/model/year/mileage/valuation. Used
// to also show Market Demand, Flip Score, Risk Level and AI Confidence
// here, but every one of those already gets a proper, more detailed
// treatment further down this tab (Flip Score Breakdown, Buy-or-Walk's
// risk score, Market Intelligence's demand tier) — repeating a bare
// number up here added confusion, not information: a dealer seeing
// "Risk: medium" here and a different-looking "Risk Score: 10/100"
// in Buy-or-Walk below (a genuinely different, more detailed
// computation, not the same figure restated) had no way to tell those
// apart were meant to be read differently.
export function CosmicIdentityBlock({ vehicle }: CosmicIdentityBlockProps) {
  const make = vehicle.make ?? "Unknown";
  const model = vehicle.model ?? "";
  const year = vehicle.mot?.year ?? "—";
  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? "—";
  const valuation = vehicle.aiValuation?.estimatedValue ?? vehicle.valuation ?? vehicle.price ?? null;

  return (
    <SupernovaGlowCard>
      <SupernovaSectionDivider label="Vehicle Identity" />

      <div className="space-y-6">
        <p className="text-4xl font-extrabold text-white">
          {make} {model} <span className="text-white/50">({year})</span>
        </p>

        <div className="grid grid-cols-2 gap-6">
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
        </div>
      </div>
    </SupernovaGlowCard>
  );
}
