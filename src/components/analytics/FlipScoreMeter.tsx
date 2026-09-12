import React, { useEffect, useRef, useState } from "react";

export interface FlipScoreMeterProps {
  price: number;
  mileage: number;
  descriptionLength: number;
  small?: boolean;
  className?: string;
}

export default function FlipScoreMeter({
  price,
  mileage,
  descriptionLength,
  small,
  className = "",
}: FlipScoreMeterProps) {
  // ⭐ Compute score
  const score = Math.max(
    0,
    Math.min(
      100,
      (descriptionLength / 3) +
        (price > 0 ? Math.min(40, 4000 / price) : 0) +
        (mileage > 0 ? Math.min(30, 120000 / mileage) : 0)
    )
  );

  // ⭐ Smooth animation using requestAnimationFrame
  const [fill, setFill] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let start: number | null = null;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / 900, 1);
      const eased = progress * score; // simple ease

      setFill(eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [score]);

  const barHeight = small ? "8px" : "12px";
  const fontSize = small ? "12px" : "16px";

  return (
    <div className={`flex flex-col ${className}`}>

      {/* ⭐ Label */}
      {!small && (
        <p className="text-yellow-400 font-extrabold mb-1" style={{ fontSize }}>
          FlipScore: {Math.round(score)}/100
        </p>
      )}

      {/* ⭐ Bar */}
      <div
        className="w-full bg-[#1a1a1a] rounded-lg overflow-hidden"
        style={{ height: barHeight }}
      >
        <div
          className="bg-yellow-400 h-full rounded-lg transition-all"
          style={{ width: `${fill}%` }}
        />
      </div>

      {/* ⭐ Small mode number */}
      {small && (
        <p
          className="text-yellow-400 font-extrabold mt-1 text-center"
          style={{ fontSize }}
        >
          {Math.round(score)}
        </p>
      )}
    </div>
  );
}
