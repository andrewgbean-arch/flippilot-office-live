import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import { useInventory } from "@/context/InventoryProvider";

// Correct component
import MOTExpiryCountdownCard from "@/components/motors/MOTExpiryCountdownCard";

import MOTInsightsPanel from "@/components/motors/MOTInsightsPanel";
import RiskAnalysis from "@/dealer/risk/RiskAnalysis";

export default function RiskHub() {
  const { vehicles } = useInventory();

  // Pick the first vehicle with MOT data
  const firstVehicle = vehicles.find((v) => v.mot?.expiry);

  // Calculate days left
  const daysLeft = firstVehicle
    ? Math.ceil(
        (new Date(firstVehicle.mot.expiry).getTime() - Date.now()) / 86400000
      )
    : null;

  // Simple theme object for the countdown card
  const theme = {
    card: "rgba(10,17,40,0.65)",
    goldDeep: "#B8860B",
  };

  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Risk Hub"
        subtitle="Monitor MOT risk and dealership risk signals."
      />

      <SupernovaSectionDivider label="MOT Risk Overview" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SupernovaGlowCard>
          <MOTExpiryCountdownCard daysLeft={daysLeft} theme={theme} />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <MOTInsightsPanel />
        </SupernovaGlowCard>
      </div>

      <SupernovaSectionDivider label="Dealership Risk Analysis" />

      <SupernovaGlowCard>
        <RiskAnalysis />
      </SupernovaGlowCard>
    </div>
  );
}
