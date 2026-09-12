import React from "react";
import { motion } from "framer-motion";

const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

export default function MOTAdvisoriesList({
  advisories,
}: {
  advisories?: string[] | null;
}) {
  if (!advisories || advisories.length === 0) return null;

  // ⭐ Severity colouring
  function getSeverityColor(text: string) {
    const t = text.toLowerCase();

    if (
      t.includes("corrosion") ||
      t.includes("leak") ||
      t.includes("brake") ||
      t.includes("danger") ||
      t.includes("excessive")
    ) {
      return "#e74c3c"; // red
    }

    if (
      t.includes("worn") ||
      t.includes("deteriorated") ||
      t.includes("play") ||
      t.includes("binding")
    ) {
      return "#f1c40f"; // yellow/orange
    }

    return SILVER; // default
  }

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
        Advisories
        <span className="text-xs px-2 py-1 rounded-lg bg-yellow-400 text-black font-bold">
          {advisories.length}
        </span>
      </h3>

      <div className="space-y-1">
        {advisories.map((a, i) => (
          <p
            key={i}
            className="text-sm"
            style={{ color: getSeverityColor(a) }}
          >
            • {a || "No advisory text provided"}
          </p>
        ))}
      </div>
    </motion.div>
  );
}
