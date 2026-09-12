import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

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

export default function VehicleOverview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const vehicleId = id as string;

  const { purchases, sales } = useBookkeeping();
  const { vehicles } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const purchase = purchases.find((p) => p.vehicleId === vehicleId);
  const sale = sales.find((s) => s.vehicleId === vehicleId);

  const [tab, setTab] = useState<"overview" | "costs" | "profit" | "edit">(
    "overview"
  );

  if (!vehicle || !purchase) {
    return (
      <div className="p-10 text-white">
        <h2 className="text-2xl font-bold text-red-400">Vehicle Not Found</h2>
        <p className="text-white/60 mt-2">
          This vehicle does not exist in your inventory or bookkeeping records.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 text-white animate-fadeIn">

      {/* HEADER */}
      <SupernovaHeroHeader
        title={vehicle.title ?? "Vehicle Overview"}
        subtitle={`Record ID: ${vehicleId}`}
      />

      {/* TABS */}
      <div className="flex gap-4 mb-6">
        {["overview", "costs", "profit", "edit"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-4 py-2 rounded-xl transition font-bold ${
              tab === t
                ? "bg-yellow-400 text-black"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-10">

          <CosmicRibbon />

          {/* IDENTITY BLOCK */}
          <CosmicIdentityBlock vehicle={vehicle} />

          {/* PURCHASE DETAILS */}
          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Purchase Details" />
            <p><span className="text-white/60">Price:</span> £{purchase.purchasePrice.toLocaleString()}</p>
            <p><span className="text-white/60">Supplier:</span> {purchase.supplier}</p>
            <p><span className="text-white/60">Date:</span> {purchase.date}</p>
            <p><span className="text-white/60">VAT:</span> £{purchase.vatAmount.toLocaleString()}</p>
            <p><span className="text-white/60">Net:</span> £{purchase.netAmount.toLocaleString()}</p>
          </SupernovaGlowCard>

          {/* SALE DETAILS */}
          <SupernovaGlowCard>
            <SupernovaSectionDivider label="Sale Details" />
            {sale ? (
              <>
                <p><span className="text-white/60">Sale Price:</span> £{sale.salePrice.toLocaleString()}</p>
                <p><span className="text-white/60">Buyer:</span> {sale.buyer}</p>
                <p><span className="text-white/60">Date:</span> {sale.date}</p>
              </>
            ) : (
              <p className="text-white/60">No sale recorded yet.</p>
            )}
          </SupernovaGlowCard>

          {/* DEALER AI MODULES */}
          <SupernovaSectionDivider label="Dealer Intelligence" />

          <BuyOrWalkPanel vehicle={vehicle} />
          <FlipScorePanel vehicle={vehicle} />
          <PredictiveMaintenancePanel vehicle={vehicle} />
          <MarketIntelligencePanel vehicle={vehicle} />
          <DealerNegotiationPanel vehicle={vehicle} />

          {/* ACTION BUTTONS */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate(`/dealer-ai/mot/${vehicleId}`)}
              className="px-4 py-2 bg-blue-500 text-black rounded-xl font-bold hover:bg-blue-400"
            >
              MOT Timeline
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

      {/* COSTS TAB */}
      {tab === "costs" && <CostsTab vehicleId={vehicleId} />}

      {/* PROFIT TAB */}
      {tab === "profit" && (
        <ProfitTab
          vehicleId={vehicleId}
          purchasePrice={purchase.purchasePrice}
          expectedSale={sale ? sale.salePrice : purchase.purchasePrice * 1.3}
        />
      )}

      {/* EDIT TAB */}
      {tab === "edit" && <EditVehicle vehicleId={vehicleId} />}
    </div>
  );
}
