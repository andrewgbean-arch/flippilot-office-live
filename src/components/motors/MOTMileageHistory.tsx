import React from "react";
import { motion } from "framer-motion";

const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

type Entry = {
  date?: string;
  year?: number;
  mileage: number;
};

export default function MOTMileageHistory({
  history,
}: {
  history?: Entry[] | null;
}) {
  if (!history || history.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-3 rounded-xl p-4 border shadow-lg"
      style={{
        backgroundColor: "#111827",
        borderColor: GOLD,
      }}
    >
      <h3
        className="text-lg font-bold mb-2 flex items-center gap-2"
        style={{ color: GOLD }}
      >
        Mileage History
        <span className="text-xs px-2 py-1 rounded-lg bg-yellow-400 text-black font-bold">
          {history.length}
        </span>
      </h3>

      <div className="space-y-1">
        {history.map((h, i) => {
          const prev = history[i - 1];
          let trend = "";

          if (prev) {
            if (h.mileage > prev.mileage) trend = "🔼";
            else if (h.mileage < prev.mileage) trend = "🔽";
          }

          return (
            <p
              key={i}
              className="text-sm flex items-center gap-2"
              style={{ color: SILVER }}
            >
              {h.date ? new Date(h.date).toLocaleDateString() : h.year ? String(h.year) : "Unknown date"}:{" "}
              {h.mileage.toLocaleString()} miles {trend}
            </p>
          );
        })}
      </div>
    </motion.div>
  );
}
