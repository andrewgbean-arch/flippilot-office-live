import React from "react";
import { motion } from "framer-motion";
import { motAiEngine } from "@/engines/motAiEngine";



type Props = {
  mot: any; // Vehicle.mot structure
};

const defaultTheme = {
  card: "#0A0A0A",
  goldDeep: "#FFD700",
  accent: "#FFD700",
  muted: "#1A1A1A",
  text: "#FFFFFF",
};

export default function MOTHealthScore({ mot }: Props) {
  const theme = defaultTheme;

  if (!mot) return null;

  // ⭐ Use REAL AI engine
const ai = motAiEngine(mot, mot.history ?? []);

  const score = ai.healthScore;

  // ⭐ Colour based on risk
  const barColor =
    ai.riskLevel === "low"
      ? "#2ecc71" // green
      : ai.riskLevel === "medium"
      ? "#f1c40f" // yellow
      : "#e74c3c"; // red

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl p-6 mb-6 shadow-xl border"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.goldDeep,
      }}
    >
      <h3
        className="text-lg font-bold mb-2"
        style={{ color: theme.accent }}
      >
        🚦 MOT Health Score
      </h3>

      {/* Gauge Bar */}
      <div
        className="w-full rounded-lg overflow-hidden mb-3"
        style={{
          height: 14,
          backgroundColor: theme.muted,
        }}
      >
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            height: "100%",
            backgroundColor: barColor,
          }}
        />
      </div>

      {/* Score Number */}
      <p
        className="text-3xl font-extrabold text-center mb-2"
        style={{ color: barColor }}
      >
        {score}/100
      </p>

      <p
        className="text-sm"
        style={{ color: theme.text }}
      >
        AI‑calculated score based on mileage, advisories, failures, and MOT history.
      </p>
    </motion.div>
  );
}
