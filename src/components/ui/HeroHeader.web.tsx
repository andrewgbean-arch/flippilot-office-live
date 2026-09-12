import React from "react";
import { motion } from "framer-motion";

interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  glow?: boolean;
  icon?: string;
  badge?: string;
  action?: React.ReactNode;
  theme?: {
    background?: string;
    accent?: string;
    secondary?: string;
    goldSoftGlow?: string;
  };
}

export default function HeroHeader({
  title,
  subtitle,
  glow = false,
  icon,
  badge,
  action,
  theme = {},
}: HeroHeaderProps) {
  const bg = theme.background ?? "#0A1128";
  const accent = theme.accent ?? "#FFD700";
  const secondary = theme.secondary ?? "#E5ECFF";
  const underline = theme.goldSoftGlow ?? "rgba(255,215,0,0.35)";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative px-[22px] py-[34px] rounded-none"
      style={{
        backgroundColor: bg,
        boxShadow: glow ? `0 0 18px ${accent}` : "none",
        borderBottom: glow ? `2px solid ${accent}` : "none",
      }}
    >
      {/* Shimmer layer */}
      {glow && (
        <motion.div
          initial={{ opacity: 0.15 }}
          animate={{ opacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="absolute inset-0"
          style={{ backgroundColor: accent }}
        />
      )}

      {/* Top row */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="text-[32px] leading-none">{icon}</span>
          )}

          <span
            className="text-[34px] font-black"
            style={{
              color: accent,
              textShadow: `0 0 14px ${accent}`,
            }}
          >
            {title}
          </span>
        </div>

        {action && <div className="relative z-10">{action}</div>}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div
          className="text-[16px] mt-2 opacity-85 relative z-10"
          style={{ color: secondary }}
        >
          {subtitle}
        </div>
      )}

      {/* Badge */}
      {badge && (
        <div
          className="mt-3 inline-block px-3 py-1 rounded-md font-extrabold relative z-10"
          style={{
            backgroundColor: accent,
            color: bg,
          }}
        >
          {badge}
        </div>
      )}

      {/* Underline bar */}
      <div
        className="h-[4px] mt-[18px] rounded-md relative z-10"
        style={{ backgroundColor: underline }}
      />
    </motion.div>
  );
}
