import React from "react";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import { computeRiskScore } from "@/engines/RiskEngine";

interface ProfitTabProps {
  vehicleId: string;
  purchasePrice: number;
  expectedSale: number;
}

// Low/Medium/High bands shared by all three AI Insight rows below —
// same <30/30-69/70+ style split InventoryAnalytics.tsx already uses
// for valuationConfidence, applied consistently to risk and difficulty
// too since none of them had an established banding of their own.
function band(value: number): "Low" | "Medium" | "High" {
  if (value >= 70) return "High";
  if (value >= 30) return "Medium";
  return "Low";
}

export default function ProfitTab({
  vehicleId,
  purchasePrice,
  expectedSale,
}: ProfitTabProps) {
  const { getCostsForVehicle } = useBookkeeping();
  const { vehicles } = useInventory();

  const costs = getCostsForVehicle(vehicleId) ?? [];
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const totalNet = costs.reduce((sum, c) => sum + c.netAmount, 0);

  // VAT logic:
  // reclaimable VAT = 0 (because reclaimable VAT does NOT increase cost)
  // non‑reclaimable VAT = added to cost
  const totalVat = costs.reduce(
    (sum, c) => sum + (c.vatReclaimable ? 0 : c.vatAmount),
    0
  );

  const totalGross = totalNet + totalVat;

  const realProfit = expectedSale - totalGross - purchasePrice;

  // Real per-vehicle figures — used to always show "Medium"/"Moderate"/
  // "High" for every vehicle regardless of its actual data (a leftover
  // "Module 10 will replace these" placeholder that never got replaced).
  // riskScore comes from the same RiskEngine.computeRiskScore used
  // elsewhere (Risk Hub) rather than vehicle.riskScore, since that field
  // is never actually set by any real flow in this app and stays 0.
  const riskScore = vehicle ? band(computeRiskScore(vehicle)) : "Unknown";
  const flipDifficulty = vehicle ? band(vehicle.flipDifficulty ?? 0) : "Unknown";
  const valuationConfidence = vehicle ? band(vehicle.valuationConfidence ?? 0) : "Unknown";

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <h2 className="text-xl font-semibold text-white/80">
        Profit Analysis
      </h2>

      {/* SUMMARY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* PURCHASE */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Purchase Price</h3>
          <p className="text-white text-2xl font-bold">
            £{purchasePrice.toLocaleString()}
          </p>
        </div>

        {/* EXPECTED SALE */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Expected Sale Price</h3>
          <p className="text-green-300 text-2xl font-bold">
            £{expectedSale.toLocaleString()}
          </p>
        </div>

        {/* TOTAL NET COST */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Net Cost (ex VAT)</h3>
          <p className="text-white text-2xl font-bold">
            £{totalNet.toLocaleString()}
          </p>
        </div>

        {/* TOTAL VAT */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">VAT (non‑reclaimable)</h3>
          <p className="text-yellow-300 text-2xl font-bold">
            £{totalVat.toLocaleString()}
          </p>
        </div>

        {/* TOTAL GROSS COST */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Total Cost (gross)</h3>
          <p className="text-white text-2xl font-bold">
            £{totalGross.toLocaleString()}
          </p>
        </div>

        {/* REAL PROFIT */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <h3 className="text-white/60 text-sm">Real Profit</h3>
          <p
            className={`text-2xl font-bold ${
              realProfit >= 0 ? "text-green-300" : "text-red-400"
            }`}
          >
            £{realProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* AI SECTION */}
      <div className="bg-black/40 border border-white/10 p-4 rounded-xl space-y-4">
        <h3 className="text-white/80 text-lg font-semibold">AI Insights</h3>

        <div className="flex justify-between text-white/70">
          <span>Risk Score</span>
          <span className="font-semibold">{riskScore}</span>
        </div>

        <div className="flex justify-between text-white/70">
          <span>Flip Difficulty</span>
          <span className="font-semibold">{flipDifficulty}</span>
        </div>

        <div className="flex justify-between text-white/70">
          <span>Valuation Confidence</span>
          <span className="font-semibold">{valuationConfidence}</span>
        </div>
      </div>
    </div>
  );
}
