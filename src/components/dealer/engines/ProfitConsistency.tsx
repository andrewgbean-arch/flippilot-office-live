import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type ProfitConsistencyProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function ProfitConsistency({ vehicles, theme }: ProfitConsistencyProps) {
  // Extract profit values
  const profits = vehicles
    .map((v: FlipRecord) => {
      const buy = v.buyPrice ?? 0;
      const sell = v.sellPrice ?? 0;

      if (buy === 0 && sell === 0) return null; // unsold or incomplete
      return sell - buy;
    })
    .filter((p): p is number => p !== null);

  // Average profit
  const avg =
    profits.length > 0
      ? Math.round(profits.reduce((a: number, b: number) => a + b, 0) / profits.length)
      : 0;

  // Consistency score (how close profits are to the average)
  const consistency =
    profits.length > 1 && avg !== 0
      ? Math.round(
          (1 -
            profits.reduce((a: number, b: number) => a + Math.abs(b - avg), 0) /
              (profits.length * Math.abs(avg))) *
            100
        )
      : 100;

  const message =
    consistency >= 80
      ? "📈 Very consistent profits — strong buying strategy."
      : consistency >= 50
      ? "⚠️ Mixed results — some flips strong, some weak."
      : "📉 Highly inconsistent — review sourcing and pricing.";

  return (
    <div className="flex flex-col">
      <p
        className="font-bold"
        style={{ color: theme.white, fontSize: 18 }}
      >
        Profit Consistency: {consistency}%
      </p>

      <p className="mt-2" style={{ color: theme.muted }}>
        {message}
      </p>
    </div>
  );
}
