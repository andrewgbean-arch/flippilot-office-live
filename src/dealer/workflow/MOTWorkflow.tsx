import React from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useInventory } from "@/context/InventoryProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaMetricBar } from "@/components/supernova/SupernovaMetricBar";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

import { motAiEngine } from "@/engines/motAiEngine";
import MotTestCard, { sortMotHistoryDesc } from "@/components/motors/MotTestCard";

export default function MOTWorkflow() {
  const { id } = useParams();
  const vehicleId = id as string;
  const navigate = useNavigate();

  const { vehicles } = useInventory();
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!vehicle || !vehicle.mot) {
    return (
      <div className="p-10 text-white">
        <h1 className="text-2xl font-bold text-red-400">Vehicle Not Found</h1>
        <p className="text-white/60 mt-2">
          This vehicle does not exist in your inventory records.
        </p>
      </div>
    );
  }

  const mot = vehicle.mot;

  const motExpiry = mot.expiry ?? "Unknown";
  const advisories: string[] = mot.advisories ?? [];

  // Most recent test first, regardless of what order it was stored in.
  const sortedHistory = sortMotHistoryDesc(mot.history ?? []);

  // ⭐ Correct failures extraction — grouped by the test it happened at,
  // not flattened into one dateless list, so a dealer can tell whether
  // a failure is old/resolved history or something recent.
  const failedTests = sortedHistory
    .filter((h) => h.result?.toUpperCase() === "FAIL" && (h.failures?.length ?? 0) > 0)
    .map((h) => ({ date: h.date, year: h.year, mileage: h.mileage, testNumber: h.testNumber, failures: h.failures ?? [] }));
  const failureCount = failedTests.reduce((sum, t) => sum + t.failures.length, 0);

  // ⭐ AI Intelligence
  const ai = motAiEngine(mot, mot.history ?? []);

  return (
    <div className="px-6 py-10 space-y-10 text-white animate-fadeIn">

      <SupernovaHeroHeader
        title="MOT Workflow"
        subtitle={`${vehicle.make} ${vehicle.model}`}
      />

      {/* MOT STATUS */}
      <SupernovaSectionDivider label="MOT Status" />

      <SupernovaGlowCard>
        <div className="space-y-2">
          <div className="text-white font-semibold">
            MOT Expiry:{" "}
            <span className="text-yellow-300">{motExpiry}</span>
          </div>

          <div className="text-white font-semibold">
            MOT Health Score:{" "}
            <span className="text-blue-300">{ai.healthScore}%</span>
          </div>

          <div className="text-white/60 text-sm">
            Advisories: {advisories.length}
          </div>

          <div className="text-white/60 text-sm">
            Failures: {failureCount}
          </div>
        </div>
      </SupernovaGlowCard>

      {/* MOT INTELLIGENCE */}
      <SupernovaSectionDivider label="MOT Intelligence" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Pass Probability"
            value={ai.predictedPassChance}
            accent={ai.riskLevel === "low" ? "yellow" : ai.riskLevel === "medium" ? "blue" : "red"}
          />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Health Score"
            value={ai.healthScore}
            accent={ai.riskLevel === "low" ? "yellow" : ai.riskLevel === "medium" ? "blue" : "red"}
          />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Mileage Risk"
            value={ai.mileageRisk}
            accent="red"
          />
        </SupernovaGlowCard>
      </div>

      {/* ADVISORIES */}
      <SupernovaSectionDivider label="Advisories" />

      <SupernovaGlowCard>
        {advisories.length === 0 ? (
          <p className="text-white/60">No advisories recorded.</p>
        ) : (
          <ul className="space-y-2">
            {advisories.map((a: string, i: number) => (
              <li key={i} className="text-white/80">• {a}</li>
            ))}
          </ul>
        )}
      </SupernovaGlowCard>

      {/* FULL TEST HISTORY — every real MOT test on record, sorted most
          recent first, with what actually happened at each one. */}
      <SupernovaSectionDivider label="Full Test History — most recent first" />

      <SupernovaGlowCard>
        {sortedHistory.length === 0 ? (
          <p className="text-white/60">No test history on record.</p>
        ) : (
          <div>
            {sortedHistory.map((h, i) => (
              <MotTestCard key={i} h={h} />
            ))}
          </div>
        )}
      </SupernovaGlowCard>

      {/* WORKFLOW BUTTONS */}
      <SupernovaSectionDivider label="Next Steps" />

      <div className="flex gap-4">
        <SupernovaGlowButton onClick={() => navigate(`/dealer/workflow/recon/${vehicleId}`)}>
          Recon Workflow
        </SupernovaGlowButton>

        <SupernovaGlowButton onClick={() => navigate(`/dealer/workflow/pricing/${vehicleId}`)}>
          Pricing Workflow
        </SupernovaGlowButton>

        <SupernovaGlowButton onClick={() => navigate(`/dealer/workflow/photos/${vehicleId}`)}>
          Photos Workflow
        </SupernovaGlowButton>
      </div>
    </div>
  );
}
