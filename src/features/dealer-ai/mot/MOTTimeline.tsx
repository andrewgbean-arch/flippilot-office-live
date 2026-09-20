import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { sortMotHistoryDesc } from "@/components/motors/MotTestCard";
import { motAiEngine } from "@/engines/motAiEngine";
import { motState, formatDate } from "@/dealer/inventory/vehicleListModel";

export default function MOTTimeline() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useInventory();

  const vehicle = vehicles.find((v) => String(v.id) === id);

  if (!vehicle) {
    return (
      <div className="text-white p-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
        >
          <FiArrowLeft /> Back
        </button>
        <p>Vehicle not found.</p>
      </div>
    );
  }

  const mot = vehicle.mot;
  // Newest test first, whatever order it was stored in.
  const motHistory = sortMotHistoryDesc(mot?.history ?? []);

  // Same rule as the rest of the app: an MOT is valid through its expiry day.
  const expiry = motState(mot?.expiry, new Date());
  const expiryBadge =
    expiry.kind === "expired" ? "bg-red-600 text-white"
    : expiry.kind === "soon" ? "bg-yellow-500 text-black"
    : expiry.kind === "valid" ? "bg-green-600 text-white"
    : "bg-gray-600 text-white";

  // This used to show a "Risk Score /100" (fails x 20 + advisories x 5 over
  // every test ever, and a made-up 50 when there was no history). A count of
  // failed tests is the fact behind it.
  const failedTests = motHistory.filter((h) => h.result?.toUpperCase() === "FAIL").length;
  const lastMileage = motAiEngine(mot, motHistory).basis.mileage;

  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
      >
        <FiArrowLeft /> Back
      </button>

      <SupernovaHeroHeader
        title={`MOT Timeline: ${vehicle.make} ${vehicle.model}`}
        subtitle="MOT history, newest test first"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        <SupernovaSectionDivider label="MOT Summary" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-white/60 text-sm">Expiry</p>
              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${expiryBadge}`}>
                {expiry.date ?? "No MOT date"}
              </span>
            </div>

            <div>
              <p className="text-white/60 text-sm">Tests Recorded</p>
              <p className="text-white font-bold text-xl">{motHistory.length}</p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Failed Tests</p>
              <p className="text-white font-bold text-xl">{motHistory.length ? failedTests : "—"}</p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Last Mileage</p>
              <p className="text-white font-bold text-xl">
                {lastMileage !== null ? lastMileage.toLocaleString("en-GB") : "—"}
              </p>
            </div>
          </div>
        </SupernovaGlowCard>

        <SupernovaSectionDivider label="Timeline" />

        {motHistory.length === 0 ? (
          <p className="text-white/60 text-center text-lg">No MOT history recorded for this vehicle.</p>
        ) : (
          motHistory.map((entry, index) => (
            <SupernovaGlowCard key={index}>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">{formatDate(entry.date) ?? entry.year ?? "Unknown date"}</h2>

                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      entry.result?.toUpperCase() === "PASS"
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    {entry.result?.toUpperCase() ?? "UNKNOWN"}
                  </span>
                </div>

                <p className="text-white/70 text-sm">
                  Mileage: {entry.mileage ?? "—"}
                </p>

                {entry.advisories?.length ? (
                  <div>
                    <p className="text-white/60 text-sm mb-1">Advisories:</p>
                    <ul className="list-disc list-inside text-white/80 text-sm">
                      {entry.advisories.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-white/60 text-sm">No advisories</p>
                )}
              </div>
            </SupernovaGlowCard>
          ))
        )}
      </div>
    </div>
  );
}
