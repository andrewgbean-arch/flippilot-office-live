import React from "react";
import { motion } from "framer-motion";
import { MotAiResult } from "@/engines/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

const BAND_LABEL = { good: "Good", fair: "Fair", poor: "Poor" } as const;
const BAND_COLOUR = { good: "#2ecc71", fair: "#f1c40f", poor: "#e74c3c" } as const;

// This card used to print a precise "97%" pass chance. That number came from a
// six-step lookup table, not a model, and it appeared for cars with no MOT
// data at all. It is now a rough band, and says so.
export default function MotAiPassChance({ ai, theme }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl p-6 mb-6 shadow-xl border border-white/10"
      style={{ backgroundColor: theme.card }}
    >
      <h2
        className="text-xl font-bold mb-2"
        style={{ color: theme.accent }}
      >
        Next MOT: rough outlook
      </h2>

      {ai.passOutlook ? (
        <p
          className="text-3xl font-extrabold"
          style={{ color: BAND_COLOUR[ai.passOutlook] }}
        >
          {BAND_LABEL[ai.passOutlook]}
        </p>
      ) : (
        <p className="text-2xl font-extrabold" style={{ color: "#8892a6" }}>
          {ai.hasData ? "Needs a test first" : "No MOT data"}
        </p>
      )}

      <p className="mt-3 text-white/70" style={{ color: theme.text }}>
        {ai.nextTestRisk}
      </p>
      {ai.passOutlook && (
        <p className="mt-2 text-xs" style={{ color: "#AAB4C3" }}>
          A rough guide from the recorded advisories, failures and mileage, not a measured chance of passing.
        </p>
      )}
    </motion.div>
  );
}
