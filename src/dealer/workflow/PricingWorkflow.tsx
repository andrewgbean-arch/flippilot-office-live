import React from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaMetricBar } from "@/components/supernova/SupernovaMetricBar";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

export default function PricingWorkflow() {
  const { id } = useParams();
  const vehicleId = id as string;
  const navigate = useNavigate();

  const { vehicles } = useVehicleHistory();
  const { costs, purchases, sales } = useBookkeeping();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const purchase = purchases.find((p) => p.vehicleId === vehicleId);
  const sale = sales.find((s) => s.vehicleId === vehicleId);

  const vehicleCosts = costs.filter((c) => c.vehicleId === vehicleId);
  const reconCost = vehicleCosts.reduce((sum, c) => sum + c.amount, 0);

  if (!vehicle || !purchase) {
    return (
      <div className="p-10 text-white">
        <h1 className="text-2xl font-bold text-red-400">Vehicle Not Found</h1>
        <p className="text-white/60 mt-2">
          This vehicle does not exist in your inventory or bookkeeping records.
        </p>
      </div>
    );
  }

  // ⭐ AI Valuation Engine (simple placeholder logic)
  const retailValuation = purchase.purchasePrice * 1.35;
  const tradeValuation = purchase.purchasePrice * 1.15;
  const marketHeat = 72;
  const demandScore = 81;
  const competitionScore = 64;

  const expectedProfitRetail = retailValuation - purchase.purchasePrice - reconCost;
  const expectedProfitTrade = tradeValuation - purchase.purchasePrice - reconCost;

  return (
    <div className="px-6 py-10 space-y-10 text-white animate-fadeIn">

      <SupernovaHeroHeader
        title="Pricing Workflow"
        subtitle={vehicle.title ?? `${vehicle.make} ${vehicle.model}`}
      />

      {/* AI VALUATION */}
      <SupernovaSectionDivider label="AI Valuation Engine" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Retail Valuation"
            value={Math.min(100, retailValuation / 50)}
            color="#4ade80"
          />
          <p className="text-green-300 font-bold mt-2">
            £{retailValuation.toLocaleString()}
          </p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Trade Valuation"
            value={Math.min(100, tradeValuation / 50)}
            color="#60a5fa"
          />
          <p className="text-blue-300 font-bold mt-2">
            £{tradeValuation.toLocaleString()}
          </p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Market Heat"
            value={marketHeat}
            color="#facc15"
          />
        </SupernovaGlowCard>
      </div>

      {/* MARKET INTELLIGENCE */}
      <SupernovaSectionDivider label="Market Intelligence" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Demand Score"
            value={demandScore}
            color="#4ade80"
          />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Competitiveness"
            value={competitionScore}
            color="#60a5fa"
          />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Days to Sell"
            value={Math.max(10, 100 - demandScore)}
            color="#f87171"
          />
        </SupernovaGlowCard>
      </div>

      {/* PROFIT PROJECTION */}
      <SupernovaSectionDivider label="Profit Projection" />

      <SupernovaGlowCard>
        <div className="space-y-4">
          <div className="text-white font-semibold">
            Retail Profit:{" "}
            <span className="text-green-400">
              £{expectedProfitRetail.toLocaleString()}
            </span>
          </div>

          <div className="text-white font-semibold">
            Trade Profit:{" "}
            <span className="text-blue-400">
              £{expectedProfitTrade.toLocaleString()}
            </span>
          </div>

          <div className="text-white/60 text-sm">
            Recon Cost Impact: £{reconCost.toLocaleString()}
          </div>
        </div>
      </SupernovaGlowCard>

      {/* WORKFLOW BUTTONS */}
      <SupernovaSectionDivider label="Next Steps" />

      <div className="flex gap-4">
        <SupernovaGlowButton
          label="Recon Workflow"
          onClick={() => navigate(`/dealer/workflow/recon/${vehicleId}`)}
        />

        <SupernovaGlowButton
          label="Photos Workflow"
          onClick={() => navigate(`/dealer/workflow/photos/${vehicleId}`)}
        />

        <SupernovaGlowButton
          label="MOT Workflow"
          onClick={() => navigate(`/dealer/workflow/mot/${vehicleId}`)}
        />
      </div>
    </div>
  );
}
