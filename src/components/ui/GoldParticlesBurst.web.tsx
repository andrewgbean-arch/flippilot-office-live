// src/components/ui/GoldParticlesBurst.web.tsx
import React from "react";
import { motion } from "framer-motion";

type GoldParticlesBurstProps = {
  trigger: boolean;
};

export default function GoldParticlesBurst({ trigger }: GoldParticlesBurstProps) {
  if (!trigger) return null;

  const particles = [0, 1, 2];

  return (
    <>
      {particles.map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, x: 0, y: 0 }}
          animate={{
            opacity: 0,
            y: -20 - i * 6,
            x: (i - 1) * 10,
          }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            position: "absolute",
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#FFD700",
          }}
        />
      ))}
    </>
  );
}
