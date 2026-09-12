import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { useInventory } from "../../context/InventoryProvider";
import { SalesProbabilityEngine } from "./SalesProbabilityEngine";

export default function SalesProbabilityScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useInventory();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return <div className="p-6 text-white">Vehicle not found.</div>;
  }

  const marketHeat = vehicle.marketHeat ?? 50;
  const demandScore = vehicle.marketHeat ?? 50;
  const priceAggression =
    vehicle.priceRetail && vehicle.priceTrade
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((vehicle.priceRetail - vehicle.priceTrade) /
                vehicle.priceRetail) *
                100
            )
          )
        )
      : 50;

  const reconQuality = 70; // simple static for now

  const result = SalesProbabilityEngine.evaluate({
    marketHeat,
    demandScore,
    priceAggression,
    reconQuality,
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
        AI Sales Probability — {vehicle.make} {vehicle.model}
      </h1>

      <div className="bg-black/40 border border-white/10 p-6 rounded-xl space-y-4">
        <div className="flex justify-between">
          <span className="text-white/60">Sale Probability:</span>
          <span className="text-yellow-300 font-bold text-xl">
            {result.probability}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Estimated Days to Sale:</span>
          <span className="text-green-300 font-bold text-xl">
            {result.daysToSale} days
          </span>
        </div>
      </div>
    </div>
  );
}

