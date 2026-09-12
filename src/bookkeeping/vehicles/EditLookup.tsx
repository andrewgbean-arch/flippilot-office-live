import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaInput } from "@/components/supernova/SupernovaInput";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

export default function EditLookup() {
  const navigate = useNavigate();
  const { vehicles } = useVehicleHistory();

  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();

  // Fuzzy search
  const suggestions = vehicles.filter((v) => {
    const mot = v.mot || {};

    const reg = mot.reg?.toLowerCase() || "";
    const make = mot.make?.toLowerCase() || "";
    const model = mot.model?.toLowerCase() || "";
    const year = mot.year?.toString() || "";

    return (
      reg.includes(normalized) ||
      make.includes(normalized) ||
      model.includes(normalized) ||
      year.includes(normalized)
    );
  });

  const lookup = () => {
    if (!normalized) return;
    const vehicle = suggestions[0];
    if (!vehicle) return;

    navigate(`/vehicles/edit/${vehicle.id}`);
  };

  return (
    <div className="min-h-screen bg-[#0A1128] p-10 text-white animate-fadeIn">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Edit Vehicle Lookup"
        subtitle="Search your vehicles by reg, make, model or year"
      />

      <div className="max-w-3xl mx-auto space-y-10">

        <SupernovaSectionDivider label="Search" />

        <SupernovaGlowCard>
          <SupernovaInput
            label="Search"
            value={query}
            onChange={(t) => setQuery(t.toUpperCase())}
            placeholder="Enter reg, make, model or year"
          />

          <SupernovaGlowButton
            label="Find Vehicle"
            onClick={lookup}
          />
        </SupernovaGlowCard>

        {/* Suggestions */}
        {normalized.length > 0 && (
          <>
            <SupernovaSectionDivider label="Matches" />

            <SupernovaGlowCard>
              {suggestions.length === 0 && (
                <p className="text-white/60 text-sm">No matching vehicles found.</p>
              )}

              <div className="space-y-3">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/vehicles/edit/${item.id}`)}
                    className="
                      w-full text-left bg-black/40 border border-yellow-400
                      rounded-xl p-4 hover:bg-black/60 transition
                    "
                  >
                    <p className="text-white font-bold">
                      {item.mot?.reg || "NO REG"} — {item.mot?.make} {item.mot?.model} {item.mot?.year}
                    </p>
                  </button>
                ))}
              </div>
            </SupernovaGlowCard>
          </>
        )}
      </div>
    </div>
  );
}
