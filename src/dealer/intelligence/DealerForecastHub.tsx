import React, { useMemo } from "react";
import SupernovaCard from "@/components/SupernovaCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import {
  FiTrendingUp,
  FiActivity,
  FiAlertTriangle,
  FiPieChart,
} from "react-icons/fi";

export default function DealerForecastHub() {
  const forecast: {
    id: string;
    segment: string;
    demandNext30: number;
    demandNext90: number;
    predictedMargin: number;
    risk: number;
    seasonalUplift: number;
  }[] = [];

  const metrics = useMemo(() => {
    const avg30 = forecast.length
      ? Math.round(forecast.reduce((sum, f) => sum + f.demandNext30, 0) / forecast.length)
      : 0;

    const avg90 = forecast.length
      ? Math.round(forecast.reduce((sum, f) => sum + f.demandNext90, 0) / forecast.length)
      : 0;

    const avgMargin = forecast.length
      ? Math.round(forecast.reduce((sum, f) => sum + f.predictedMargin, 0) / forecast.length)
      : 0;

    const avgRisk = forecast.length
      ? Math.round(forecast.reduce((sum, f) => sum + f.risk, 0) / forecast.length)
      : 0;

    const topSegments = [...forecast]
      .sort((a, b) => b.demandNext30 - a.demandNext30)
      .slice(0, 5);

    return { avg30, avg90, avgMargin, avgRisk, topSegments };
  }, []);

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto animate-fadeIn">

      <SupernovaSectionDivider label="Forecast Hub" />

      <p className="text-white/60 mb-6">
        Predictive demand, margin movement, seasonal uplift, and AI‑powered forecasting.
      </p>

      {/* Overview */}
      <SupernovaCard title="Forecast Overview" accent="gold">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white/70">
          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiTrendingUp /> 30‑Day Demand
            </div>
            <p className="mt-1">{metrics.avg30}%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiActivity /> 90‑Day Demand
            </div>
            <p className="mt-1">{metrics.avg90}%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiPieChart /> Predicted Margin
            </div>
            <p className="mt-1">{metrics.avgMargin}%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiAlertTriangle /> Risk Level
            </div>
            <p className="mt-1">{metrics.avgRisk}%</p>
          </div>
        </div>
      </SupernovaCard>

      {/* Top Segments */}
      <SupernovaCard
        title="Top Forecast Segments"
        subtitle="Segments with strongest predicted demand."
        accent="blue"
      >
        {metrics.topSegments.length === 0 ? (
          <p className="text-white/50 text-sm">No forecast data available.</p>
        ) : (
          <div className="space-y-4">
            {metrics.topSegments.map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
              >
                <div className="text-yellow-400 font-semibold text-lg">
                  {f.segment}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-white/70">
                  <div>
                    <FiTrendingUp className="inline mr-1 text-green-400" />
                    30‑Day Demand:{" "}
                    <span className="text-green-400 font-bold">
                      {f.demandNext30}%
                    </span>
                  </div>

                  <div>
                    <FiActivity className="inline mr-1 text-blue-400" />
                    90‑Day Demand:{" "}
                    <span className="text-blue-400 font-bold">
                      {f.demandNext90}%
                    </span>
                  </div>

                  <div>
                    <FiPieChart className="inline mr-1 text-yellow-400" />
                    Margin:{" "}
                    <span className="text-yellow-400 font-bold">
                      {f.predictedMargin}%
                    </span>
                  </div>
                </div>

                <p className="text-white/60 mt-2 text-sm italic">
                  Seasonal Uplift: {f.seasonalUplift}%
                </p>

                <p className="text-white/40 mt-1 text-xs italic">
                  Risk Level: {f.risk}%
                </p>
              </div>
            ))}
          </div>
        )}
      </SupernovaCard>

      {/* AI Insights */}
      <SupernovaCard
        title="AI Forecast Insights"
        subtitle="Patterns detected across demand, margin, and seasonal uplift."
        accent="gold"
      >
        <ul className="list-disc pl-6 text-white/70 space-y-2">
          <li>Seasonal uplift peaks in Q3 for SUVs and hatchbacks.</li>
          <li>High risk correlates with volatile demand cycles.</li>
          <li>Strong 30‑day demand often predicts margin uplift.</li>
          <li>EV segments show stable long‑term demand curves.</li>
        </ul>
      </SupernovaCard>
    </div>
  );
}

