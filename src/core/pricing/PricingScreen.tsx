import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { useInventory } from "../../context/InventoryProvider";
import { useBookkeeping } from "../../bookkeeping/BookkeepingProvider";
import { PricingAIEngine } from "../../core/pricing/PricingAIEngine";

export default function PricingScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useInventory();
  const { costs } = useBookkeeping();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return <div className="p-6 text-white">Vehicle not found.</div>;
  }

  // ⭐ Recon cost from bookkeeping
  const vehicleCosts = costs.filter((c) => c.vehicleId === vehicle.id);
  const reconCost = vehicleCosts.reduce(
    (sum, c) => sum + (c.netAmount + c.vatAmount),
    0
  );

  // ⭐ Supplier advantage (simple version)
  const supplierAdvantage =
    vehicleCosts[0]?.supplier === "BCA"
      ? 80
      : vehicleCosts[0]?.supplier === "Copart"
      ? 70
      : 60;

  // ⭐ Demand score (simple version)
  const demandScore = vehicle.marketHeat ?? 50;

  const result = PricingAIEngine.evaluate({
    basePrice: vehicle.priceRetail ?? vehicle.priceTrade ?? 0,
    reconCost,
    marketHeat: vehicle.marketHeat ?? 50,
    volatility: vehicle.marketHeat ?? 50,

    supplierAdvantage,
    demandScore,
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
        AI Retail Pricing — {vehicle.make} {vehicle.model}
      </h1>

      <div className="bg-black/40 border border-white/10 p-6 rounded-xl space-y-4">
        <div className="flex justify-between">
          <span className="text-white/60">Recommended Retail Price:</span>
          <span className="text-green-300 font-bold text-xl">
            £{result.recommendedPrice.toLocaleString()}
          </span>
        </div>

        <div className="pt-4 text-white/70 text-sm">
          <div className="flex justify-between">
            <span>Market Adjustment:</span>
            <span>£{result.adjustments.market}</span>
          </div>
          <div className="flex justify-between">
            <span>Volatility Adjustment:</span>
            <span>£{result.adjustments.volatility}</span>
          </div>
          <div className="flex justify-between">
            <span>Recon Adjustment:</span>
            <span>£{result.adjustments.recon}</span>
          </div>
          <div className="flex justify-between">
            <span>Supplier Advantage:</span>
            <span>£{result.adjustments.supplier}</span>
          </div>
          <div className="flex justify-between">
            <span>Demand Curve:</span>
            <span>£{result.adjustments.demand}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
