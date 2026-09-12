import React from "react";

export function CosmicRibbon() {
  return (
    <div className="w-full py-4 mb-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 rounded-xl shadow-lg border border-white/10 relative overflow-hidden">

      {/* Glow */}
      <div className="absolute inset-0 bg-white/10 blur-xl opacity-20" />

      {/* Particles */}
      <div className="absolute inset-0 animate-pulse opacity-30">
        <div className="absolute top-0 left-0 w-1 h-1 bg-yellow-300 rounded-full animate-ping" />
        <div className="absolute bottom-0 right-0 w-1 h-1 bg-orange-300 rounded-full animate-ping" />
      </div>

      {/* Text */}
      <div className="relative z-10 text-center">
        <p className="text-black font-extrabold text-2xl tracking-wide drop-shadow-lg">
          SUPER NOVA · VEHICLE INTELLIGENCE
        </p>
        <p className="text-black/70 text-sm font-semibold tracking-widest">
          FlipPilot Dealer AI · V12 Cosmic Engine
        </p>
      </div>
    </div>
  );
}
