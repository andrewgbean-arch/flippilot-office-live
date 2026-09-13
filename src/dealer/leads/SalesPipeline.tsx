import React from "react";
import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";
import { SupernovaMetricBar } from "../../components/supernova/SupernovaMetricBar";
import { useLeads } from "@/context/LeadsContext";

export default function SalesPipeline() {
  const { leads } = useLeads();

  // Was a hardcoded { new: 42, contacted: 31, ... } object that never
  // reflected real leads, sitting right next to a fully real
  // LeadsDashboard/LeadDetails. "Hot" maps to "negotiating" — the real
  // LeadStatus closest to the original "high-intent" framing (Lead.score
  // exists on the type but is never actually set anywhere, so it's not
  // a usable signal).
  const pipeline = {
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    hot: leads.filter((l) => l.status === "negotiating").length,
    viewing: leads.filter((l) => l.status === "viewing_booked").length,
    sold: leads.filter((l) => l.status === "won").length,
  };

  const conversionRate =
    leads.length > 0 ? Math.round((pipeline.sold / leads.length) * 100) : 0;

  return (
    <div className="animate-fadeIn p-10 text-white relative z-10">

      {/* Header */}
      <SupernovaHeroHeader
        title="Sales Pipeline"
        subtitle="AI‑enhanced overview of your dealership’s lead progression."
      />

      <SupernovaSectionDivider label="Pipeline Overview" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* New Leads */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-yellow-400 mb-2">New Leads</h2>
          <SupernovaMetricBar
            label="New Leads"
            value={pipeline.new}
            accent="yellow"
          />
          <p className="text-white/60 text-sm">
            Fresh leads entering your pipeline today.
          </p>
        </SupernovaGlowCard>

        {/* Contacted */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-blue-400 mb-2">Contacted</h2>
          <SupernovaMetricBar
            label="Contacted"
            value={pipeline.contacted}
            accent="blue"
          />
          <p className="text-white/60 text-sm">
            Leads that have received initial communication.
          </p>
        </SupernovaGlowCard>

        {/* Hot Leads */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-red-400 mb-2">Hot Leads</h2>
          <SupernovaMetricBar
            label="Hot Leads"
            value={pipeline.hot}
            accent="red"
          />
          <p className="text-white/60 text-sm">
            High‑intent leads showing strong buying signals.
          </p>
        </SupernovaGlowCard>

        {/* Viewing Booked */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-yellow-400 mb-2">Viewing Booked</h2>
          <SupernovaMetricBar
            label="Viewing Booked"
            value={pipeline.viewing}
            accent="yellow"
          />
          <p className="text-white/60 text-sm">
            Leads with scheduled vehicle viewings.
          </p>
        </SupernovaGlowCard>

        {/* Sold */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-green-400 mb-2">Sold</h2>
          <SupernovaMetricBar
            label="Sold Vehicles"
            value={pipeline.sold}
            accent="yellow"
          />
          <p className="text-white/60 text-sm">
            Completed deals from this pipeline.
          </p>
        </SupernovaGlowCard>

      </div>

      <SupernovaSectionDivider label="Conversion Insights" />

      <SupernovaGlowCard>
        <h2 className="text-xl font-bold text-yellow-400 mb-4">
          Pipeline Conversion Rate
        </h2>

        <SupernovaMetricBar
          label="Conversion Rate"
          value={conversionRate}
          accent={conversionRate >= 40 ? "yellow" : conversionRate >= 20 ? "blue" : "red"}
        />

        <p className="text-white/70 mt-3">
          AI analysis suggests focusing on hot leads and viewing follow‑ups to increase conversions.
        </p>
      </SupernovaGlowCard>

    </div>
  );
}
