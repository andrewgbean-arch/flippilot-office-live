import React from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useInventory } from "@/context/InventoryProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaMetricBar } from "@/components/supernova/SupernovaMetricBar";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

import { motAiEngine, MOT_RULE_OF_THUMB } from "@/engines/motAiEngine";
import { motState, formatDate } from "@/dealer/inventory/vehicleListModel";
import MotTestCard, { sortMotHistoryDesc } from "@/components/motors/MotTestCard";
import { useAuth } from "@/context/AuthContext";
import { canSeeMoney } from "@/lib/permissions";

const STATE_COLOUR = {
  expired: "text-red-400",
  soon: "text-yellow-300",
  valid: "text-emerald-300",
  unknown: "text-white/60",
} as const;

const OUTLOOK_LABEL = { good: "Good", fair: "Fair", poor: "Poor" } as const;

export default function MOTWorkflow() {
  // Recon is a money page (its costs go in the books): owner, managers, finance.
  const canRecon = canSeeMoney(useAuth().user);
  const { id } = useParams();
  const vehicleId = id as string;
  const navigate = useNavigate();

  const { vehicles } = useInventory();
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (vehicle && !vehicle.mot) {
    return (
      <div className="p-10 text-white">
        <h1 className="text-2xl font-bold text-yellow-300">No MOT record yet</h1>
        <p className="text-white/70 mt-2">
          There's no MOT information for this car. Look its registration up to fetch its MOT history.
        </p>
        <SupernovaGlowButton onClick={() => navigate("/dealer/inventory/mot-lookup")}>MOT Lookup</SupernovaGlowButton>
      </div>
    );
  }

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

  // A blank expiry used to print as an empty gap; say so instead.
  const expiryState = motState(mot.expiry, new Date());
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

  // Rule-of-thumb read of the record above (see engines/motAiEngine.ts).
  const ai = motAiEngine(mot, mot.history ?? []);
  const scoreAccent = ai.riskLevel === "low" ? "yellow" : ai.riskLevel === "medium" ? "blue" : "red";

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
            <span className={STATE_COLOUR[expiryState.kind]}>
              {expiryState.date ?? "Not recorded"}
            </span>
            {expiryState.kind !== "unknown" && (
              <span className={`ml-2 text-sm ${STATE_COLOUR[expiryState.kind]}`}>
                {expiryState.label}
              </span>
            )}
          </div>

          {ai.hasData ? (
            <>
              <div className="text-white/60 text-sm">
                Advisories: {advisories.length}
              </div>

              <div className="text-white/60 text-sm">
                Failed tests on record: {ai.basis.failedTests} (failure items listed: {failureCount})
              </div>
            </>
          ) : (
            <>
              <p className="text-white/80 text-sm">
                No MOT data is recorded for this vehicle, so there is no expiry date, advisory or failure
                to show. Look up its registration to fetch the real record.
              </p>
              <SupernovaGlowButton onClick={() => navigate("/dealer/inventory/mot-lookup")}>
                Look up MOT
              </SupernovaGlowButton>
            </>
          )}
        </div>
      </SupernovaGlowCard>

      {/* RULE-OF-THUMB CHECK. It used to show a "Pass Probability", a "Health
          Score" and a "Mileage Risk" bar: 96% for a car with no MOT data at
          all, next to "Failures: 3". It now says when there is no data, and
          otherwise says what the number is worked out from. */}
      <SupernovaSectionDivider label="MOT check (rule of thumb)" />

      {!ai.hasData ? (
        <SupernovaGlowCard>
          <p className="text-white/70">No MOT data, so nothing to check.</p>
        </SupernovaGlowCard>
      ) : ai.basis.expired ? (
        <SupernovaGlowCard>
          <p className="text-red-400 font-semibold mb-1">MOT expired</p>
          <p className="text-white/70 text-sm">{ai.nextTestRisk}</p>
        </SupernovaGlowCard>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SupernovaGlowCard>
              <SupernovaMetricBar
                label="Rule-of-thumb score"
                value={ai.healthScore ?? 0}
                accent={scoreAccent}
              />
            </SupernovaGlowCard>

            <SupernovaGlowCard>
              <div className="text-white/70 text-sm mb-1">Next MOT: rough outlook</div>
              <div className="text-white font-bold text-xl">
                {ai.passOutlook ? OUTLOOK_LABEL[ai.passOutlook] : "No outlook"}
              </div>
              <div className="text-white/50 text-xs mt-1">A rough guide, not a measured chance of passing.</div>
            </SupernovaGlowCard>

            <SupernovaGlowCard>
              <div className="text-white/70 text-sm mb-1">Latest test on record</div>
              {ai.basis.latestTest ? (
                <div className="text-white text-sm">
                  {ai.basis.latestTest.result ?? "Result unknown"}
                  {ai.basis.latestTest.date ? ` on ${formatDate(ai.basis.latestTest.date) ?? ai.basis.latestTest.date}` : ""}
                  {ai.basis.latestTest.mileage !== null ? `, ${ai.basis.latestTest.mileage.toLocaleString("en-GB")} miles` : ""}
                </div>
              ) : (
                <div className="text-white/60 text-sm">No test history on record.</div>
              )}
            </SupernovaGlowCard>
          </div>

          <p className="text-white/70 text-sm">{ai.summary}</p>
          <p className="text-white/50 text-xs">{MOT_RULE_OF_THUMB}</p>
        </>
      )}

      {/* ADVISORIES */}
      <SupernovaSectionDivider label="Advisories" />

      <SupernovaGlowCard>
        {!ai.hasData ? (
          <p className="text-white/60">No MOT data recorded.</p>
        ) : advisories.length === 0 ? (
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
        {canRecon && (
          <SupernovaGlowButton onClick={() => navigate(`/dealer/workflow/recon/${vehicleId}`)}>
            Recon Workflow
          </SupernovaGlowButton>
        )}

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
