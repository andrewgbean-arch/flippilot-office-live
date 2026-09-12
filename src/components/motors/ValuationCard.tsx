import React from "react";
import { motion } from "framer-motion";

type Props = {
  value: number | null | undefined;
  theme: any;
};

export default function ValuationCard({ value, theme }: Props) {
  const display = value ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl p-6 mb-6 shadow-xl border"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.goldSoftGlow,
      }}
    >
      <h3
        className="text-2xl font-extrabold mb-3"
        style={{ color: theme.accent }}
      >
        💰 Vehicle Valuation
      </h3>

      <p
        className="text-4xl font-extrabold"
        style={{ color: theme.accent }}
      >
        £{display.toLocaleString()}
      </p>

      <p
        className="mt-3 text-sm"
        style={{ color: theme.text }}
      >
        Estimated market value based on MOT health, mileage, advisories, and condition.
      </p>
    </motion.div>
  );
}
