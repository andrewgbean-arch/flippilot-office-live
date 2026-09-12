import React from "react";
import SupernovaCard from "@/components/SupernovaCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import {
  FiAlertTriangle,
  FiTrendingUp,
  FiActivity,
  FiPieChart,
} from "react-icons/fi";

export default function DealerRiskHub() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto animate-fadeIn">

      <SupernovaSectionDivider label="Risk Intelligence Hub" />

      <p className="text-white/60 mb-6">
        AI‑powered dealership risk scoring, MOT risk signals, and operational risk insights.
      </p>

      <SupernovaCard title="Dealership Risk Overview" accent="red">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white/70">
          <div>
            <div className="flex items-center gap-2 text-red-400 font-semibold">
              <FiAlertTriangle /> Overall Risk
            </div>
            <p className="mt-1">32%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiTrendingUp /> Market Volatility
            </div>
            <p className="mt-1">12%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-blue-400 font-semibold">
              <FiActivity /> Operational Load
            </div>
            <p className="mt-1">58%</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-green-400 font-semibold">
              <FiPieChart /> Stock Stability
            </div>
            <p className="mt-1">74%</p>
          </div>
        </div>
      </SupernovaCard>

      <SupernovaCard
        title="AI Risk Insights"
        subtitle="Patterns detected across MOT, stock, and operational risk."
        accent="gold"
      >
        <ul className="list-disc pl-6 text-white/70 space-y-2">
          <li>Vehicles with MOT due in 30 days increase risk by 18%.</li>
          <li>High advisory count correlates with reduced buyer confidence.</li>
          <li>Operational load spikes during peak intake weeks.</li>
          <li>Stable stock reduces volatility and improves margin consistency.</li>
        </ul>
      </SupernovaCard>

      <div className="mt-8 text-center text-white/40 text-xs">
        Powered by FlipPilot Supernova V2 • Dealer Risk Hub
      </div>
    </div>
  );
}
