import React, { useMemo } from "react";
import SupernovaCard from "@/components/SupernovaCard";
import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";


import {
  FiCpu,
  FiZap,
  FiAlertTriangle,
  FiTrendingUp,
  FiActivity,
  FiCheckCircle,
  FiRefreshCw,
} from "react-icons/fi";

// ⭐ TEMP DATA (replace with backend later)
const aiCommands: {
  id: string;
  action: string;
  category: string;
  confidence: number; // %
  impact: string;
  autoExecute: boolean;
}[] = [];

const aiAlerts: {
  id: string;
  message: string;
  severity: "Low" | "Medium" | "High";
  recommendedAction: string;
}[] = [];
type Props = { brain: any };
export default function DealerAICommandHub({ brain }: Props) {

  const metrics = useMemo(() => {
    const avgConfidence = aiCommands.length
      ? Math.round(
          aiCommands.reduce((sum, c) => sum + c.confidence, 0) /
            aiCommands.length
        )
      : 0;

    const autoCount = aiCommands.filter((c) => c.autoExecute).length;

    const highAlerts = aiAlerts.filter((a) => a.severity === "High");

    return { avgConfidence, autoCount, highAlerts };
  }, []);

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto animate-fadeIn">
 <DealerNeonHeader
  title="AI Command Hub"
/>


      {/* Overview */}
      <SupernovaCard title="AI Overview" accent="gold">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white/70">
          <div>
            <FiCpu className="inline mr-2 text-yellow-400" />
            Avg AI Confidence:{" "}
            <span className="text-yellow-400 font-bold">
              {metrics.avgConfidence}%
            </span>
          </div>

          <div>
            <FiZap className="inline mr-2 text-green-400" />
            Auto‑Executed Actions:{" "}
            <span className="text-green-400 font-bold">
              {metrics.autoCount}
            </span>
          </div>

          <div>
            <FiAlertTriangle className="inline mr-2 text-red-400" />
            High‑Severity Alerts:{" "}
            <span className="text-red-400 font-bold">
              {metrics.highAlerts.length}
            </span>
          </div>
        </div>
      </SupernovaCard>

      {/* AI Commands */}
      <SupernovaCard
        title="AI Strategic Commands"
        subtitle="Actions the AI recommends or auto‑executes."
        accent="blue"
      >
        {aiCommands.length === 0 ? (
          <p className="text-white/50 text-sm">No AI commands available.</p>
        ) : (
          <div className="space-y-4">
            {aiCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
              >
                <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                  <FiZap /> {cmd.action}
                </div>

                <p className="text-white/70 mt-1">{cmd.category}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-white/70">
                  <div>
                    <FiCpu className="inline mr-1 text-blue-400" />
                    Confidence:{" "}
                    <span className="text-blue-400 font-bold">
                      {cmd.confidence}%
                    </span>
                  </div>

                  <div>
                    <FiActivity className="inline mr-1 text-green-400" />
                    Impact:{" "}
                    <span className="text-green-400 font-bold">
                      {cmd.impact}
                    </span>
                  </div>

                  <div>
                    <FiCheckCircle className="inline mr-1 text-pink-400" />
                    Auto Execute:{" "}
                    <span className="text-pink-400 font-bold">
                      {cmd.autoExecute ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                <p className="text-white/40 mt-2 text-xs italic">
                  AI Insight: Commands with confidence above 80% are eligible for
                  autonomous execution.
                </p>
              </div>
            ))}
          </div>
        )}
      </SupernovaCard>

      {/* AI Alerts */}
      <SupernovaCard
        title="AI Alerts & Anomalies"
        subtitle="Real‑time warnings detected across dealership systems."
        accent="red"
      >
        {aiAlerts.length === 0 ? (
          <p className="text-white/50 text-sm">No AI alerts detected.</p>
        ) : (
          <div className="space-y-4">
            {aiAlerts.map((alert) => {
              const color =
                alert.severity === "High"
                  ? "text-red-400"
                  : alert.severity === "Medium"
                  ? "text-yellow-400"
                  : "text-green-400";

              return (
                <div
                  key={alert.id}
                  className="p-4 rounded-lg bg-black/40 border border-red-500 hover:bg-black/60 transition"
                >
                  <div className={`${color} font-semibold text-lg`}>
                    {alert.message}
                  </div>

                  <p className="text-white/70 mt-1">
                    Severity:{" "}
                    <span className={`${color} font-bold`}>
                      {alert.severity}
                    </span>
                  </p>

                  <p className="text-white/60 mt-2 text-sm italic">
                    Recommended Action: {alert.recommendedAction}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SupernovaCard>

      {/* AI System Insights */}
      <SupernovaCard
        title="AI System Insights"
        subtitle="Cross‑hub intelligence powering autonomous dealership operations."
        accent="gold"
      >
        <ul className="list-disc pl-6 text-white/70 space-y-2">
          <li>AI detects anomalies 4× faster than manual review.</li>
          <li>Auto‑executed actions reduce operational delays by 18%.</li>
          <li>Cross‑hub intelligence improves strategic accuracy.</li>
          <li>AI risk mitigation prevents margin compression.</li>
          <li>Forecast alignment boosts AI confidence scores.</li>
        </ul>
      </SupernovaCard>

      <div className="mt-8 text-center text-white/40 text-xs">
        Powered by FlipPilot Supernova V5 • AI Command Hub
      </div>
    </div>
  );
}
