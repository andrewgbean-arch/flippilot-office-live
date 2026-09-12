import React from "react";

interface IntelligenceBarProps {
  condition: number;       // 0–100
  risk: number;            // 0–100
  flipProbability: number; // 0–100
}

export default function IntelligenceBar({
  condition,
  risk,
  flipProbability,
}: IntelligenceBarProps) {
  // ⭐ Combined intelligence score (weighted)
  const combined =
    Math.round(condition * 0.4 + (100 - risk) * 0.3 + flipProbability * 0.3);

  const barWidth = `${combined}%`;

  return (
    <div className="bg-flipGlass border border-gold rounded-xl p-4 mt-6">
      <h3 className="text-gold font-bold text-lg mb-3">Intelligence Score</h3>

      {/* ⭐ Animated Gold Bar */}
      <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-gold transition-all duration-700 ease-out"
          style={{ width: barWidth }}
        />
      </div>

      <p className="text-white/80 text-sm mt-2 font-bold">
        {combined}/100 Intelligence Rating
      </p>

      <div className="grid grid-cols-3 gap-4 mt-4 text-xs text-white/70">
        <div>
          <p className="font-bold text-white/90">Condition</p>
          <p>{condition}/100</p>
        </div>

        <div>
          <p className="font-bold text-white/90">Risk</p>
          <p>{risk}/100</p>
        </div>

        <div>
          <p className="font-bold text-white/90">Flip Chance</p>
          <p>{flipProbability}%</p>
        </div>
      </div>
    </div>
  );
}
