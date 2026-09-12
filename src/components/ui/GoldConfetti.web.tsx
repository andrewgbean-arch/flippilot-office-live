import React, { useEffect } from "react";
import confetti from "canvas-confetti";

export default function GoldConfetti({ trigger }: { trigger: number }) {
  useEffect(() => {
    if (!trigger) return;

    confetti({
      particleCount: 80,
      spread: 60,
      startVelocity: 45,
      origin: { y: 0.6 },
      colors: ["#FFD700", "#FFCC33", "#FFB700"],
    });
  }, [trigger]);

  return null;
}
