import React from "react";
import { motion } from "framer-motion";
import { MotAiResult } from "@/engines/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiRiskGauge({ ai, theme }: Props) {
  const colors: Record<MotAiResult["riskLevel"], string> = {
    low: "#4CAF50",
    medium: "#FFC107",
    high: "#F44336",
    unknown: "#8892a6",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl p-6 mb-6 shadow-xl border border-white/10"
      style={{ backgroundColor: theme.card }}
    >
      <h2
        className="text-xl font-bold mb-3"
        style={{ color: theme.accent }}
      >
        ⚠️ MOT Risk Gauge
      </h2>

      {/* Gauge Bar */}
      <div
        className="w-full rounded-lg overflow-hidden"
        style={{
          height: 14,
          backgroundColor: theme.blackSoft,
        }}
      >
        <div
          style={{
            width: `${ai.healthScore ?? 0}%`,
            height: "100%",
            backgroundColor: colors[ai.riskLevel],
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* Risk Label */}
      <p
        className="mt-3 font-bold text-lg"
        style={{ color: colors[ai.riskLevel] }}
      >
        {ai.riskLevel === "unknown" ? "NO MOT DATA" : `${ai.riskLevel.toUpperCase()} RISK`}
      </p>
    </motion.div>
  );
}
