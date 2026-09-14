import React from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "@/context/InventoryProvider";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import { motAiEngine } from "@/engines/motAiEngine";
import { getUlezStatus } from "@/features/vehicles/utils/ulezUtils";


export default function VehicleList() {
  const { vehicles } = useInventory();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A1128] p-10 text-white animate-fadeIn">

      <SupernovaHeroHeader
        title="Vehicle List"
        subtitle="All vehicles currently in your inventory"
      />

      <SupernovaSectionDivider label="Inventory" />

      <div className="max-w-3xl mx-auto space-y-4">
        {vehicles.map((v) => {
          const mot = v.mot;

          // ⭐ MOT quick indicators
          let motStatus = "Unknown";
          let motExpiry = mot?.expiry ?? null;

          if (motExpiry) {
            const exp = new Date(motExpiry);
            const now = new Date();

            if (exp < now) motStatus = "Expired";
            else {
              const days = (exp.getTime() - now.getTime()) / 86400000;
              motStatus = days < 30 ? "Expiring Soon" : "Valid";
            }
          }

          const ai = mot ? motAiEngine(mot, mot.history ?? []) : null;
          const ulez = getUlezStatus(mot?.fuelType, mot?.euroStatus);

          return (
            <SupernovaGlowCard key={v.id}>
              <h2 className="text-yellow-400 font-bold text-xl mb-2">
                {v.make} {v.model}
              </h2>

              <div className="text-white/70 text-sm space-y-1">
                <p>
                  <span className="text-yellow-400 font-semibold">Year:</span>{" "}
                  {v.year ?? "N/A"}
                </p>
                <p>
                  <span className="text-yellow-400 font-semibold">Mileage:</span>{" "}
                  {v.mileage ?? "N/A"} miles
                </p>
                <p>
                  <span className="text-yellow-400 font-semibold">Status:</span>{" "}
                  {v.status}
                </p>

                {/* ⭐ MOT Summary */}
                {mot && (
                  <>
                    <p>
                      <span className="text-yellow-400 font-semibold">MOT:</span>{" "}
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

                    <p className="text-white/60 text-xs">
                      Expiry: {motExpiry ?? "Unknown"}
                    </p>

                    <p className="text-xs">
                      <span
                        className={
                          ulez.status === "compliant"
                            ? "text-green-300"
                            : ulez.status === "non-compliant"
                            ? "text-red-400"
                            : "text-white/40"
                        }
                      >
                        {ulez.label}
                      </span>
                    </p>

                    {ai && (
                      <p className="text-white/60 text-xs">
                        Health Score:{" "}
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
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => navigate(`/dealer/inventory/${v.id}`)}
                  className="flex-1 bg-yellow-400 text-black font-bold rounded-xl py-3 hover:bg-yellow-300 transition"
                >
                  View Overview
                </button>

                <button
                  onClick={() => navigate(`/dealer/workflow/mot/${v.id}`)}
                  className="flex-1 bg-black/40 border border-yellow-400 text-white rounded-xl py-3 font-bold hover:bg-black/60 transition"
                >
                  MOT Workflow
                </button>
              </div>
            </SupernovaGlowCard>
          );
        })}
      </div>
    </div>
  );
}

