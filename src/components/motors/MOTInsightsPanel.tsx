import React from "react";
import { motion } from "framer-motion";
import { FileCheck, Calendar, Car, AlertTriangle, List } from "lucide-react";
import { hasMotData } from "@/engines/motAiEngine";
import { formatDate } from "@/dealer/inventory/vehicleListModel";

const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

type Props = {
  mot?: any; // Vehicle.mot structure
};

export default function MOTInsightsPanel({ mot }: Props) {
  if (!mot) return null;

  // A car that has never been MOT-checked has an empty record; printing
  // "Advisories: 0 / Failures: 0" for it reads as a clean MOT history.
  if (!hasMotData(mot)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl p-5 mt-5 border shadow-lg"
        style={{ backgroundColor: "#111827", borderColor: GOLD }}
      >
        <h3 className="text-lg font-bold mb-3" style={{ color: GOLD }}>
          MOT Insights
        </h3>
        <p className="text-sm" style={{ color: SILVER }}>
          No MOT data recorded for this vehicle.
        </p>
      </motion.div>
    );
  }

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

      {/* STATUS: only when the caller worked one out (it is never stored on the vehicle) */}
      {mot.motStatus && (
        <div className="flex items-center gap-3 mt-2">
          <FileCheck size={20} color={GOLD} />
          <span className="text-sm" style={{ color: SILVER }}>
            Status: {mot.motStatus}
          </span>
        </div>
      )}

      {/* EXPIRY */}
      <div className="flex items-center gap-3 mt-2">
        <Calendar size={20} color={GOLD} />
        <span className="text-sm" style={{ color: SILVER }}>
          Expiry: {mot.expiry ? formatDate(mot.expiry) ?? mot.expiry : "Not recorded"}
        </span>
      </div>

      {/* MILEAGE */}
      <div className="flex items-center gap-3 mt-2">
        <Car size={20} color={GOLD} />
        <span className="text-sm" style={{ color: SILVER }}>
          Mileage: {typeof mot.mileage === "number" ? mot.mileage.toLocaleString() : "Not recorded"}
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
