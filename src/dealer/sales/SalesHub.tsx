import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import { useLeads } from "@/context/LeadsContext";

// Only use the component we know exists and compiles
import LeadsDashboard from "@/dealer/leads/LeadsDashboard";

export default function SalesHub() {
  const { leads } = useLeads();
  const selected = leads[0];

  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Sales Hub"
        subtitle="Manage leads and review sales activity."
      />

      <SupernovaSectionDivider label="Lead Overview" />

      <SupernovaGlowCard>
        <LeadsDashboard />
      </SupernovaGlowCard>

      {selected && (
        <>
          <SupernovaSectionDivider label="Selected Lead Summary" />

          <SupernovaGlowCard>
            <div className="space-y-2">
              <div className="text-white font-semibold text-lg">
                {/* Use only fields that are safe / already in the Lead type */}
                {selected.name ?? "Unnamed Lead"}
              </div>

              <div className="text-white/70 text-sm">
                Status: {selected.status ?? "Unknown"}
              </div>
            </div>
          </SupernovaGlowCard>
        </>
      )}
    </div>
  );
}
