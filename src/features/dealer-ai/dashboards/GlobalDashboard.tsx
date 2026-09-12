// src/features/dealer-ai/dashboards/GlobalDashboard.tsx
import React from "react";
import SupernovaCard from "../../../components/SupernovaCard";

type GlobalDashboardProps = {
  brain: any;
};

export default function GlobalDashboard({ brain }: GlobalDashboardProps) {
  return (
    <div className="space-y-6">

      <div className="text-gold text-3xl font-bold mb-4">
        Global Automotive AI Dashboard
      </div>

      <SupernovaCard title="Global Intelligence">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.globalIntel, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Supply Chain">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.supplyChain, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Global Stress">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.globalStress, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Stock Strategy">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.stockStrategy, null, 2)}
        </pre>
      </SupernovaCard>

    </div>
  );
}
