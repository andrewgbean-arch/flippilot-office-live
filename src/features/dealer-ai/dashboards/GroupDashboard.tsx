// src/features/dealer-ai/dashboards/GroupDashboard.tsx
import React from "react";
import SupernovaCard from "../../../components/SupernovaCard";

type GroupDashboardProps = {
  brain: any;
};

export default function GroupDashboard({ brain }: GroupDashboardProps) {
  return (
    <div className="space-y-6">

      <div className="text-gold text-3xl font-bold mb-4">
        Dealer Group AI Dashboard
      </div>

      <SupernovaCard title="Operations">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.operationsBrain, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Routing Engine">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.routingEngine, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Logistics Optimizer">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.logisticsOptimizer, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Regional Intelligence">
        <pre className="text-white text-sm">
          {JSON.stringify(brain.regionalIntelligence, null, 2)}
        </pre>
      </SupernovaCard>

    </div>
  );
}
