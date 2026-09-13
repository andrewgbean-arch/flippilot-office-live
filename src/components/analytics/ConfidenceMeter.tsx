import React from "react";
import GlowPulseCard from "../ui/GlowPulseCard.web";

export default function ConfidenceMeter({ score }: { score: number }) {
  const width = Math.max(10, Math.min(score, 100));

  const getColor = () => {
    if (score >= 75) return "#4CAF50"; // green
    if (score >= 55) return "#FFD700"; // gold
    return "#FF5252"; // red
  };

  return (
    <GlowPulseCard className="mt-5 p-5">
      {/* Title */}
      <p className="text-yellow-400 font-bold text-lg mb-2">
        Confidence Meter
      </p>

      {/* Score Number */}
      <p
        className="font-bold text-2xl mb-3"
        style={{ color: getColor() }}
      >
        {score}/100
      </p>

      {/* Bar */}
      <div className="h-2 bg-[#222] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${width}%`,
            backgroundColor: getColor(),
          }}
        />
      </div>

      {/* Description */}
      <p className="text-gray-300 text-sm">
        Higher confidence means stronger deal stability and lower risk.
      </p>
    </GlowPulseCard>
  );
}
