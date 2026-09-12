import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type FlipTimeAnalyzerProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function FlipTimeAnalyzer({ vehicles, theme }: FlipTimeAnalyzerProps) {
  const durations = vehicles
    .map((v: FlipRecord) => {
      const start = v.buyDate;
      const end = v.sellDate;

      if (!start || !end) return null;

      const startDate = new Date(start).getTime();
      const endDate = new Date(end).getTime();

      if (isNaN(startDate) || isNaN(endDate)) return null;

      const days = (endDate - startDate) / (1000 * 60 * 60 * 24);
      return Math.round(days);
    })
    .filter((d): d is number => d !== null);

  const avg =
    durations.length > 0
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : 0;

  const message =
    avg <= 14
      ? "⚡ Fast flips — great turnover."
      : avg <= 30
      ? "📊 Moderate flip speed."
      : "🐌 Slow flips — review pricing or sourcing.";

  return (
    <div className="flex flex-col">
      <p
        className="font-bold"
        style={{ color: theme.white, fontSize: 18 }}
      >
        Avg Flip Time: {avg} days
      </p>

      <p className="mt-2" style={{ color: theme.muted }}>
        {message}
      </p>
    </div>
  );
}
