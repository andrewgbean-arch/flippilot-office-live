import React from "react";

export default function RiskScoreCard({ risk }: any) {
  const bandColor =
    risk.band === "HIGH"
      ? "text-red-500"
      : risk.band === "MEDIUM"
      ? "text-yellow-400"
      : "text-green-500";

  const barColor =
    risk.band === "HIGH"
      ? "bg-red-500"
      : risk.band === "MEDIUM"
      ? "bg-yellow-400"
      : "bg-green-500";

  const trendArrow = (value: number) => {
    if (value >= 7) return "⬆️";
    if (value >= 4) return "➡️";
    return "⬇️";
  };

  return (
    <div className="
      relative p-6 rounded-2xl shadow-2xl bg-white 
      border border-gold/40 overflow-hidden
    ">
      {/* Holographic Frame */}
      <div className="
        absolute inset-0 pointer-events-none 
        bg-gradient-to-br from-gold/20 via-transparent to-gold/10
        opacity-60 blur-xl
      " />

      {/* Pulse Glow */}
      <div className="
        absolute inset-0 pointer-events-none 
        animate-pulse bg-gold/5 blur-2xl
      " />

      {/* Header */}
      <div className="text-2xl font-extrabold text-black mb-4 flex items-center gap-2">
        ⚡ Ultra Risk Intelligence
      </div>

      {/* Band */}
      <div className={`text-xl font-bold mb-4 ${bandColor}`}>
        {risk.band} Risk Deal
      </div>

      {/* Animated Total Risk Bar */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
          Total Risk: {risk.totalRisk}% {trendArrow(risk.totalRisk)}
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`${barColor} h-full transition-all duration-700`}
            style={{ width: `${risk.totalRisk}%` }}
          />
        </div>
      </div>

      {/* Sparkline Micro Chart */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-2">Risk Sparkline</div>
        <div className="flex gap-1">
          {[risk.motRisk, risk.financeRisk, risk.affordabilityRisk, risk.buyerRisk].map(
            (v, i) => (
              <div
                key={i}
                className="w-6 bg-gold/30 rounded-sm"
                style={{ height: `${v * 2.5}px` }}
              />
            )
          )}
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 text-gray-700">
        <div className="flex items-center gap-2">
          🔧 MOT Risk: {risk.motRisk}% {trendArrow(risk.motRisk)}
        </div>

        <div className="flex items-center gap-2">
          💰 Finance Risk: {risk.financeRisk}% {trendArrow(risk.financeRisk)}
        </div>

        <div className="flex items-center gap-2">
          📉 Affordability Risk: {risk.affordabilityRisk}% {trendArrow(risk.affordabilityRisk)}
        </div>

        <div className="flex items-center gap-2">
          🧍 Buyer Risk: {risk.buyerRisk}% {trendArrow(risk.buyerRisk)}
        </div>
      </div>

      {/* Flip Safety */}
      <div className="mt-6 p-3 rounded-xl bg-black/5 border border-gold/30">
        <div className="text-lg font-bold text-black mb-1">
          🔐 Flip Safety Rating
        </div>
        <div className="text-gray-700">{risk.flipSafety}</div>
      </div>
    </div>
  );
}
