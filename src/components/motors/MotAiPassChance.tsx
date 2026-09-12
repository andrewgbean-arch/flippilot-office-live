import React from "react";
import { motion } from "framer-motion";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

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
        📈 Predicted MOT Pass Chance
      </h2>

      <p
        className="text-4xl font-extrabold"
        style={{ color: theme.accent }}
      >
        {ai.predictedPassChance}%
      </p>

      <p className="mt-3 text-white/70" style={{ color: theme.text }}>
        {ai.nextTestRisk}
      </p>
    </motion.div>
  );
}
