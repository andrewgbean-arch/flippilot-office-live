import React from "react";
import { motion } from "framer-motion";

export default function GoldFlashOverlay({ trigger }: { trigger: number }) {
  return (
    <motion.div
      key={trigger} // ensures animation restarts on every trigger
      initial={{ opacity: 0.35 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#FFD700",
        pointerEvents: "none",
      }}
    />
  );
}
