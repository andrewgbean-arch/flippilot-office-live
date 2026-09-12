import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaMetricBar } from "@/components/supernova/SupernovaMetricBar";

import { useInventory } from "@/context/InventoryProvider";

export default function PhotosWorkflow() {
  const { vehicles } = useInventory();

  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Photos Workflow"
        subtitle="Review photo quality and optimise your listings."
      />

      <SupernovaSectionDivider label="Portfolio Photo Quality" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Overall Photo Quality"
            value={78}
            accent="yellow"
          />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Lighting Score"
            value={65}
            accent="blue"
          />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Background Cleanliness"
            value={82}
            accent="red"
          />
        </SupernovaGlowCard>
      </div>

      <SupernovaSectionDivider label="Vehicles Missing Photos" />

      <SupernovaGlowCard>
        <div className="space-y-4">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="p-4 bg-black/40 border border-white/10 rounded-lg"
            >
              <div className="text-white font-semibold">
                {v.make} {v.model}
              </div>

              <div className="text-white/60 text-xs">
                No photo metadata available.
              </div>
            </div>
          ))}
        </div>
      </SupernovaGlowCard>
    </div>
  );
}
