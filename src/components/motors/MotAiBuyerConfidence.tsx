import React from "react";
import { motion } from "framer-motion";
import { MotAiResult } from "@/engines/motAiEngine";

type Props = {
  ai?: MotAiResult;
  theme?: any;
};

export default function MotAiBuyerConfidence({ ai, theme }: Props) {
  const safeTheme = theme ?? {
    card: "#111",
    accent: "#FFD700",
    text: "#ccc",
  };

  // With no MOT data (or an expired MOT, which has no pass chance) there is
  // nothing to combine. This used to score 0 or, worse, a made-up figure.
  if (!ai || ai.healthScore === null || ai.predictedPassChance === null) {
    return (
      <div
        className="rounded-xl p-6 mb-6 shadow-xl border border-white/10"
        style={{ backgroundColor: safeTheme.card }}
      >
        <h2 className="text-2xl font-extrabold mb-3" style={{ color: safeTheme.accent }}>
          ⭐ Buyer Confidence Score
        </h2>
        <p className="text-xl font-bold" style={{ color: safeTheme.text }}>
          {ai?.hasData ? "Needs a current MOT first" : "No MOT data"}
        </p>
      </div>
    );
  }

  const score =
    ai.healthScore * 0.5 +
    ai.predictedPassChance * 0.3 -
    ai.failureSeverity * 0.2;

  const rounded = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl p-6 mb-6 shadow-xl border border-white/10"
      style={{ backgroundColor: safeTheme.card }}
    >
      <h2
        className="text-2xl font-extrabold mb-3"
        style={{ color: safeTheme.accent }}
      >
        ⭐ Buyer Confidence Score
      </h2>

      <p
        className="text-4xl font-extrabold"
        style={{ color: safeTheme.accent }}
      >
        {rounded} / 100
      </p>

      <p className="mt-3 text-white/70" style={{ color: safeTheme.text }}>
        Higher score = easier to sell, stronger buyer trust.
      </p>
    </motion.div>
  );
}
