import { useParams, useNavigate } from "react-router-dom";

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

import { CosmicIdentityBlock } from "@/features/dealer-ai/vehicle/CosmicIdentityBlock";

import { useInventory } from "@/context/InventoryProvider";
import { FlipRecord, FlipRecordDefaults } from "@/features/vehicles/models/FlipRecord";
import { Vehicle } from "@/types/Vehicle";
import { sortMotHistoryDesc } from "@/components/motors/MotTestCard";

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
      motStatus: v.mot.motStatus?.toLowerCase() ?? null,
      advisories: v.mot.advisories ?? [],
      failures: latestFailures(v),
      colour: v.mot.colour ?? v.colour ?? null,
      keepers: null,
      mileage: v.mot.mileage ?? v.mileage ?? null,
    },

    flipScore: v.supernovaScore ?? null,
    // No standalone AI valuation model exists yet — reuse the real,
    // already-computed FlipScore as a stand-in confidence figure rather
    // than a hardcoded constant.
    aiValuation: {
      ...FlipRecordDefaults.aiValuation,
      estimatedValue: v.priceRetail ?? null,
      confidence: v.supernovaScore ?? null,
    },
    notes: v.notes ?? null,
  };
}

function latestFailures(v: Vehicle): string[] {
  const latest = sortMotHistoryDesc(v.mot.history ?? [])[0];
  return latest?.result?.toUpperCase() === "FAIL" ? latest.failures ?? [] : [];
}

export default function VehicleDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useInventory();

  const vehicle: Vehicle | undefined = vehicles.find(
    (v: Vehicle) => v.id === id
  );

  if (!vehicle) return <div>Vehicle not found.</div>;

  const flipRecord = vehicleToFlipRecord(vehicle);

  const failedTests = sortMotHistoryDesc(vehicle.mot.history ?? [])
    .filter((h) => h.result?.toUpperCase() === "FAIL" && (h.failures?.length ?? 0) > 0)
    .map((h) => ({
      ...(h.date ? { date: h.date } : {}),
      ...(h.year !== undefined ? { year: h.year } : {}),
      mileage: h.mileage ?? null,
      testNumber: h.testNumber ?? null,
      failures: h.failures ?? [],
    }));

  const theme = {
    goldDeep: "#C99700",
    accent: "#FFD700",
    goldSoftGlow: "#FFEEAA",
    text: "#FFFFFF",
  };

  return (
      <div className="space-y-10">
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
          <MOTFailuresList failedTests={failedTests} />
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
          onClick={() => navigate(`/dealer/workflow/recon/${vehicle.id}`)}
          className="px-4 py-2 bg-green-500 text-black rounded font-bold"
        >
          Recon Workflow
        </button>
      </div>
  );
}
