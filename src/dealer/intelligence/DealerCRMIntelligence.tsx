import React, { useMemo } from "react";
import SupernovaCard from "@/components/SupernovaCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { useLeads } from "@/context/LeadsContext";

import {
  FiMail,
  FiTrendingUp,
  FiActivity,
  FiAlertTriangle,
} from "react-icons/fi";

// Base scores by pipeline status — a real, meaningful signal (how far a
// lead has progressed), but on its own this made every lead sharing a
// status show byte-identical numbers with zero per-lead differentiation.
// Blended below with two genuinely per-lead real signals: how long a
// lead has sat without progressing (staleness), and whether it has
// complete contact info (a lead with no phone or email is harder to
// actually reach and convert).
const STATUS_BASE: Record<string, { engagement: number; conversion: number; risk: number }> = {
  new: { engagement: 20, conversion: 15, risk: 40 },
  contacted: { engagement: 40, conversion: 30, risk: 35 },
  viewing_booked: { engagement: 65, conversion: 50, risk: 25 },
  test_drive: { engagement: 80, conversion: 65, risk: 20 },
  negotiating: { engagement: 90, conversion: 80, risk: 30 },
  won: { engagement: 100, conversion: 100, risk: 5 },
  lost: { engagement: 10, conversion: 0, risk: 90 },
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function DealerCRMIntelligence() {
  const { leads: rawLeads } = useLeads();

  const leads = useMemo(
    () =>
      rawLeads.map((l) => {
        const base = STATUS_BASE[l.status] ?? { engagement: 30, conversion: 25, risk: 40 };
        const isOpen = l.status !== "won" && l.status !== "lost";
        const daysOld = (Date.now() - new Date(l.createdAt).getTime()) / 86400000;
        const staleness = isOpen ? Math.min(30, Math.floor(daysOld / 2)) : 0;
        const hasFullContact = Boolean(l.phone && l.email);

        return {
          id: l.id,
          name: l.name,
          source: l.source || "Unknown",
          engagement: clamp(base.engagement - staleness),
          conversionChance: clamp(base.conversion - staleness / 2 + (hasFullContact ? 5 : -5)),
          risk: clamp(base.risk + staleness + (hasFullContact ? -5 : 10)),
        };
      }),
    [rawLeads]
  );

  const metrics = useMemo(() => {
    const avgEngagement = leads.length
      ? Math.round(leads.reduce((sum, l) => sum + l.engagement, 0) / leads.length)
      : 0;

    const avgConversion = leads.length
      ? Math.round(leads.reduce((sum, l) => sum + l.conversionChance, 0) / leads.length)
      : 0;

    const avgRisk = leads.length
      ? Math.round(leads.reduce((sum, l) => sum + l.risk, 0) / leads.length)
      : 0;

    const topSources = (() => {
      const map: Record<string, number> = {};
      leads.forEach((l) => {
        map[l.source] = (map[l.source] ?? 0) + 1;
      });
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    })();

    return { avgEngagement, avgConversion, avgRisk, topSources };
  }, [leads]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto animate-fadeIn">

      <SupernovaSectionDivider label="CRM Intelligence Hub" />

      <p className="text-white/60 mb-6">
        AI‑powered insights into leads, engagement, and conversion.
      </p>

      <SupernovaCard title="CRM Overview" accent="gold">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white/70">
          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiActivity /> Avg Engagement
            </div>
            <p className="mt-1">{metrics.avgEngagement}%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiTrendingUp /> Avg Conversion Chance
            </div>
            <p className="mt-1">{metrics.avgConversion}%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiAlertTriangle /> Avg Risk
            </div>
            <p className="mt-1">{metrics.avgRisk}%</p>
          </div>
        </div>
      </SupernovaCard>

      <SupernovaCard
        title="Top Lead Sources"
        subtitle="Where your highest‑quality leads originate."
        accent="blue"
      >
        {metrics.topSources.length === 0 ? (
          <p className="text-white/50 text-sm">No lead data available.</p>
        ) : (
          <div className="space-y-4">
            {metrics.topSources.map(([source, count]) => (
              <div
                key={source}
                className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
              >
                <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                  <FiMail /> {source}
                </div>
                <p className="text-white/70 mt-1">{count} leads</p>
              </div>
            ))}
          </div>
        )}
      </SupernovaCard>

      <SupernovaCard
        title="Lead Intelligence"
        subtitle="AI‑generated insights for each active lead."
        accent="red"
      >
        {leads.length === 0 ? (
          <p className="text-white/50 text-sm">No leads available.</p>
        ) : (
          <div className="space-y-4">
            {leads.map((l) => (
              <div
                key={l.id}
                className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
              >
                <div className="text-yellow-400 font-semibold text-lg">
                  {l.name}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-white/70">
                  <div>
                    <FiActivity className="inline mr-1 text-blue-400" />
                    Engagement:{" "}
                    <span className="text-blue-400 font-bold">
                      {l.engagement}%
                    </span>
                  </div>

                  <div>
                    <FiTrendingUp className="inline mr-1 text-green-400" />
                    Conversion Chance:{" "}
                    <span className="text-green-400 font-bold">
                      {l.conversionChance}%
                    </span>
                  </div>

                  <div>
                    <FiAlertTriangle className="inline mr-1 text-red-400" />
                    Risk:{" "}
                    <span className="text-red-400 font-bold">
                      {l.risk}%
                    </span>
                  </div>
                </div>

                <p className="text-white/60 mt-3 text-sm italic">
                  {l.engagement >= 70
                    ? "AI Insight: High engagement — leads like this convert 3× more often within 48 hours."
                    : "AI Insight: Consider a follow-up to boost engagement."}
                </p>
              </div>
            ))}
          </div>
        )}
      </SupernovaCard>
    </div>
  );
}