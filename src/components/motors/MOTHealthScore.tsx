import React from "react";
import { motion } from "framer-motion";
import { motAiEngine, MOT_RULE_OF_THUMB } from "@/engines/motAiEngine";

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

// A rule-of-thumb read of the MOT record, not an "AI" score. It used to print
// a confident "96/100" for a car with no MOT data at all, and claimed to be
// based on failures and history that it never read. Now: no data says so,
// an expired MOT says so, and a score always comes with what it was worked
// out from.
export default function MOTHealthScore({ mot }: Props) {
  const theme = defaultTheme;

  if (!mot) return null;

  const ai = motAiEngine(mot, mot.history ?? []);

  const barColor =
    ai.riskLevel === "low"
      ? "#2ecc71" // green
      : ai.riskLevel === "medium"
      ? "#f1c40f" // yellow
      : ai.riskLevel === "high"
      ? "#e74c3c" // red
      : "#8892a6"; // grey: unknown

  const showScore = ai.hasData && !ai.basis.expired && ai.healthScore !== null;

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
        MOT check (rule of thumb)
      </h3>

      {!ai.hasData && (
        <>
          <p className="text-2xl font-extrabold mb-2" style={{ color: barColor }}>
            No MOT data
          </p>
          <p className="text-sm" style={{ color: theme.text }}>
            No MOT expiry date or test history is recorded for this vehicle, so there is nothing to score.
            Look up its registration to fetch the real record.
          </p>
        </>
      )}

      {ai.hasData && ai.basis.expired && (
        <>
          <p className="text-2xl font-extrabold mb-2" style={{ color: barColor }}>
            MOT expired
          </p>
          <p className="text-sm" style={{ color: theme.text }}>
            {ai.nextTestRisk}
          </p>
        </>
      )}

      {showScore && (
        <>
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
              animate={{ width: `${ai.healthScore}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                height: "100%",
                backgroundColor: barColor,
              }}
            />
          </div>

          <p
            className="text-3xl font-extrabold text-center mb-2"
            style={{ color: barColor }}
          >
            {ai.healthScore}/100
          </p>

          <p className="text-sm mb-2" style={{ color: theme.text }}>
            {ai.summary}
          </p>
          <p className="text-xs" style={{ color: "#AAB4C3" }}>
            {MOT_RULE_OF_THUMB}
          </p>
        </>
      )}
    </motion.div>
  );
}
