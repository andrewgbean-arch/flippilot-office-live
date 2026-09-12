import React from "react";
import { motion } from "framer-motion";

export default function GoldLightning({ trigger }: { trigger: number }) {
  return (
    <motion.div
      key={trigger} // restart animation on every trigger
      initial={{ opacity: 1, scaleX: 0.2 }}
      animate={{ opacity: 0, scaleX: 1.4 }}
      transition={{
        opacity: { duration: 0.22, ease: "easeOut" },
        scaleX: { duration: 0.18, ease: "easeOut" },
      }}
      style={{
        position: "absolute",
        width: 140,
        height: 2,
        backgroundColor: "#FFD700",
        top: 12,
        left: "50%",
        marginLeft: -70,
        transformOrigin: "left center",
        pointerEvents: "none",
      }}
    />
  );
}
