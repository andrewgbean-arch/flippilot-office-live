import React, { useMemo } from "react";
import { motion } from "framer-motion";

const NUM_PARTICLES = 80;

export default function SparklesOverlay() {
  // Generate random starting positions once
  const particles = useMemo(() => {
    return Array.from({ length: NUM_PARTICLES }).map(() => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 2 + Math.floor(Math.random() * 3),
      driftX: Math.random() * 40 - 20, // -20 to +20
      driftY: Math.random() * 40 - 20,
      duration: 8 + Math.random() * 6, // 8–14 seconds
    }));
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: p.x, y: p.y, opacity: 0.35 }}
          animate={{
            x: p.x + p.driftX,
            y: p.y + p.driftY,
            opacity: [0.25, 0.45, 0.25],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "999px",
            backgroundColor: "#FFD700",
            boxShadow: "0 0 6px rgba(255,215,0,0.6)",
          }}
        />
      ))}
    </div>
  );
}
