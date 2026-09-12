import React, { useState } from "react";
import { motion } from "framer-motion";

import HeroHeader from "@/components/ui/HeroHeader.web";
import ShareModal from "@/components/ui/ShareModal.web";
import SparklesOverlay from "@/components/ui/SparklesOverlay.web";
import GoldParticles from "@/components/ui/GoldParticles.web"; // if you have it
import { shareText } from "@/components/ui/shareText.web";

export default function SupernovaBrainDashboard() {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  const theme = {
    background: "#0A1128",
    accent: "#FFD700",
    secondary: "#E5ECFF",
    goldSoftGlow: "rgba(255,215,0,0.35)",
  };

  const handleShare = async () => {
    // Example flip object – wire this to real data
    const flip = {
      title: "BMW 3 Series 2015",
      buyPrice: 4500,
      sellPrice: 6200,
      profit: 1700,
      roi: 37.7,
      confidence: 87,
      origin: "AutoTrader",
      description: "Strong demand, clean history, good margin.",
      isProFlip: true,
      flipScore: 92,
    };

    const msg = await shareText(flip, false);
    setShareMsg(msg);
    setShareOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-[#020617] text-white overflow-hidden">
      {/* Cosmic overlays */}
      <SparklesOverlay />
      {GoldParticles && <GoldParticles />}

      {/* Main container */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Hero header */}
        <HeroHeader
          title="Supernova Intelligence Suite"
          subtitle="Unified AI dealership command center"
          glow
          icon="🧠"
          badge="Brain Mode: HyperShift"
          action={
            <button
              onClick={handleShare}
              className="px-4 py-2 rounded-md bg-[#FFD700] text-[#0A1128] font-bold hover:bg-yellow-400 transition"
            >
              Run Full Analysis
            </button>
          }
          theme={theme}
        />

        {/* AI status ribbon */}
        <motion.div
          className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {[
            { label: "Neural Load", value: "78%" },
            { label: "Prediction Accuracy", value: "92%" },
            { label: "Risk Engine", value: "Stable" },
            { label: "Flip Scoring", value: "Active" },
            { label: "Market Scan", value: "Running" },
            { label: "Dealer Sync", value: "Online" },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white/5 border border-[#FFD700]/25 rounded-md px-3 py-2 flex flex-col"
            >
              <span className="text-xs opacity-70">{item.label}</span>
              <span className="text-sm font-semibold text-[#FFD700]">
                {item.value}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Main grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Brain grid (left 2 columns) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "Simulation Engine", desc: "Latest scenario projections and stress tests." },
              { title: "Demand Forecast", desc: "Predicted buyer interest across segments." },
              { title: "EV Shift Analysis", desc: "Impact of EV trends on stock strategy." },
              { title: "Balancing Engine", desc: "Optimal stock mix for risk vs reward." },
              { title: "Foresight Status", desc: "Long‑term prediction stability and drift." },
              { title: "Flip Scoring Core", desc: "AI scoring breakdown for current flips." },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="bg-[#020617] border border-white/10 rounded-xl p-4 shadow-[0_0_18px_rgba(15,23,42,0.8)] relative overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#FFD700]/0 via-[#FFD700]/60 to-[#FFD700]/0" />
                <h3 className="text-sm font-semibold text-[#FFD700] mb-1">
                  {card.title}
                </h3>
                <p className="text-xs text-white/80">{card.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Decision panel (right column) */}
          <motion.div
            className="bg-[#020617] border border-[#FFD700]/40 rounded-xl p-5 shadow-[0_0_25px_rgba(255,215,0,0.35)] flex flex-col gap-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="text-lg font-bold text-[#FFD700] mb-2">
              FlipPilot AI Decision Core
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="opacity-70 text-xs">Profit Prediction</span>
                <div className="text-[#FFD700] font-semibold">£1,240</div>
              </div>
              <div>
                <span className="opacity-70 text-xs">Risk Level</span>
                <div className="text-green-400 font-semibold">Low</div>
              </div>
              <div>
                <span className="opacity-70 text-xs">Confidence</span>
                <div className="text-[#FFD700] font-semibold">87%</div>
              </div>
              <div>
                <span className="opacity-70 text-xs">ROI Forecast</span>
                <div className="text-[#FFD700] font-semibold">42%</div>
              </div>
              <div>
                <span className="opacity-70 text-xs">Time to Sell</span>
                <div className="text-[#FFD700] font-semibold">3–7 days</div>
              </div>
            </div>

            <div className="mt-3 h-[90px] rounded-lg bg-gradient-to-r from-[#1e293b] via-[#0f172a] to-[#1e293b] flex items-center justify-center text-xs text-white/70">
              AI is actively balancing risk, demand, and margin across your current inventory.
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={handleShare}
                className="w-full py-2 rounded-md bg-[#FFD700] text-[#0A1128] font-bold hover:bg-yellow-400 transition"
              >
                Share Flip Summary
              </button>
              <button className="w-full py-2 rounded-md bg-white/10 text-white hover:bg-white/20 transition">
                Open Dealer Mode
              </button>
              <button className="w-full py-2 rounded-md bg-white/10 text-white hover:bg-white/20 transition">
                Open Marketplace Hub
              </button>
            </div>
          </motion.div>
        </div>

        {/* Flip timeline */}
        <motion.div
          className="mt-10 bg-[#020617] border border-white/10 rounded-xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="text-sm font-semibold text-[#FFD700] mb-3">
            Flip Timeline
          </h3>
          <div className="flex items-center justify-between text-xs text-white/80">
            {["Buy", "AI Evaluation", "Market Scan", "Price Prediction", "Sell"].map(
              (step, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div className="w-2 h-2 rounded-full bg-[#FFD700] mb-1" />
                  <span>{step}</span>
                  {i < 4 && (
                    <div className="w-full h-[1px] bg-gradient-to-r from-[#FFD700]/40 to-transparent mt-2" />
                  )}
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>

      {/* Share modal */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        message={shareMsg}
      />
    </div>
  );
}
