import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { evaluateMaintenance } from "./PredictiveMaintenanceEngine";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

interface PredictiveMaintenancePanelProps {
  vehicle: FlipRecord;
}

export function PredictiveMaintenancePanel({ vehicle }: PredictiveMaintenancePanelProps) {
  const pm = evaluateMaintenance(vehicle);

  const riskColor =
    pm.riskLevel === "LOW"
      ? "text-green-400"
      : pm.riskLevel === "MEDIUM"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <SupernovaGlowCard>
      <SupernovaSectionDivider label="Predictive Maintenance" />

      <div className="space-y-6">

        {/* ⭐ Risk Level */}
        <p className={`text-4xl font-extrabold ${riskColor}`}>
          {pm.riskLevel} RISK
        </p>

        {/* ⭐ Cost Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {Object.entries(pm.estimatedCosts).map(([key, value]) => (
            <div key={key}>
              <p className="text-white/60 text-sm">
                {key.replace(/([A-Z])/g, " $1").toUpperCase()}
              </p>
              <p className="text-white font-bold text-xl">£{value}</p>
            </div>
          ))}
        </div>

        {/* ⭐ Upcoming Issues */}
        <div>
          <p className="text-white/60 mb-1">Predicted Issues:</p>
          <ul className="list-disc list-inside text-white/80">
            {pm.upcomingIssues.length > 0 ? (
              pm.upcomingIssues.map((issue, i) => <li key={i}>{issue}</li>)
            ) : (
              <li>No major issues predicted.</li>
            )}
          </ul>
        </div>

        {/* ⭐ Confidence */}
        <p className="text-white/70">
          AI Confidence:{" "}
          <span className="text-white font-bold">{pm.confidence}%</span>
        </p>
      </div>
    </SupernovaGlowCard>
  );
}
