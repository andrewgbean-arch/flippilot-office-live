import React from "react";
import { Link } from "react-router-dom";

export interface SupernovaCardProps {
  title: string;
  children?: React.ReactNode;
  accent?: "gold" | "blue" | "red" | "purple" | "green" | "orange";
  subtitle?: string;
  footer?: React.ReactNode;
  divider?: boolean;
  glow?: boolean;
  className?: string;

  // ⭐ NEW V12 FEATURES
  icon?: React.ReactNode;
  to?: string;
}

export default function SupernovaCard({
  title,
  children,
  accent = "gold",
  subtitle,
  footer,
  divider = true,
  glow = false,
  className = "",
  icon,
  to,
}: SupernovaCardProps) {
  const Wrapper: any = to ? Link : "div";

  const accentColor =
    accent === "gold"
      ? "text-gold"
      : accent === "blue"
      ? "text-blue-300"
      : accent === "red"
      ? "text-red-300"
      : accent === "purple"
      ? "text-purple-300"
      : accent === "green"
      ? "text-green-300"
      : "text-orange-300";

  const accentBorder =
    accent === "gold"
      ? "border-gold"
      : accent === "blue"
      ? "border-blue-400"
      : accent === "red"
      ? "border-red-400"
      : accent === "purple"
      ? "border-purple-400"
      : accent === "green"
      ? "border-green-400"
      : "border-orange-400";

  const glowShadow = glow ? "shadow-goldGlow" : "";

  return (
    <Wrapper
      to={to || ""}
      className={`
        bg-flipGlass
        ${accentBorder}
        border
        rounded-xl
        p-6
        mb-8
        backdrop-blur-md
        transition-all
        duration-300
        hover:bg-black/40
        hover:translate-y-[-2px]
        hover:shadow-[0_0_20px_rgba(255,215,0,0.25)]
        min-h-[260px]
        flex flex-col justify-between
        ${glowShadow}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        {icon && <div className={`${accentColor} text-2xl`}>{icon}</div>}
        <h2 className={`text-xl font-extrabold ${accentColor} drop-shadow-goldGlow`}>
          {title}
        </h2>
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-white/70 text-sm mb-4">{subtitle}</p>
      )}

      {/* Divider */}
      {divider && (
        <div className="h-[1px] w-full bg-gold/20 my-4" />
      )}

      {/* Content */}
      <div className="text-white/80 space-y-3 mt-2 pb-2">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="mt-4 pt-3 border-t border-gold/20">
          {footer}
        </div>
      )}
    </Wrapper>
  );
}

