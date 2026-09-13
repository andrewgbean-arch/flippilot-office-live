import React, { useEffect, useRef, useState } from "react";
import GlowPulseCard from "@/components/ui/GlowPulseCard.web";

export default function MarketHeatIndex() {
  const heat = Math.floor(65 + Math.random() * 25); // 65–90 range

  const [fill, setFill] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let start: number | null = null;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / 900, 1);
      const eased = progress * heat;

      setFill(eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [heat]);

  const getColor = () => {
    if (heat >= 80) return "#4CAF50"; // HOT
    if (heat >= 60) return "#FFD700"; // WARM
    return "#4FC3F7"; // COOL
  };

  const getLabel = () => {
    if (heat >= 80) return "🔥 Hot Market";
    if (heat >= 60) return "✨ Warm Market";
    return "❄ Cool Market";
  };

  return (
    <GlowPulseCard className="mt-5 p-5">
      {/* Title */}
      <p className="text-yellow-400 text-xl font-bold mb-2">
        Market Heat Index
      </p>

      {/* Label */}
      <p
        className="text-2xl font-bold mb-4"
        style={{ color: getColor() }}
      >
        {getLabel()} ({heat}/100)
      </p>

      {/* Heat Meter */}
      <div className="h-3 bg-[#111] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${fill}%`,
            backgroundColor: getColor(),
          }}
        />
      </div>

      {/* Description */}
      <p className="text-gray-300 text-sm">
        Live market activity based on demand, pricing trends, and flip potential.
      </p>
    </GlowPulseCard>
  );
}
