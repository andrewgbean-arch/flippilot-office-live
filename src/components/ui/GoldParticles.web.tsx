import React, { useRef, useEffect } from "react";

type GoldParticlesProps = {
  color?: string;
  count?: number;
};

export default function GoldParticles({
  color = "#FFD700",
  count = 25,
}: GoldParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ⭐ TS-safe versions
    const safeCanvas = canvas;
    const safeCtx = ctx;

    const particles = Array.from({ length: count }).map(() => ({
      x: Math.random() * safeCanvas.width,
      y: Math.random() * safeCanvas.height,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 0.4 + 0.2,
      opacity: Math.random() * 0.6 + 0.2,
    }));

    function animate() {
      safeCtx.clearRect(0, 0, safeCanvas.width, safeCanvas.height);

      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < -10) {
          p.y = safeCanvas.height + 10;
          p.x = Math.random() * safeCanvas.width;
        }

        safeCtx.globalAlpha = p.opacity;
        safeCtx.fillStyle = color;
        safeCtx.beginPath();
        safeCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        safeCtx.fill();
      });

      requestAnimationFrame(animate);
    }

    animate();
  }, [color, count]);

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    />
  );
}
