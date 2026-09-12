import React from "react";
import { motion } from "framer-motion";

const RED = "#F44336";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

export default function MOTFailuresList({
  failures,
}: {
  failures?: string[] | null;
}) {
  if (!failures || failures.length === 0) return null;

  // ⭐ Severity colouring
  function getFailureColor(text: string) {
    const t = text.toLowerCase();

    if (
      t.includes("dangerous") ||
      t.includes("major") ||
      t.includes("critical") ||
      t.includes("brake") ||
      t.includes("steering") ||
      t.includes("suspension")
    ) {
      return RED; // critical red
    }

    if (
      t.includes("corrosion") ||
      t.includes("leak") ||
      t.includes("structural") ||
      t.includes("tyre") ||
      t.includes("exhaust")
    ) {
      return "#f1c40f"; // orange/yellow
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
        borderColor: RED,
      }}
    >
      <h3
        className="text-lg font-bold mb-2 flex items-center gap-2"
        style={{ color: RED }}
      >
        Failures
        <span className="text-xs px-2 py-1 rounded-lg bg-red-500 text-black font-bold">
          {failures.length}
        </span>
      </h3>

      <div className="space-y-1">
        {failures.map((f, i) => (
          <p
            key={i}
            className="text-sm"
            style={{ color: getFailureColor(f) }}
          >
            • {f || "No failure description provided"}
          </p>
        ))}
      </div>
    </motion.div>
  );
}
