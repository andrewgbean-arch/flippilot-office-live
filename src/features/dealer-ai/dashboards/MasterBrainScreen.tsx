import React, { useState } from "react";

import BrainModeSwitcher from "../dashboards/BrainModeSwitcher";

import SuperBrainEngine from "../../../core/superbrain/SuperBrainEngine";
import type { FlipPilotMode } from "../../../core/superbrain/SuperBrainEngine";

import DealerDashboard from "./DealerAIDashboard";
import GroupDashboard from "../dashboards/GroupDashboard";
import OEMDashboard from "../dashboards/OEMDashboard";
import GlobalDashboard from "../dashboards/GlobalDashboard";
import PlanetDashboard from "../dashboards/PlanetDashboard";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaMetricBar } from "@/components/supernova/SupernovaMetricBar";

type MasterBrainScreenProps = {
  data: any;
};

export default function MasterBrainScreen({ data }: MasterBrainScreenProps) {
  const [mode, setMode] = useState<FlipPilotMode>("dealer");

  // MasterBrain output (fusion added in engine, but TS doesn’t know → use any)
  const brain = SuperBrainEngine.flipPilotMasterBrain(mode, data) as any;

  const fusion = brain.fusion ?? {
    masterBand: "Unknown",
    recommendation: "Fusion summary unavailable",
    combinedRisk: 0,
    combinedStress: 0,
    combinedDemand: 0,
    combinedProfit: 0,
    combinedGovernance: 0,
    combinedNetwork: 0,
    combinedSupplyChain: 0,
    combinedGlobalIntelligence: 0,
  };

  return (
    <div className="px-10 py-12 bg-flipBlue min-h-screen text-white space-y-12">

      {/* Cosmic Header */}
      <SupernovaHeroHeader
        title="FlipPilot Master Brain"
        subtitle="Fusion Intelligence — Dealer, Group, OEM, Global, Planetary"
      />

      {/* Fusion Summary */}
      <SupernovaGlowCard>
        <SupernovaSectionDivider label="Fusion Summary" />

        <div className="mt-6 space-y-6">

          {/* MasterBand */}
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">
              {fusion.masterBand}
            </div>
            <div className="opacity-80">
              {fusion.recommendation}
            </div>
          </div>

          {/* Fusion Metrics */}
          <SupernovaMetricBar
            label="Combined Risk"
            value={fusion.combinedRisk}
            color="red"
          />

          <SupernovaMetricBar
            label="Combined Stress"
            value={fusion.combinedStress}
            color="orange"
          />

          <SupernovaMetricBar
            label="Demand Forecast"
            value={fusion.combinedDemand}
            color="yellow"
          />

          <SupernovaMetricBar
            label="Profitability"
            value={fusion.combinedProfit}
            color="green"
          />

          <SupernovaMetricBar
            label="Governance Load"
            value={fusion.combinedGovernance}
            color="purple"
          />

          <SupernovaMetricBar
            label="Network Strength"
            value={fusion.combinedNetwork}
            color="blue"
          />

          <SupernovaMetricBar
            label="Supply Chain Stress"
            value={fusion.combinedSupplyChain}
            color="pink"
          />

          <SupernovaMetricBar
            label="Global Intelligence"
            value={fusion.combinedGlobalIntelligence}
            color="cyan"
          />

        </div>
      </SupernovaGlowCard>

      {/* Mode Switcher */}
     <SupernovaGlowCard>
  <SupernovaSectionDivider label="Brain Mode Selector" />
  <div className="mt-4">
    <BrainModeSwitcher mode={mode} onChange={setMode} />
  </div>
</SupernovaGlowCard>



      {/* Active Dashboard */}
      <SupernovaSectionDivider label="Active Mode Dashboard" />

      {mode === "dealer" && <DealerDashboard brain={brain.brain} />}
      {mode === "group" && <GroupDashboard brain={brain.brain} />}
      {mode === "oem" && <OEMDashboard brain={brain.brain} />}
      {mode === "global" && <GlobalDashboard brain={brain.brain} />}
      {mode === "planet" && <PlanetDashboard brain={brain.brain} />}
    </div>
  );
}
