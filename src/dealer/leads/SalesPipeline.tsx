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

  // SupernovaMetricBar is a percentage widget (renders "{value}%" and
  // sizes its bar to value% wide) — passing it a raw lead COUNT showed
  // nonsense like "3%" for 3 new leads out of, say, 5 total, with a
  // near-invisible bar, and would overflow the bar entirely for any
  // stage with more than 100 leads. Converted to each stage's real
  // share of total leads, same treatment the Conversion Rate card
  // below already correctly used — the raw count stays visible in each
  // card's own description text so the actual number isn't lost.
  const pipelinePct = (count: number) =>
    leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;

  return (
    <div className="animate-fadeIn p-10 text-white relative z-10">

      {/* Header */}
      <SupernovaHeroHeader
        title="Sales Pipeline"
        subtitle="Where every lead is in your sales process, counted from your own records."
      />

      <SupernovaSectionDivider label="Pipeline Overview" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* New Leads */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-yellow-400 mb-2">New Leads</h2>
          <SupernovaMetricBar
            label="New Leads"
            value={pipelinePct(pipeline.new)}
            accent="yellow"
          />
          <p className="text-white/60 text-sm">
            {pipeline.new} lead{pipeline.new === 1 ? "" : "s"} marked New, not yet contacted.
          </p>
        </SupernovaGlowCard>

        {/* Contacted */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-blue-400 mb-2">Contacted</h2>
          <SupernovaMetricBar
            label="Contacted"
            value={pipelinePct(pipeline.contacted)}
            accent="blue"
          />
          <p className="text-white/60 text-sm">
            {pipeline.contacted} lead{pipeline.contacted === 1 ? "" : "s"} that {pipeline.contacted === 1 ? "has" : "have"} received initial communication.
          </p>
        </SupernovaGlowCard>

        {/* Hot Leads */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-red-400 mb-2">Hot Leads</h2>
          <SupernovaMetricBar
            label="Hot Leads"
            value={pipelinePct(pipeline.hot)}
            accent="red"
          />
          <p className="text-white/60 text-sm">
            {pipeline.hot} lead{pipeline.hot === 1 ? "" : "s"} marked Negotiating.
          </p>
        </SupernovaGlowCard>

        {/* Viewing Booked */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-yellow-400 mb-2">Viewing Booked</h2>
          <SupernovaMetricBar
            label="Viewing Booked"
            value={pipelinePct(pipeline.viewing)}
            accent="yellow"
          />
          <p className="text-white/60 text-sm">
            {pipeline.viewing} lead{pipeline.viewing === 1 ? "" : "s"} with scheduled vehicle viewings.
          </p>
        </SupernovaGlowCard>

        {/* Sold */}
        <SupernovaGlowCard>
          <h2 className="text-xl font-bold text-green-400 mb-2">Sold</h2>
          <SupernovaMetricBar
            label="Sold Vehicles"
            value={pipelinePct(pipeline.sold)}
            accent="yellow"
          />
          <p className="text-white/60 text-sm">
            {pipeline.sold} completed deal{pipeline.sold === 1 ? "" : "s"} from this pipeline.
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

        {/* This used to say "AI analysis suggests…": it was fixed text, not
            anything worked out from the leads. The rate above is the real part. */}
        <p className="text-white/70 mt-3">
          The share of your leads marked sold. Ask Wendy which leads to chase first.
        </p>
      </SupernovaGlowCard>

    </div>
  );
}
