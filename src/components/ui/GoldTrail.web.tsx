import React from "react";
import { motion } from "framer-motion";

export interface GoldTrailProps {
  trigger?: boolean;
}

export default function GoldTrail({ trigger }: GoldTrailProps) {
  return (
    <motion.div
      key={Number(trigger)}
 // restart animation on each trigger
      initial={{ opacity: 0, x: 0, y: 0 }}
      animate={{ opacity: 1, x: 12, y: -12 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.3,
        ease: "easeOut",
      }}
      style={{
        position: "absolute",
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: "rgba(255, 215, 0, 0.55)",
        top: -40,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
      }}
    />
  );
}
