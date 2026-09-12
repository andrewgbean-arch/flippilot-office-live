import React, { useMemo } from "react";
import SupernovaCard from "@/components/SupernovaCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import {
  FiUsers,
  FiMail,
  FiTrendingUp,
  FiActivity,
  FiStar,
  FiAlertTriangle,
} from "react-icons/fi";

// ⭐ TEMP DATA (replace with backend later)
const leads: {
  id: string;
  name: string;
  source: string;
  engagement: number; // 0–100
  conversionChance: number; // %
  risk: number; // %
}[] = [];

export default function DealerCRMIntelligence() {
  // ⭐ CRM Metrics
  const metrics = useMemo(() => {
    const avgEngagement = leads.length
      ? Math.round(
          leads.reduce((sum, l) => sum + l.engagement, 0) / leads.length
        )
      : 0;

    const avgConversion = leads.length
      ? Math.round(
          leads.reduce((sum, l) => sum + l.conversionChance, 0) /
            leads.length
        )
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
  }, []);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto animate-fadeIn">

      <SupernovaSectionDivider label="CRM Intelligence Hub" />

      <p className="text-white/60 mb-6">
        AI‑powered insights into leads, engagement, and conversion.
      </p>

      {/* ⭐ Overview */}
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

      {/* ⭐ Top Lead Sources */}
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

      {/* ⭐ Lead Intelligence */}
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
                  AI Insight: Leads with engagement above 70% convert 3× more
                  often within 48 hours.
                </p>
              </div>
            ))}
          </div>
        )}
      </SupernovaCard>

      <div className="mt-8 text-center text-white/40 text-xs">
        Powered by FlipPilot Supernova V2 • CRM Intelligence Hub
      </div>
    </div>
  );
}
