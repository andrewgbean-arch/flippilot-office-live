import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { DealQualityEngine } from "../../core/deals/DealQualityEngine";
import { useInventory } from "../../context/InventoryProvider";
import { useBookkeeping } from "../../bookkeeping/BookkeepingProvider";

export default function DealQualityScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useInventory();
  const { costs } = useBookkeeping();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return <div className="p-6 text-white">Vehicle not found.</div>;
  }

  // ⭐ FIX 1 — Get all cost entries for this vehicle
  const vehicleCosts = costs.filter((c) => c.vehicleId === vehicle.id);

  // ⭐ FIX 2 — Calculate recon cost properly
  const reconCost = vehicleCosts.reduce(
    (sum, c) => sum + (c.netAmount + c.vatAmount),
    0
  );

  // ⭐ FIX 3 — Supplier comes from bookkeeping, not vehicle
  const supplier =
    vehicleCosts[0]?.supplier ??
    "Unknown";

  // ⭐ FIX 4 — Evaluate deal quality with REAL fields
  const result = DealQualityEngine.evaluate({
    purchasePrice: vehicle.priceTrade ?? 0,
    reconCost,
    expectedSale: vehicle.priceRetail ?? 0,
    supplier,
    marketHeat: vehicle.marketHeat ?? 50,
    riskScore: vehicle.riskScore ?? 50,
  });

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/70 hover:text-white transition"
      >
        <FiArrowLeft /> Back
      </button>

      <h1 className="text-2xl font-bold text-white/80">
        Deal Quality — {vehicle.make} {vehicle.model}
      </h1>

      <div className="bg-black/40 border border-white/10 p-6 rounded-xl space-y-4">
        <div className="flex justify-between">
          <span className="text-white/60">Deal Quality Score:</span>
          <span className="text-yellow-300 font-bold text-xl">
            {result.score}/100
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Profit Margin:</span>
          <span className="text-white font-semibold">
            {result.profitMargin.toFixed(1)}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Recon Efficiency:</span>
          <span className="text-white font-semibold">
            {result.efficiency.toFixed(1)}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Supplier Advantage:</span>
          <span className="text-white font-semibold">
            {result.supplierAdvantage}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Market Timing:</span>
          <span className="text-white font-semibold">
            {result.timing}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Risk Curve:</span>
          <span className="text-white font-semibold">
            {result.riskCurve}%
          </span>
        </div>
      </div>
    </div>
  );
}
