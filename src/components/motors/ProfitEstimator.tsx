import React from "react";
import { motion } from "framer-motion";

type Props = {
  buyPrice: number | null;
  sellPrice: number | null;
  valuation: number | null | undefined;
  theme: any;
};

export default function ProfitEstimator({ buyPrice, sellPrice, valuation, theme }: Props) {
  const buy = buyPrice ?? 0;
  const sell = sellPrice ?? valuation ?? 0;

  const profit = sell - buy;
  const profitColor = profit >= 0 ? theme.accent : "#F44336";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl p-6 mb-6 shadow-xl border border-white/10"
      style={{ backgroundColor: theme.card }}
    >
      <h3
        className="text-xl font-bold mb-3"
        style={{ color: theme.accent }}
      >
        📊 Profit Estimator
      </h3>

      <p className="text-sm" style={{ color: theme.text }}>
        Buy Price: £{buy.toLocaleString()}
      </p>

      <p className="text-sm" style={{ color: theme.text }}>
        Estimated Sell: £{sell.toLocaleString()}
      </p>

      <p
        className="mt-3 text-3xl font-extrabold"
        style={{ color: profitColor }}
      >
        Profit: £{profit.toLocaleString()}
      </p>
    </motion.div>
  );
}
