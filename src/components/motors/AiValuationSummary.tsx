import React from "react";
import { motion } from "framer-motion";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type Props = {
  vehicle: FlipRecord;
};

const defaultTheme = {
  card: "#0A0A0A",
  accent: "#FFD700",
  text: "#FFFFFF",
};

export default function AiValuationSummary({ vehicle }: Props) {
  const theme = defaultTheme;

  const aiValuation = vehicle.valuation
    ? { estimatedValue: vehicle.valuation, confidence: vehicle.aiValuation?.confidence ?? 0 }
    : null;

  if (!aiValuation) return null;

  const value = aiValuation.estimatedValue ?? 0;
  const confidence = aiValuation.confidence ?? 0;

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
        🤖 AI Valuation Summary
      </h2>

      <p
        className="text-3xl font-extrabold"
        style={{ color: theme.accent }}
      >
        £{value.toLocaleString()}
      </p>

      <p className="mt-3" style={{ color: theme.text }}>
        Confidence: {confidence}%
      </p>
    </motion.div>
  );
}
