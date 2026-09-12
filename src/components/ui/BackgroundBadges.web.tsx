import React from "react";

interface BackgroundData {
  style?: "white" | "flipBlue" | "goldGlow";
}

interface Props {
  data?: BackgroundData;
  color?: string; // replaces theme.goldDeep
}

export default function BackgroundBadges({ data, color = "#FFD700" }: Props) {
  if (!data) return null;

  const label =
    data.style === "white"
      ? "White Studio"
      : data.style === "flipBlue"
      ? "FlipPilot Blue"
      : "Gold Glow";

  return (
    <div className="mt-1.5">
      <span className="text-xs font-medium" style={{ color }}>
        Background: {label}
      </span>
    </div>
  );
}
