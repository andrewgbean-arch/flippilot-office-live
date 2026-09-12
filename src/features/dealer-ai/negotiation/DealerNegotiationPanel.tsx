import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { evaluateNegotiation } from "./DealerNegotiationEngine";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

interface DealerNegotiationPanelProps {
  vehicle: FlipRecord;
}

export function DealerNegotiationPanel({ vehicle }: DealerNegotiationPanelProps) {
  const plan = evaluateNegotiation(vehicle);

  const stanceColor =
    plan.stance === "FIRM"
      ? "text-green-400"
      : plan.stance === "FLEXIBLE"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <SupernovaGlowCard>
      <SupernovaSectionDivider label="Dealer AI — Negotiation Plan" />

      <div className="space-y-6">
        <p className={`text-3xl font-extrabold ${stanceColor}`}>
          {plan.stance} STANCE
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <p className="text-white/60 text-sm">Target Offer Range</p>
            <p className="text-white font-bold text-xl">
              £{plan.targetOfferMin.toLocaleString()} – £{plan.targetOfferMax.toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Walk‑Away Price</p>
            <p className="text-white font-bold text-xl">
              £{plan.walkAwayPrice.toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Buyer Leverage</p>
            <p className="text-white font-bold text-xl">
              {plan.buyerLeverage}/100
            </p>
          </div>
        </div>

        <div>
          <p className="text-white/60 mb-1">Suggested Lines:</p>
          <ul className="list-disc list-inside text-white/80">
            {plan.suggestedLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </SupernovaGlowCard>
  );
}
