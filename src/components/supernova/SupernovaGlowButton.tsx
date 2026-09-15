import React, { ReactNode } from "react";

interface SupernovaGlowButtonProps {
  children?: ReactNode;
  label?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function SupernovaGlowButton({
  children,
  label,
  onClick,
  className = "",
  disabled = false,
}: SupernovaGlowButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-5 py-3 rounded-xl font-bold
        bg-gradient-to-r from-yellow-400 to-orange-400
        text-black shadow-[0_0_20px_rgba(255,215,0,0.6)]
        hover:shadow-[0_0_30px_rgba(255,215,0,0.8)]
        hover:scale-[1.03] active:scale-[0.97]
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${className}
      `}
    >
      {children ?? label}
    </button>
  );
}
