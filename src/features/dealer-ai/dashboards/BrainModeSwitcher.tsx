import React from "react";

export type FlipPilotMode =
  | "dealer"
  | "group"
  | "oem"
  | "global"
  | "planet";

type BrainModeSwitcherProps = {
  mode: FlipPilotMode;
  onChange: (m: FlipPilotMode) => void;
};

export default function BrainModeSwitcher({ mode, onChange }: BrainModeSwitcherProps) {
  const modes: FlipPilotMode[] = ["dealer", "group", "oem", "global", "planet"];

  return (
    <div className="flex gap-3">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-4 py-2 rounded-lg border ${
            mode === m
              ? "bg-gold text-black border-gold"
              : "bg-black/40 text-white border-white/20"
          }`}
        >
          {m.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
