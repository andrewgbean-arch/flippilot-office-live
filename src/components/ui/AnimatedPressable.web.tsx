import React from "react";
import { motion } from "framer-motion";

interface AnimatedPressableProps {
  children: React.ReactNode;
  onClick?: () => void;        // ⭐ FIXED
  className?: string;
}

export default function AnimatedPressable({
  children,
  onClick,                    // ⭐ FIXED
  className = "",
}: AnimatedPressableProps) {
  return (
    <motion.button
      onClick={onClick}        // ⭐ FIXED
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={className}
      style={{
        display: "inline-block",
      }}
    >
      {children}
    </motion.button>
  );
}
