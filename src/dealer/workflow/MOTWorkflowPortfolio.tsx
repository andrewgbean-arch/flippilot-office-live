import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import MOTExpiryCountdownCard from "@/components/motors/MOTExpiryCountdownCard";

import MOTHealthScore from "@/components/motors/MOTHealthScore";
import MOTInsightsPanel from "@/components/motors/MOTInsightsPanel";

import { useInventory } from "@/context/InventoryProvider";

export default function MOTWorkflowPortfolio() {
  const { vehicles } = useInventory();

  const motRiskVehicles = vehicles.filter((v) => {
    const expiry = v.mot?.expiry;
    if (!expiry) return false;

    const days = Math.ceil(
      (new Date(expiry).getTime() - Date.now()) / 86400000
    );

    return days <= 30;
  });

  const selected = motRiskVehicles[0];

  // ⭐ Calculate days left for the countdown card
  const daysLeft = selected
    ? Math.ceil(
        (new Date(selected.mot.expiry).getTime() - Date.now()) / 86400000
      )
    : null;

  // ⭐ Simple theme object for the countdown card
  const theme = {
    card: "rgba(10,17,40,0.65)",
    goldDeep: "#B8860B",
  };

  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="MOT Workflow"
        subtitle="Track MOT expiries and MOT risk across your stock."
      />

      <SupernovaSectionDivider label="Portfolio MOT Health" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SupernovaGlowCard>
          <MOTExpiryCountdownCard daysLeft={daysLeft} theme={theme} />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <MOTHealthScore mot={selected?.mot} />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          {selected ? (
            <MOTInsightsPanel mot={selected.mot} />
          ) : (
            <p className="text-white/60">No at-risk vehicle selected.</p>
          )}
        </SupernovaGlowCard>
      </div>

      <SupernovaSectionDivider label="Vehicles Needing MOT Attention" />

      <SupernovaGlowCard>
        {motRiskVehicles.length === 0 ? (
          <p className="text-white/60">
            All vehicles are currently outside the MOT risk window.
          </p>
        ) : (
          <div className="space-y-4">
            {motRiskVehicles.map((v) => (
              <div
                key={v.id}
                className="p-4 bg-black/40 border border-white/10 rounded-lg"
              >
                <div className="text-white font-semibold">
                  {v.make} {v.model}
                </div>

                <div className="text-white/60 text-xs">
                  MOT Expiry: {v.mot?.expiry ?? "Unknown"}
                </div>
              </div>
            ))}
          </div>
        )}
      </SupernovaGlowCard>
    </div>
  );
}
