import React from "react";
import { Theme } from "@/styles/theme";

interface BreakdownProps {
  theme: Theme;
  breakdown: {
    profit: number;
    profitMargin: number;
    demandScore: number;
    rarity: string;
    condition: string;
    sellSpeed: string;
  };
  onClose: () => void;
}

export default function BreakdownModal({ theme, breakdown, onClose }: BreakdownProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: theme.goldDeep }}>
          Flip Breakdown
        </h2>

        <div className="space-y-2 text-black">
          <div>Profit: £{breakdown.profit}</div>
          <div>Margin: {breakdown.profitMargin.toFixed(1)}%</div>
          <div>Demand Score: {breakdown.demandScore}</div>
          <div>Rarity: {breakdown.rarity}</div>
          <div>Condition: {breakdown.condition}</div>
          <div>Sell Speed: {breakdown.sellSpeed}</div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2 rounded bg-yellow-500 text-black font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
}
