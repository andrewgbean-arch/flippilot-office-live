// src/features/dealer-ai/dashboards/OEMDashboard.tsx
import React from "react";
import SupernovaCard from "../../../components/SupernovaCard";

type OEMDashboardProps = {
  brain: any;
};

export default function OEMDashboard({ brain }: OEMDashboardProps) {
  return (
    <div className="space-y-6">

      <div className="text-gold text-3xl font-bold mb-4">
        OEM Ecosystem AI Dashboard
      </div>

      <SupernovaCard title="OEM Intelligence">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.oemIntel, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Supply Chain">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.supplyChain, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Market Model">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.marketModel, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Strategy Engine">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.strategyEngine, null, 2)}
        </pre>
      </SupernovaCard>

    </div>
  );
}
