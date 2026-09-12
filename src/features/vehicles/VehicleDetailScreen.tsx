import { useParams, useNavigate } from "react-router-dom";
import DealerLayout from "@/layouts/DealerLayout";

import VehicleHeaderCard from "@/components/motors/VehicleHeaderCard";
import VehicleSummaryCard from "@/components/motors/VehicleSummaryCard";
import VehicleActionsRow from "@/components/motors/VehicleActionsRow";

import AiValuationSummary from "@/components/motors/AiValuationSummary";
import { MarketIntelligencePanel } from "@/features/dealer-ai/market/MarketIntelligencePanel";
import { FlipScorePanel } from "@/features/dealer-ai/flip-score/FlipScorePanel";

import MOTInsightsPanel from "@/components/motors/MOTInsightsPanel";
import MOTHealthScore from "@/components/motors/MOTHealthScore";
import MOTFailuresList from "@/components/motors/MOTFailuresList";
import MOTAdvisoriesList from "@/components/motors/MOTAdvisoriesList";

import { CosmicRibbon } from "@/components/supernova/CosmicRibbon";
import { CosmicIdentityBlock } from "@/features/dealer-ai/vehicle/CosmicIdentityBlock";

import { ultraInventory } from "@/dealer/ultraInventory";
import { FlipRecord, FlipRecordDefaults } from "@/features/vehicles/models/FlipRecord";
import { Vehicle } from "@/types/Vehicle";

function vehicleToFlipRecord(v: Vehicle): FlipRecord {
  return {
    ...FlipRecordDefaults,
    id: v.id,
    title: `${v.year ?? ""} ${v.make} ${v.model}`.trim(),
    buyPrice: v.priceTrade,
    sellPrice: v.priceRetail,
    make: v.make,
    model: v.model,
    mileage: v.mileage,
    images: v.images ?? null,

    valuation: v.priceRetail ?? null,

    market: {
      ...FlipRecordDefaults.market,
      demandScore: v.marketHeat,
    },

    mot: {
      ...FlipRecordDefaults.mot,
      make: v.make,
      model: v.model,
      year: v.year,
      reg: v.mot.reg ?? null,
      motExpiry: v.mot.expiry ?? null,
      advisories: v.mot.advisories ?? [],
      failures: [], // Vehicle.mot does NOT include failures
      colour: v.mot.colour ?? v.colour ?? null,
      keepers: null,
      mileage: v.mot.mileage ?? v.mileage ?? null,
    },

    flipScore: v.supernovaScore ?? null,
    notes: v.notes ?? null,
  };
}

export default function VehicleDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const vehicle: Vehicle | undefined = ultraInventory.find(
    (v: Vehicle) => v.id === id
  );

  if (!vehicle) return <div>Vehicle not found.</div>;

  const flipRecord = vehicleToFlipRecord(vehicle);

  const theme = {
    goldDeep: "#C99700",
    accent: "#FFD700",
    goldSoftGlow: "#FFEEAA",
    text: "#FFFFFF",
  };

  return (
    <DealerLayout>
      <div className="space-y-10">
        <CosmicRibbon />
        <CosmicIdentityBlock vehicle={flipRecord} />

        <VehicleHeaderCard
          year={vehicle.year ?? ""}
          make={vehicle.make}
          model={vehicle.model}
          reg={vehicle.mot.reg ?? ""}
          theme={theme}
        />

        <VehicleSummaryCard
          year={vehicle.year ?? ""}
          make={vehicle.make}
          model={vehicle.model}
          reg={vehicle.mot.reg ?? ""}
          mileage={vehicle.mileage ?? 0}
          motExpiry={vehicle.mot.expiry ?? ""}
          theme={theme}
        />

        <VehicleActionsRow />

        <div className="grid gap-8 md:grid-cols-2">
          <AiValuationSummary vehicle={flipRecord} />
          <MarketIntelligencePanel vehicle={flipRecord} />
          <FlipScorePanel vehicle={flipRecord} />
        </div>

        <div className="space-y-6">
          <MOTInsightsPanel mot={flipRecord.mot} />
          <MOTHealthScore mot={flipRecord.mot} />
          <MOTFailuresList failures={flipRecord.mot?.failures ?? []} />
          <MOTAdvisoriesList advisories={flipRecord.mot?.advisories ?? []} />

          {/* Navigate to full MOTTimeline page instead of passing props */}
          <button
            onClick={() => navigate(`/dealer-ai/mot/${vehicle.id}`)}
            className="px-4 py-2 bg-blue-500 text-black rounded font-bold"
          >
            View MOT Timeline
          </button>
        </div>

        {/* Navigate to full ReconWorkflow page instead of passing props */}
        <button
          onClick={() => navigate(`/dealer-ai/recon/${vehicle.id}`)}
          className="px-4 py-2 bg-green-500 text-black rounded font-bold"
        >
          Recon Workflow
        </button>
      </div>
    </DealerLayout>
  );
}
