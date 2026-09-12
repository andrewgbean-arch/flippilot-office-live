import React from "react";

interface EnhancementData {
  brightnessBoost?: boolean;
  sharpened?: boolean;
  backgroundCleaned?: boolean;
  noiseReduced?: boolean;
  autoCropped?: boolean;
  bestPhotoScore?: number;
}

interface Props {
  data?: EnhancementData;
  color?: string; // replaces theme.goldDeep
  muted?: string; // replaces theme.muted
}

export default function EnhancementBadges({
  data,
  color = "#FFD700",
  muted = "#888888",
}: Props) {
  if (!data) return null;

  return (
    <div className="mt-[6px] space-y-0.5">
      {data.brightnessBoost && (
        <span className="block text-xs font-medium" style={{ color }}>
          Brightness Boost
        </span>
      )}
      {data.sharpened && (
        <span className="block text-xs font-medium" style={{ color }}>
          Sharpened
        </span>
      )}
      {data.backgroundCleaned && (
        <span className="block text-xs font-medium" style={{ color }}>
          Background Cleaned
        </span>
      )}
      {data.noiseReduced && (
        <span className="block text-xs font-medium" style={{ color }}>
          Noise Reduced
        </span>
      )}
      {data.autoCropped && (
        <span className="block text-xs font-medium" style={{ color }}>
          Auto‑Cropped
        </span>
      )}

      <span className="block text-xs font-medium" style={{ color: muted }}>
        Best Photo Score: {data.bestPhotoScore}/100
      </span>
    </div>
  );
}
