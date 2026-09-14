import React from "react";
import { motion } from "framer-motion";

const RED = "#F44336";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

type FailedTest = {
  date?: string;
  year?: number;
  failures: string[];
};

export default function MOTFailuresList({
  failedTests,
}: {
  failedTests?: FailedTest[] | null;
}) {
  if (!failedTests || failedTests.length === 0) return null;

  const totalCount = failedTests.reduce((sum, t) => sum + t.failures.length, 0);

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
        className="text-lg font-bold mb-1 flex items-center gap-2"
        style={{ color: RED }}
      >
        Past Failures
        <span className="text-xs px-2 py-1 rounded-lg bg-red-500 text-black font-bold">
          {totalCount}
        </span>
      </h3>
      <p className="text-xs mb-3" style={{ color: SILVER }}>
        Historical — this car has since passed a later test. Not a current issue.
      </p>

      <div className="space-y-3">
        {failedTests.map((t, ti) => (
          <div key={ti}>
            <p className="text-sm font-semibold" style={{ color: RED }}>
              {t.date
                ? new Date(t.date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
                : t.year
                  ? String(t.year)
                  : "Unknown date"}
            </p>
            <div className="space-y-1 mt-1">
              {t.failures.map((f, i) => (
                <p
                  key={i}
                  className="text-sm"
                  style={{ color: getFailureColor(f) }}
                >
                  • {f || "No failure description provided"}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
