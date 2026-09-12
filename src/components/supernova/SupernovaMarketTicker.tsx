import React from "react";

export default function SupernovaMarketTicker() {
  return (
    <div className="
      w-full 
      overflow-hidden 
      bg-black/30 
      border border-yellow-400/20 
      rounded-xl 
      backdrop-blur-xl 
      mt-6
    ">
      <div className="
        whitespace-nowrap 
        animate-scrollTicker 
        text-yellow-300 
        font-semibold 
        py-3 
        px-4
      ">
        🚗 Market Volatility Rising • 📈 Auction Prices Up 3.2% • ⚠️ Diesel Risk Medium • 🔧 Recon Costs Rising • 💰 EV Depreciation Slowing • 🔍 Pricing Brain Syncing New Data •
      </div>

      <style>{`
        @keyframes scrollTicker {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-scrollTicker {
          animation: scrollTicker 18s linear infinite;
        }
      `}</style>
    </div>
  );
}
