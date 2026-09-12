import React from "react";

type HudProps = {
  aiSync?: "idle" | "syncing" | "error" | "running";
  marketTrend?: "rising" | "flat" | "falling";
  brainMode?: string;
  riskLevel?: "low" | "medium" | "high";
  flipScore?: number;
  motHealth?: "good" | "watch" | "bad";
};

const badgeBase =
  "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1";

export default function SupernovaDealerHUD({
  aiSync = "idle",
  marketTrend = "rising",
  brainMode = "Pricing Brain",
  riskLevel = "medium",
  flipScore = 87,
  motHealth = "watch"
}: HudProps) {

  // ⭐ AI Sync Color Logic (Upgraded)
  const aiColor =
    aiSync === "running"
      ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/60 animate-pulse shadow-[0_0_12px_rgba(250,204,21,0.6)]"
      : aiSync === "syncing"
      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/60 animate-pulse"
      : aiSync === "error"
      ? "bg-red-500/20 text-red-300 border border-red-500/60"
      : "bg-green-500/20 text-green-300 border border-green-500/60";

  const marketColor =
    marketTrend === "rising"
      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60"
      : marketTrend === "falling"
      ? "bg-red-500/20 text-red-300 border border-red-500/60"
      : "bg-slate-500/20 text-slate-300 border border-slate-500/60";

  const riskColor =
    riskLevel === "high"
      ? "bg-red-500/20 text-red-300 border border-red-500/60"
      : riskLevel === "medium"
      ? "bg-amber-500/20 text-amber-300 border border-amber-500/60"
      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60";

  const motColor =
    motHealth === "good"
      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60"
      : motHealth === "bad"
      ? "bg-red-500/20 text-red-300 border border-red-500/60"
      : "bg-amber-500/20 text-amber-300 border border-amber-500/60";

  return (
    <div className="w-full bg-black/70 border-b border-yellow-500/30 backdrop-blur-md relative z-30">

      {/* ⭐ Particle shimmer */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.3),transparent_70%)]" />

      {/* ⭐ Supernova top glow */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-yellow-400/70 to-transparent" />

      {/* ⭐ Supernova waveform (running only) */}
      {aiSync === "running" && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-pulse" />
      )}

      <div className="px-6 py-3 flex items-center justify-between gap-4">

        {/* LEFT CLUSTER */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full border border-yellow-400/60 bg-black flex items-center justify-center shadow-[0_0_12px_rgba(250,204,21,0.6)]">
            <span className="h-4 w-4 rounded-full bg-yellow-400 animate-pulse" />
          </div>

          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.2em] text-yellow-400/80">
              Supernova Dealer HUD
            </span>
            <span className="text-sm text-white/70">
              Live AI telemetry for FlipPilot Dealer OS
            </span>
          </div>
        </div>

        {/* CENTER CLUSTER */}
        <div className="flex items-center gap-3">

          {/* AI SYNC BADGE */}
          <div className={`${badgeBase} ${aiColor}`}>
            <span className="h-2 w-2 rounded-full bg-current" />
            <span>AI Sync: {aiSync === "running" ? "Running" : aiSync}</span>
          </div>

          {/* AI LOAD METER (running only) */}
          {aiSync === "running" && (
            <div className="w-24 h-2 bg-black/40 border border-yellow-500/40 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-yellow-400 animate-pulse" />
            </div>
          )}

          {/* MARKET */}
          <div className={`${badgeBase} ${marketColor}`}>
            <span>Market: {marketTrend}</span>
          </div>

          {/* BRAIN MODE */}
          <div className={`${badgeBase} bg-blue-500/20 text-blue-300 border border-blue-500/60`}>
            <span>Brain: {brainMode}</span>
          </div>
        </div>

        {/* RIGHT CLUSTER */}
        <div className="flex items-center gap-3">
          <div className={`${badgeBase} ${riskColor}`}>
            <span>Risk: {riskLevel}</span>
          </div>

          <div className={`${badgeBase} bg-purple-500/20 text-purple-300 border border-purple-500/60`}>
            <span>FlipScore: {flipScore}/100</span>
          </div>

          <div className={`${badgeBase} ${motColor}`}>
            <span>MOT: {motHealth}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
