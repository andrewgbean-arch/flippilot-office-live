import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type MarketHeatEngineProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function MarketHeatEngine({ vehicles, theme }: MarketHeatEngineProps) {
  const total = vehicles.length;

  const rising = vehicles.filter((v: FlipRecord) => {
    const val = v.valuation ?? 0;
    const buy = v.buyPrice ?? 0;
    return val > buy;
  }).length;

  const heat = total === 0 ? 0 : Math.round((rising / total) * 100);

  const message =
    heat >= 60
      ? "🔥 Strong market — valuations trending upward."
      : heat >= 30
      ? "⚠️ Mixed market — some flips rising, some falling."
      : "❄️ Cool market — valuations mostly flat or down.";

  return (
    <div className="flex flex-col">
      <p
        className="font-bold"
        style={{ color: theme.white, fontSize: 18 }}
      >
        Market Heat: {heat}%
      </p>

      <p className="mt-2" style={{ color: theme.muted }}>
        {message}
      </p>
    </div>
  );
}
