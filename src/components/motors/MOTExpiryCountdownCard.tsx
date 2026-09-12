import React from "react";
import { motion } from "framer-motion";

type Props = {
  daysLeft: number | null;
  theme: any;
};

export default function MOTExpiryCountdownCard({ daysLeft, theme }: Props) {
  if (daysLeft === null) return null;

  // ⭐ Determine colour based on urgency
  const color =
    daysLeft < 0
      ? "#e74c3c" // expired
      : daysLeft <= 7
      ? "#e74c3c" // red
      : daysLeft <= 30
      ? "#f1c40f" // orange
      : "#2ecc71"; // green

  const label =
    daysLeft < 0
      ? "Expired"
      : daysLeft === 1
      ? "1 day left"
      : `${daysLeft} days left`;

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
        className="text-lg font-bold mb-2"
        style={{ color: theme.goldDeep }}
      >
        ⏳ MOT Expiry Countdown
      </h3>

      <p
        className="text-2xl font-extrabold"
        style={{ color }}
      >
        {label}
      </p>
    </motion.div>
  );
}
