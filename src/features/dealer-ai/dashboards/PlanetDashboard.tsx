import React from "react";
import { SupernovaGlowCard, SupernovaSectionDivider } from "../../../components/supernova";
import SupernovaFrame from "../../../components/SupernovaFrame";
import GoldParticles from "../../../components/ui/GoldParticles.web";

import * as theme from "../../../styles/theme";   // ⭐ FIXED

type PlanetDashboardProps = {
  brain: any;
  theme?: any;

};

export default function PlanetDashboard({ brain }: PlanetDashboardProps) {
  return (
    <SupernovaFrame>
      <div className="relative">

        <div className="absolute inset-0 opacity-20 pointer-events-none">
         <GoldParticles />

        </div>

        <div className="relative z-10 space-y-6">

          <div className="text-gold text-3xl font-bold mb-4">
            Planetary Automotive AI Dashboard
          </div>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Simulation" />
            <pre className="text-white text-sm">
              {JSON.stringify(brain.simulation?.[0], null, 2)}
            </pre>
          </SupernovaGlowCard>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Demand Forecast" />
            <pre className="text-white text-sm">
              {JSON.stringify(brain.demandForecast?.[0], null, 2)}
            </pre>
          </SupernovaGlowCard>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="EV Shift" />
            <pre className="text-white text-sm">
              {JSON.stringify(brain.evShift?.[0], null, 2)}
            </pre>
          </SupernovaGlowCard>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Balancing" />
            <pre className="text-white text-sm">
              {JSON.stringify(brain.balancing?.[0], null, 2)}
            </pre>
          </SupernovaGlowCard>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Foresight Status" />
            <pre className="text-white text-sm">
              {JSON.stringify(brain.foresightBrain?.foresightStatus, null, 2)}
            </pre>
          </SupernovaGlowCard>

        </div>
      </div>
    </SupernovaFrame>
  );
}
