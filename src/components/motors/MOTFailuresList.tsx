import React from "react";
import { motion } from "framer-motion";

const RED = "#F44336";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

type FailedTest = {
  date?: string;
  year?: number;
  mileage?: number | null;
  testNumber?: string | null;
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

      <div className="space-y-4">
        {failedTests.map((t, ti) => (
          <div key={ti} className="pb-4 last:pb-0 border-b last:border-0" style={{ borderColor: "rgba(244,67,54,0.2)" }}>
            <p className="text-xs" style={{ color: SILVER }}>Date tested</p>
            <p className="text-sm font-semibold mb-2" style={{ color: "#e6ebff" }}>
              {t.date
                ? new Date(t.date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
                : t.year
                  ? String(t.year)
                  : "Unknown date"}
            </p>

            <span className="inline-block px-3 py-1 rounded bg-red-600 text-white text-xs font-bold mb-2">
              FAIL
            </span>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
              {t.mileage != null && (
                <div>
                  <p className="text-xs" style={{ color: SILVER }}>Mileage</p>
                  <p style={{ color: "#e6ebff" }}>{t.mileage.toLocaleString()} mi</p>
                </div>
              )}
              {t.testNumber && (
                <div>
                  <p className="text-xs" style={{ color: SILVER }}>MOT test number</p>
                  <p style={{ color: "#e6ebff" }}>{t.testNumber}</p>
                </div>
              )}
            </div>

            <p className="text-xs mt-3 mb-1" style={{ color: SILVER }}>Failed on</p>
            <div className="space-y-1">
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
