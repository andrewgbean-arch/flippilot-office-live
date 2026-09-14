import React from "react";

interface SupernovaMarketTickerProps {
  items: string[];
}

// Was a single hardcoded string with a fabricated specific number
// ("Auction Prices Up 3.2%") — scrolled forever, identical regardless
// of what was actually in the dealer's inventory. Now takes real,
// caller-computed facts and just handles the scrolling presentation.
export default function SupernovaMarketTicker({ items }: SupernovaMarketTickerProps) {
  const text = items.length > 0 ? items.join(" • ") + " •" : "No outstanding items across your fleet •";

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
        {text}
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
