import React, { ReactNode } from "react";

interface SupernovaGlowButtonProps {
  children?: ReactNode;
  label?: string;
  onClick?: () => void;
  className?: string;
}

export function SupernovaGlowButton({
  children,
  label,
  onClick,
  className = "",
}: SupernovaGlowButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-5 py-3 rounded-xl font-bold 
        bg-gradient-to-r from-yellow-400 to-orange-400 
        text-black shadow-[0_0_20px_rgba(255,215,0,0.6)]
        hover:shadow-[0_0_30px_rgba(255,215,0,0.8)]
        hover:scale-[1.03] active:scale-[0.97]
        transition-all duration-200
        ${className}
      `}
    >
      {children ?? label}
    </button>
  );
}
