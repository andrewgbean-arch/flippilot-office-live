import React from "react";
import { motion } from "framer-motion";

interface AnimatedButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
}

export default function AnimatedButton({
  children,
  onPress,
  className = "",
}: AnimatedButtonProps) {
  return (
    <motion.button
      onClick={onPress}
      whileTap={{ scale: 0.96 }}
      className={`
        bg-[#1A1A1A]
        px-4 py-3
        rounded-xl
        border-2 border-[#FFD700]
        shadow-[0_2px_8px_rgba(255,215,0,0.25)]
        w-full
        text-white font-bold text-[16px]
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
}
