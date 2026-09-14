import React, { useMemo } from "react";
import SupernovaCard from "@/components/SupernovaCard";
import SupernovaSectionHeader from "@/dealer/SupernovaSectionHeader";

import {
  FiCheckCircle,
  FiTrendingUp,
  FiActivity,
  FiAlertTriangle,
  FiUser,
  FiClock,
  FiPercent,
} from "react-icons/fi";

// ⭐ REQUIRED FOR ROUTER
type Props = { brain: any };

// ⭐ TEMP DATA (replace with backend later)
const closing: {
  id: string;
  rep: string;
  leads: number;
  closed: number;
  followUps: number;
  avgResponseTime: number; // minutes
  risk?: number; // %
}[] = [];

export default function DealerClosingHub({ brain }: Props) {
  const metrics = useMemo(() => {
    const totalLeads = closing.reduce((sum, c) => sum + c.leads, 0);
    const totalClosed = closing.reduce((sum, c) => sum + c.closed, 0);

    const conversionRate = totalLeads
      ? Math.round((totalClosed / totalLeads) * 100)
      : 0;

    const avgResponseTime = closing.length
      ? Math.round(
          closing.reduce((sum, c) => sum + c.avgResponseTime, 0) /
            closing.length
        )
      : 0;

    const avgRisk = closing.length
      ? Math.round(
          closing.reduce((sum, c) => sum + (c.risk ?? 0), 0) / closing.length
        )
      : 0;

    const topClosers = [...closing]
      .sort((a, b) => b.closed - a.closed)
      .slice(0, 5);

    return {
      totalLeads,
      totalClosed,
      conversionRate,
      avgResponseTime,
      avgRisk,
      topClosers,
    };
  }, []);

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto animate-fadeIn">
      <SupernovaSectionHeader
        title="Closing Hub"
        subtitle="Conversion performance, follow‑up strength, and AI‑powered closing insights."
      />

      {/* Overview */}
      <SupernovaCard title="Closing Overview" accent="gold">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white/70">
          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiUser /> Total Leads
            </div>
            <p className="mt-1">{metrics.totalLeads}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiCheckCircle /> Closed Deals
            </div>
            <p className="mt-1">{metrics.totalClosed}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiPercent /> Conversion Rate
            </div>
            <p className="mt-1">{metrics.conversionRate}%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiClock /> Avg Response Time
            </div>
            <p className="mt-1">{metrics.avgResponseTime} mins</p>
          </div>
        </div>
      </SupernovaCard>

      {/* Top Closers */}
      <SupernovaCard
        title="Top Closers"
        subtitle="Sales reps with strongest closing performance."
        accent="blue"
      >
        {metrics.topClosers.length === 0 ? (
          <p className="text-white/50 text-sm">No closing data available.</p>
        ) : (
          <div className="space-y-4">
            {metrics.topClosers.map((c) => {
              const rate = c.leads
                ? Math.round((c.closed / c.leads) * 100)
                : 0;

              return (
                <div
                  key={c.id}
                  className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
                >
                  <div className="text-yellow-400 font-semibold text-lg">
                    {c.rep}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-white/70">
                    <div>
                      <FiUser className="inline mr-1 text-blue-400" />
                      Leads:{" "}
                      <span className="text-blue-400 font-bold">
                        {c.leads}
                      </span>
                    </div>

                    <div>
                      <FiCheckCircle className="inline mr-1 text-green-400" />
                      Closed:{" "}
                      <span className="text-green-400 font-bold">
                        {c.closed}
                      </span>
                    </div>

                    <div>
                      <FiPercent className="inline mr-1 text-yellow-400" />
                      Rate:{" "}
                      <span className="text-yellow-400 font-bold">
                        {rate}%
                      </span>
                    </div>
                  </div>

                  <p className="text-white/60 mt-2 text-sm italic">
                    Avg Response Time: {c.avgResponseTime} mins
                  </p>

                  <p className="text-white/40 mt-1 text-xs italic">
                    AI Insight: Reps responding within 15 minutes close 3× more
                    deals on average.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SupernovaCard>

      {/* AI Insights */}
      <SupernovaCard
        title="AI Closing Insights"
        subtitle="Patterns detected across conversion, follow‑ups, and response time."
        accent="gold"
      >
        <ul className="list-disc pl-6 text-white/70 space-y-2">
          <li>Fast follow‑ups increase closing probability by up to 40%.</li>
          <li>High‑risk leads often require multi‑channel follow‑up.</li>
          <li>Reps with consistent response times outperform by 22%.</li>
          <li>Lead quality spikes correlate with seasonal demand cycles.</li>
        </ul>
      </SupernovaCard>
    </div>
  );
}
