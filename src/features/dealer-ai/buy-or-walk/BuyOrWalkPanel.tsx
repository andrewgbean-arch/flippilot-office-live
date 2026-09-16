import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { evaluateBuyOrWalk } from "./BuyOrWalkEngine";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

interface BuyOrWalkPanelProps {
  vehicle: FlipRecord;
}

export function BuyOrWalkPanel({ vehicle }: BuyOrWalkPanelProps) {
  const result = evaluateBuyOrWalk(vehicle);

  const verdictColor =
    result.verdict === "BUY"
      ? "text-green-400"
      : result.verdict === "MAYBE"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <SupernovaGlowCard>
      <SupernovaSectionDivider label="Dealer AI — Buy or Walk Away" />

      <div className="space-y-6">

        {/* ⭐ Verdict */}
        <p className={`text-4xl font-extrabold ${verdictColor}`}>
          {result.verdict}
        </p>

        {/* ⭐ Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

          <div>
            <p className="text-white/60 text-sm">Recommended Buy Price</p>
            <p className="text-white font-bold text-xl">
              £{result.recommendedBuyPrice.toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Profit Potential</p>
            <p className="text-white font-bold text-xl">
              {result.profitPotential}%
            </p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Risk Score</p>
            <p className="text-white font-bold text-xl">
              {result.riskScore}/100
            </p>
          </div>

          <div>
            <p className="text-white/60 text-sm">AI Confidence</p>
            <p className="text-white font-bold text-xl">
              {result.confidence}%
            </p>
          </div>
        </div>

        {/* Demand Score / Market Range / MOT Failures & Advisories used
            to repeat here too — all now shown once, properly: pricing
            (eBay/Google guide prices) sits in its own section right
            above this panel in VehicleOverview.tsx, demand gets a full
            breakdown in Market Intelligence below, and MOT facts have
            their own dedicated tab. Keeping this panel focused on what
            it's actually for — the verdict and why. */}

        {/* ⭐ Notes */}
        <div>
          <p className="text-white/60 mb-1">AI Notes:</p>
          <ul className="list-disc list-inside text-white/80">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </SupernovaGlowCard>
  );
}
