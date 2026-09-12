import React from "react";

export function SupernovaButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="
        w-full bg-yellow-400 text-black font-bold rounded-lg py-3
        hover:bg-yellow-300 transition shadow-[0_0_12px_rgba(255,215,0,0.4)]
      "
    >
      {label}
    </button>
  );
}
