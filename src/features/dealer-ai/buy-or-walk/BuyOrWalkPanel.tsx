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

        {/* ⭐ Market Signals */}
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <p className="text-white/60 text-sm mb-2">Market Signals</p>

          <p className="text-white/80">
            Demand Score:{" "}
            <span className="text-white font-bold">
              {vehicle.market?.demandScore ?? "—"}
            </span>
          </p>

          <p className="text-white/80">
            Market Range:{" "}
            <span className="text-white font-bold">
              £{vehicle.market?.lowest ?? "—"} – £{vehicle.market?.highest ?? "—"}
            </span>
          </p>
        </div>

        {/* ⭐ MOT Risk */}
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <p className="text-white/60 text-sm mb-2">MOT Risk Summary</p>

          <p className="text-white/80">
            Failures:{" "}
            <span className="text-white font-bold">
              {vehicle.mot?.failures?.length ?? 0}
            </span>
          </p>

          <p className="text-white/80">
            Advisories:{" "}
            <span className="text-white font-bold">
              {vehicle.mot?.advisories?.length ?? 0}
            </span>
          </p>

          <p className="text-white/80">
            Mileage:{" "}
            <span className="text-white font-bold">
              {vehicle.mileage ?? vehicle.mot?.mileage ?? "—"}
            </span>
          </p>
        </div>

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
