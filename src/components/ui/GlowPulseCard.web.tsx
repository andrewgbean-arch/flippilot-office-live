import React from "react";
import { motion } from "framer-motion";

interface GlowPulseCardProps {
  children?: React.ReactNode;
  className?: string;
  onPress?: () => void;
}

export default function GlowPulseCard({
  children,
  className = "",
  onPress,
}: GlowPulseCardProps) {
  return (
    <motion.div
      initial={{ scale: 1, boxShadow: "0 0 12px rgba(255,215,0,0.25)" }}
      animate={{
        boxShadow: [
          "0 0 12px rgba(255,215,0,0.25)",
          "0 0 22px rgba(255,215,0,0.45)",
          "0 0 12px rgba(255,215,0,0.25)",
        ],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      whileTap={{ scale: 0.96 }}
      onClick={onPress}
      className={`
        relative rounded-xl p-[18px]
        border border-[#FFD700]/40
        bg-[#0A0A0A]
        ${className}
      `}
    >
      {/* Gold shimmer border */}
      <div className="absolute inset-0 rounded-xl pointer-events-none">
        <div className="absolute inset-0 rounded-xl border-2 border-[#FFD700]/60 opacity-60" />
      </div>

      {/* Sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-2 h-2 bg-[#FFD700] rounded-full top-3 left-6 opacity-80" />
        <div className="absolute w-2 h-2 bg-[#FFD700] rounded-full top-6 left-14 opacity-80" />
        <div className="absolute w-2 h-2 bg-[#FFD700] rounded-full top-12 left-5 opacity-80" />
      </div>

      {/* Inner card */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
