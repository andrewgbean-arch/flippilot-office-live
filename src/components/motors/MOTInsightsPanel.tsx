import React from "react";
import { motion } from "framer-motion";
import { FileCheck, Calendar, Car, AlertTriangle, List } from "lucide-react";

const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

type Props = {
  mot?: any; // Vehicle.mot structure
};

export default function MOTInsightsPanel({ mot }: Props) {
  if (!mot) return null;

  // ⭐ Extract failures from history
  const failures = mot.history
    ? mot.history
        .filter((h: any) => h.result?.toUpperCase() === "FAIL")
        .flatMap((h: any) => h.failures ?? [])
    : [];

  const advisories = mot.advisories ?? [];
  const historyCount = mot.history?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl p-5 mt-5 border shadow-lg"
      style={{
        backgroundColor: "#111827",
        borderColor: GOLD,
      }}
    >
      <h3
        className="text-lg font-bold mb-3"
        style={{ color: GOLD }}
      >
        MOT Insights
      </h3>

      {/* STATUS */}
      <div className="flex items-center gap-3 mt-2">
        <FileCheck size={20} color={GOLD} />
        <span className="text-sm" style={{ color: SILVER }}>
          Status: {mot.motStatus ?? "Unknown"}
        </span>
      </div>

      {/* EXPIRY */}
      <div className="flex items-center gap-3 mt-2">
        <Calendar size={20} color={GOLD} />
        <span className="text-sm" style={{ color: SILVER }}>
          Expiry: {mot.expiry ?? "Unknown"}
        </span>
      </div>

      {/* MILEAGE */}
      <div className="flex items-center gap-3 mt-2">
        <Car size={20} color={GOLD} />
        <span className="text-sm" style={{ color: SILVER }}>
          Mileage: {mot.mileage?.toLocaleString() ?? "Unknown"}
        </span>
      </div>

      {/* HISTORY COUNT */}
      <div className="flex items-center gap-3 mt-2">
        <List size={20} color={GOLD} />
        <span className="text-sm" style={{ color: SILVER }}>
          MOT Tests Recorded: {historyCount}
        </span>
      </div>

      {/* ADVISORIES */}
      <div className="flex items-center gap-3 mt-2">
        <AlertTriangle size={20} color={GOLD} />
        <span className="text-sm" style={{ color: SILVER }}>
          Advisories: {advisories.length}
        </span>
      </div>

      {/* FAILURES */}
      <div className="flex items-center gap-3 mt-2">
        <AlertTriangle size={20} color={GOLD} />
        <span className="text-sm" style={{ color: SILVER }}>
          Failures: {failures.length}
        </span>
      </div>
    </motion.div>
  );
}
