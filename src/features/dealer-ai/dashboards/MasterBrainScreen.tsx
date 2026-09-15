import React, { useState } from "react";

import BrainModeSwitcher from "../dashboards/BrainModeSwitcher";

import SuperBrainEngine from "../../../core/superbrain/SuperBrainEngine";
import type { FlipPilotMode } from "../../../core/superbrain/SuperBrainEngine";

import DealerDashboard from "./DealerAIDashboard";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

type MasterBrainScreenProps = {
  data: any;
};

// Group/OEM/Global/Planet all exist as real engine functions
// (getEnterpriseDealerGroupAISuite etc.) but every one of them needs
// data this app has no source for yet — multi-location network data,
// OEM/economics figures, world region data — since every dealership
// account here is a single, fully isolated location. MasterBrainRoute
// only ever supplies {vehicles, leads}, so calling those functions
// produced broken output: Group's dashboard read the wrong keys
// entirely (silently blank), OEM's math ran on undefined and rendered
// NaN, and Planet crashed outright (regions.map() on undefined). A
// "Fusion Summary" card also always showed "Unknown" — the engine
// never actually returns the `fusion` key it expected. Rather than
// leave broken/crashing cards live on a routed, sidebar-linked
// screen, only Dealer mode (the one with a real data source) actually
// calls the engine; the other four modes show an honest "not
// available yet" message instead.
const ENTERPRISE_MODE_LABELS: Record<Exclude<FlipPilotMode, "dealer">, string> = {
  group: "Dealer Group",
  oem: "OEM Ecosystem",
  global: "Global Market",
  planet: "Planetary",
};

export default function MasterBrainScreen({ data }: MasterBrainScreenProps) {
  const [mode, setMode] = useState<FlipPilotMode>("dealer");

  return (
    <div className="px-10 py-12 bg-flipBlue min-h-screen text-white space-y-12">

      {/* Cosmic Header */}
      <SupernovaHeroHeader
        title="FlipPilot Master Brain"
        subtitle="Real-time AI intelligence for your dealership"
      />

      {/* Mode Switcher */}
      <SupernovaGlowCard>
        <SupernovaSectionDivider label="Brain Mode Selector" />
        <div className="mt-4">
          <BrainModeSwitcher mode={mode} onChange={setMode} />
        </div>
      </SupernovaGlowCard>

      {/* Active Dashboard */}
      <SupernovaSectionDivider label="Active Mode Dashboard" />

      {mode === "dealer" ? (
        <DealerDashboard brain={SuperBrainEngine.flipPilotMasterBrain("dealer", data).brain} />
      ) : (
        <SupernovaGlowCard>
          <p className="text-white/70">
            {ENTERPRISE_MODE_LABELS[mode]} intelligence needs data from multiple dealership
            locations — not available yet on a single-location account.
          </p>
        </SupernovaGlowCard>
      )}
    </div>
  );
}
