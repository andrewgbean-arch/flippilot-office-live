import React from "react";
import { motion } from "framer-motion";
import { formatDate, motState } from "@/dealer/inventory/vehicleListModel";

// The label this card colours: same rule as the vehicle list, so an MOT is
// valid through its expiry day and a blank or unreadable date is "Unknown".
export function motStatusLabel(expiry: string | null | undefined, now: Date): "Expired" | "Expiring Soon" | "Valid" | "Unknown" {
  const kind = motState(expiry, now).kind;
  return kind === "expired" ? "Expired" : kind === "soon" ? "Expiring Soon" : kind === "valid" ? "Valid" : "Unknown";
}

type Props = {
  status: string | null;
  expiryDate: string | null;
  theme: any;
};

export default function MOTStatusCard({ status, expiryDate, theme }: Props) {
  const statusColor =
    status === "Expired"
      ? "#e74c3c"
      : status === "Expiring Soon"
      ? "#f1c40f"
      : status === "Valid"
      ? "#2ecc71"
      : theme.text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl p-6 mb-6 shadow-xl border"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.goldDeep,
      }}
    >
      <h3
        className="text-xl font-bold mb-3"
        style={{ color: theme.accent }}
      >
        🚗 Current MOT Status
      </h3>

      <p
        className="text-base font-semibold"
        style={{ color: statusColor }}
      >
        Status: {status && status !== "Unknown" ? status : "No MOT date recorded"}
      </p>

      <p
        className="text-base mt-1"
        style={{ color: theme.text }}
      >
        Expiry: {expiryDate ? formatDate(expiryDate) ?? expiryDate : "No expiry date recorded"}
      </p>
    </motion.div>
  );
}
