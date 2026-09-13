// src/features/dealer-ai/dashboards/DealerDashboard.tsx
import React from "react";
import SupernovaCard from "../../../components/SupernovaCard";

type DealerDashboardProps = {
  brain: any;
};

export default function DealerDashboard({ brain }: DealerDashboardProps) {
  // MasterBrainScreen already unwraps flipPilotMasterBrain's result down
  // to just the mode's brain payload before passing it here (same as
  // GroupDashboard/OEMDashboard/GlobalDashboard/PlanetDashboard all
  // expect) — reading `brain.brain` again was a leftover double-unwrap
  // that made this undefined and crashed on `core.health`.
  const core = brain;

  return (
    <div className="space-y-6">

      <div className="text-gold text-3xl font-bold mb-4">
        Dealer AI Dashboard
      </div>

      <SupernovaCard title="Status">
        <pre className="text-white text-sm">
          {JSON.stringify({ status: "🟢 Dealer AI Active" }, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Health Score">
        <pre className="text-white text-sm">
          {JSON.stringify(core.health, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Growth Projection">
        <pre className="text-white text-sm">
          {JSON.stringify(core.growth, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Efficiency">
        <pre className="text-white text-sm">
          {JSON.stringify(core.efficiency, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Strategy">
        <pre className="text-white text-sm">
          {JSON.stringify(core.strategy, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Pricing Engine">
        <pre className="text-white text-sm">
          {JSON.stringify(core.pricing, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Rotation Engine">
        <pre className="text-white text-sm">
          {JSON.stringify(core.rotation, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Profit Maximizer">
        <pre className="text-white text-sm">
          {JSON.stringify(core.profitMax, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Buyer Matching">
        <pre className="text-white text-sm">
          {JSON.stringify(core.buyerMatching, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="CRM Intelligence">
        <pre className="text-white text-sm">
          {JSON.stringify(core.crm, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Lifecycle Intelligence">
        <pre className="text-white text-sm">
          {JSON.stringify(core.lifecycle, null, 2)}
        </pre>
      </SupernovaCard>

      <SupernovaCard title="Acquisition Planner">
        <pre className="text-white text-sm">
          {JSON.stringify(core.acquisition, null, 2)}
        </pre>
      </SupernovaCard>

    </div>
  );
}
