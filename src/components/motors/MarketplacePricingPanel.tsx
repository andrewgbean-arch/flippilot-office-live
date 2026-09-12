import React from "react";
import { motion } from "framer-motion";

type Props = {
  valuation: number | null | undefined;
  aiPriceMin: number | null | undefined;
  aiPriceMax: number | null | undefined;
  theme: any;
};

export default function MarketplacePricingPanel({
  valuation,
  aiPriceMin,
  aiPriceMax,
  theme,
}: Props) {
  const val = valuation ?? 0;
  const min = aiPriceMin ?? 0;
  const max = aiPriceMax ?? 0;
  const suggested = Math.round(val * 1.05);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl p-6 mb-6 shadow-xl border border-white/10"
      style={{ backgroundColor: theme.card }}
    >
      <h2
        className="text-xl font-bold mb-3"
        style={{ color: theme.accent }}
      >
        🛒 Marketplace Pricing
      </h2>

      <p className="text-white" style={{ color: theme.text }}>
        Valuation: £{val.toLocaleString()}
      </p>

      <p className="text-white" style={{ color: theme.text }}>
        AI Price Range: £{min} – £{max}
      </p>

      <p
        className="mt-3 font-semibold"
        style={{ color: theme.text }}
      >
        Suggested Listing Price: £{suggested}
      </p>
    </motion.div>
  );
}
