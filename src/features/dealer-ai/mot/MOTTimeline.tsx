import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

interface MOTHistoryEntry {
  date: string;
  result: "PASS" | "FAIL";
  mileage: number | null;
  advisories: string[];
}

export default function MOTTimeline() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === id);

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

  // ⭐ Build a synthetic MOT history from real fields
  const motHistory: MOTHistoryEntry[] = (() => {
    if (!mot) return [];

    const expiry = mot.motExpiry ?? mot.expiryDate ?? null;

    const syntheticDate = expiry
      ? new Date(new Date(expiry).setFullYear(new Date(expiry).getFullYear() - 1))
          .toISOString()
          .split("T")[0]
      : "Unknown";

    const result = mot.failures && mot.failures.length > 0 ? "FAIL" : "PASS";

    return [
      {
        date: syntheticDate,
        result,
        mileage: mot.mileage ?? null,
        advisories: mot.advisories ?? [],
      },
    ];
  })();

  const expiry =
    mot?.expiryDate ??
    mot?.motExpiry ??
    null;

  const expiryBadge = (() => {
    if (!expiry) return "bg-gray-600 text-white";

    const exp = new Date(expiry);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();
    const days = diff / (1000 * 60 * 60 * 24);

    if (days < 0) return "bg-red-600 text-white";
    if (days < 30) return "bg-yellow-500 text-black";
    return "bg-green-600 text-white";
  })();

  const riskScore = (() => {
    if (!motHistory.length) return 50;

    const fails = motHistory.filter((m) => m.result === "FAIL").length;
    const advisories = motHistory.reduce(
      (sum, m) => sum + (m.advisories?.length ?? 0),
      0
    );

    return Math.min(100, fails * 20 + advisories * 5);
  })();

  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
      >
        <FiArrowLeft /> Back
      </button>

      <SupernovaHeroHeader
        title={`MOT Timeline: ${vehicle.title}`}
        subtitle="Dealer AI • MOT History & Risk Analysis"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        <SupernovaSectionDivider label="MOT Summary" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-white/60 text-sm">Expiry</p>
              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${expiryBadge}`}>
                {expiry ?? "Unknown"}
              </span>
            </div>

            <div>
              <p className="text-white/60 text-sm">Tests Recorded</p>
              <p className="text-white font-bold text-xl">{motHistory.length}</p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Risk Score</p>
              <p className="text-yellow-300 font-bold text-xl">{riskScore}/100</p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Last Mileage</p>
              <p className="text-white font-bold text-xl">{mot?.mileage ?? "—"}</p>
            </div>
          </div>
        </SupernovaGlowCard>

        <SupernovaSectionDivider label="Timeline" />

        {motHistory.length === 0 ? (
          <p className="text-white/60 text-center text-lg">No MOT history available.</p>
        ) : (
          motHistory.map((entry, index) => (
            <SupernovaGlowCard key={index}>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">{entry.date}</h2>

                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      entry.result === "PASS"
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    {entry.result}
                  </span>
                </div>

                <p className="text-white/70 text-sm">
                  Mileage: {entry.mileage ?? "—"}
                </p>

                {entry.advisories.length ? (
                  <div>
                    <p className="text-white/60 text-sm mb-1">Advisories:</p>
                    <ul className="list-disc list-inside text-white/80 text-sm">
                      {entry.advisories.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm">No advisories</p>
                )}
              </div>
            </SupernovaGlowCard>
          ))
        )}
      </div>
    </div>
  );
}
