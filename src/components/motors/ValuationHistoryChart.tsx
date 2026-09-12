import React from "react";
import { motion } from "framer-motion";

type Props = {
  history: { date: string; value: number }[] | null | undefined;
  theme: any;
};

export default function ValuationHistoryChart({ history, theme }: Props) {
  if (!history || history.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl p-6 mb-6 shadow-xl border border-white/10"
      style={{ backgroundColor: theme.card }}
    >
      <h3
        className="text-xl font-bold mb-4"
        style={{ color: theme.accent }}
      >
        📈 Valuation History
      </h3>

      <div className="space-y-4">
        {history.map((h, i) => {
          const barWidth = Math.min(h.value / 50, 100);

          return (
            <div key={i}>
              <p className="text-sm" style={{ color: theme.text }}>
                {new Date(h.date).toLocaleDateString()} — £{h.value.toLocaleString()}
              </p>

              <div
                className="w-full rounded-lg overflow-hidden mt-1"
                style={{
                  height: 10,
                  backgroundColor: theme.blackSoft,
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    backgroundColor: theme.accent,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
