import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";

import CostsTab from "@/bookkeeping/vehicles/CostsTab";
import ProfitTab from "@/bookkeeping/vehicles/ProfitTab";
import EditVehicle from "@/bookkeeping/vehicles/EditVehicle";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { CosmicRibbon } from "@/components/supernova/CosmicRibbon";

import { CosmicIdentityBlock } from "@/features/dealer-ai/vehicle/CosmicIdentityBlock";
import { BuyOrWalkPanel } from "@/features/dealer-ai/buy-or-walk/BuyOrWalkPanel";
import { FlipScorePanel } from "@/features/dealer-ai/flip-score/FlipScorePanel";
import { PredictiveMaintenancePanel } from "@/features/dealer-ai/predictive/PredictiveMaintenancePanel";
import { MarketIntelligencePanel } from "@/features/dealer-ai/market/MarketIntelligencePanel";
import { DealerNegotiationPanel } from "@/features/dealer-ai/negotiation/DealerNegotiationPanel";

import { motAiEngine } from "@/engines/motAiEngine";


import type { Vehicle } from "@/types/Vehicle";

export default function VehicleOverview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const vehicleId = id as string;

  const { vehicles: invVehicles } = useInventory();
  const { purchases, sales } = useBookkeeping();

  const vehicle = invVehicles.find((v: Vehicle) => String(v.id) === vehicleId);

  const purchase = purchases.find((p) => p.vehicleId === vehicleId);
  const sale = sales.find((s) => s.vehicleId === vehicleId);

  const [tab, setTab] = useState<
    "overview" | "dealer-ai" | "costs" | "profit" | "edit"
  >("overview");

  if (!vehicle) {
    return (
      <div className="p-10 text-white">
        <h2 className="text-2xl font-bold text-red-400">Vehicle Not Found</h2>
        <p className="text-white/60 mt-2">
          This vehicle does not exist in your inventory or bookkeeping records.
        </p>
      </div>
    );
  }

  const mot = vehicle.mot;
  const ai = mot ? motAiEngine(mot, mot.history ?? []) : null;

  const motStatus = (() => {
    if (!mot?.expiry) return "Unknown";
    const exp = new Date(mot.expiry);
    const now = new Date();
    if (exp < now) return "Expired";
    const days = (exp.getTime() - now.getTime()) / 86400000;
    return days < 30 ? "Expiring Soon" : "Valid";
  })();

  const failures = mot?.history
    ? mot.history
        .filter((h) => h.result?.toUpperCase() === "FAIL")
        .flatMap((h) => h.failures ?? [])
    : [];

  const advisories = mot?.advisories ?? [];

  const dealerAIVehicle = {
    id: vehicle.id,
    title: `${vehicle.make} ${vehicle.model}`,
    buyPrice: purchase?.purchasePrice ?? vehicle.priceTrade ?? 0,
    sellPrice: sale?.salePrice ?? vehicle.priceRetail ?? 0,
    timestamp: purchase?.date ?? "",
    valuationHistory: vehicle.depreciationCurve.map((value, index) => ({
      date: `${2020 + index}-01-01`,
      value,
    })),
  };

  return (
    <div className="p-6 text-white animate-fadeIn">
      <SupernovaHeroHeader
        title={`${vehicle.make} ${vehicle.model}`}
        subtitle={`Record ID: ${vehicleId}`}
      />

      {/* TABS */}
      <div className="flex flex-wrap gap-3 mb-6">
        {["overview", "dealer-ai", "costs", "profit", "edit"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-4 py-2 rounded-xl transition font-bold ${
              tab === t
                ? "bg-yellow-400 text-black"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-10">
          <CosmicRibbon />

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Vehicle Snapshot" />
            <p><span className="text-white/60">Make:</span> {vehicle.make}</p>
            <p><span className="text-white/60">Model:</span> {vehicle.model}</p>
            <p><span className="text-white/60">Year:</span> {vehicle.year ?? "N/A"}</p>
            <p><span className="text-white/60">Mileage:</span> {vehicle.mileage ?? "N/A"}</p>
            <p><span className="text-white/60">Market Heat:</span> {vehicle.marketHeat}</p>
            <p><span className="text-white/60">Risk Score:</span> {vehicle.riskScore}</p>

            {/* ⭐ MOT SUMMARY */}
            {mot && (
              <>
                <p>
                  <span className="text-white/60">MOT Status:</span>{" "}
                  <span
                    className={
                      motStatus === "Expired"
                        ? "text-red-400"
                        : motStatus === "Expiring Soon"
                        ? "text-orange-300"
                        : "text-green-300"
                    }
                  >
                    {motStatus}
                  </span>
                </p>

                <p>
                  <span className="text-white/60">MOT Expiry:</span>{" "}
                  {mot.expiry ?? "Unknown"}
                </p>

                {ai && (
                  <p>
                    <span className="text-white/60">MOT Health Score:</span>{" "}
                    <span
                      className={
                        ai.riskLevel === "low"
                          ? "text-green-300"
                          : ai.riskLevel === "medium"
                          ? "text-yellow-300"
                          : "text-red-400"
                      }
                    >
                      {ai.healthScore}%
                    </span>
                  </p>
                )}

                <p>
                  <span className="text-white/60">Advisories:</span>{" "}
                  {advisories.length}
                </p>

                <p>
                  <span className="text-white/60">Failures:</span>{" "}
                  {failures.length}
                </p>
              </>
            )}
          </SupernovaGlowCard>

          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Purchase / Sale" />
            <p>
              <span className="text-white/60">Purchase Price:</span>{" "}
              £{(purchase?.purchasePrice ?? vehicle.priceTrade ?? 0).toLocaleString()}
            </p>
            <p>
              <span className="text-white/60">Expected Sale:</span>{" "}
              £{(sale?.salePrice ?? vehicle.priceRetail ?? 0).toLocaleString()}
            </p>
          </SupernovaGlowCard>

          <div className="flex gap-4">
            <button
              onClick={() => navigate(`/dealer/workflow/mot/${vehicleId}`)}
              className="px-4 py-2 bg-blue-500 text-black rounded-xl font-bold hover:bg-blue-400"
            >
              MOT Workflow
            </button>

            <button
              onClick={() => navigate(`/dealer-ai/recon/${vehicleId}`)}
              className="px-4 py-2 bg-green-500 text-black rounded-xl font-bold hover:bg-green-400"
            >
              Recon Workflow
            </button>
          </div>
        </div>
      )}

      {/* DEALER AI TAB */}
      {tab === "dealer-ai" && (
        <div className="space-y-10">
          <CosmicIdentityBlock vehicle={dealerAIVehicle} />
          <BuyOrWalkPanel vehicle={dealerAIVehicle} />
          <FlipScorePanel vehicle={dealerAIVehicle} />
          <PredictiveMaintenancePanel vehicle={dealerAIVehicle} />
          <MarketIntelligencePanel vehicle={dealerAIVehicle} />
          <DealerNegotiationPanel vehicle={dealerAIVehicle} />
        </div>
      )}

      {/* COSTS TAB */}
      {tab === "costs" && <CostsTab vehicleId={vehicleId} />}

      {/* PROFIT TAB */}
      {tab === "profit" && (
        <ProfitTab
          vehicleId={vehicleId}
          purchasePrice={purchase?.purchasePrice ?? vehicle.priceTrade ?? 0}
          expectedSale={sale?.salePrice ?? vehicle.priceRetail ?? 0}
        />
      )}

      {/* EDIT TAB */}
      {tab === "edit" && <EditVehicle vehicleId={vehicleId} />}
    </div>
  );
}
