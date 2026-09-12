import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { evaluateFlipScore } from "./FlipScoreEngine";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

interface FlipScorePanelProps {
  vehicle: FlipRecord;
}

export function FlipScorePanel({ vehicle }: FlipScorePanelProps) {
  const score = evaluateFlipScore(vehicle);

  const tierColor =
    score.tier === "Excellent"
      ? "text-green-400"
      : score.tier === "Good"
      ? "text-blue-400"
      : score.tier === "Average"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <SupernovaGlowCard>
      <SupernovaSectionDivider label="Flip Score Breakdown" />

      <div className="space-y-6">

        {/* ⭐ Final Score */}
        <p className={`text-4xl font-extrabold ${tierColor}`}>
          {score.finalScore}/100 — {score.tier}
        </p>

        {/* ⭐ Score Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">

          <div>
            <p className="text-white/60 text-sm">Condition Score</p>
            <p className="text-white font-bold text-xl">{score.conditionScore}</p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Market Score</p>
            <p className="text-white font-bold text-xl">{score.marketScore}</p>
          </div>

          <div>
            <p className="text-white/60 text-sm">MOT Risk</p>
            <p className="text-white font-bold text-xl">{score.motRisk}</p>
          </div>

          <div>
            <p className="text-white/60 text-sm">Mileage Risk</p>
            <p className="text-white font-bold text-xl">{score.mileageRisk}</p>
          </div>

          <div>
            <p className="text-white/60 text-sm">AI Confidence</p>
            <p className="text-white font-bold text-xl">{score.aiConfidence}%</p>
          </div>
        </div>

        {/* ⭐ Notes */}
        <div>
          <p className="text-white/60 mb-1">AI Notes:</p>
          <ul className="list-disc list-inside text-white/80">
            {score.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </SupernovaGlowCard>
  );
}
