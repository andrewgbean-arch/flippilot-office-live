import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type PriceEfficiencyProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function PriceEfficiency({ vehicles, theme }: PriceEfficiencyProps) {
  const scores = vehicles.map((v: FlipRecord) => {
    const val = v.valuation ?? 0;
    const buy = v.buyPrice ?? 0;
    const sell = v.sellPrice ?? 0;

    if (!val) return 50;

    const buyScore = Math.min(100, Math.max(0, ((val - buy) / val) * 100));
    const sellScore = Math.min(100, Math.max(0, ((sell - val) / val) * 100));

    return Math.round((buyScore + sellScore) / 2);
  });

  const avg =
    scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0;

  const message =
    avg >= 70
      ? "💰 Excellent pricing strategy."
      : avg >= 40
      ? "📊 Mixed pricing — some flips underperform."
      : "⚠️ Inefficient pricing — review valuation alignment.";

  return (
    <div className="flex flex-col">
      <p
        className="font-bold"
        style={{ color: theme.white, fontSize: 18 }}
      >
        Price Efficiency: {avg}%
      </p>

      <p className="mt-2" style={{ color: theme.muted }}>
        {message}
      </p>
    </div>
  );
}
