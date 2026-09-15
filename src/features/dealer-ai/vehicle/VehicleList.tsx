import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";
import { SupernovaInput } from "@/components/supernova/SupernovaInput";

export default function VehicleList() {
  const navigate = useNavigate();
  const { vehicles, toggleFavourite, deleteVehicle } = useVehicleHistory();
  const { purchases } = useBookkeeping();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "FAV" | "SOLD" | "AVAILABLE">(
    "ALL"
  );

  /* -------------------------------------------------------
     ⭐ FILTER + SEARCH
  ------------------------------------------------------- */
  const filteredVehicles = useMemo(() => {
    let list = [...vehicles];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.mot?.reg?.toLowerCase().includes(q) ||
          v.mot?.make?.toLowerCase().includes(q) ||
          v.mot?.model?.toLowerCase().includes(q)
      );
    }

    if (filter === "FAV") {
      list = list.filter((v) => v.favourite);
    }

    if (filter === "SOLD") {
      list = list.filter((v) => v.sellPrice != null);
    }

    if (filter === "AVAILABLE") {
      list = list.filter((v) => v.sellPrice == null);
    }

    return list;
  }, [vehicles, search, filter]);

  /* -------------------------------------------------------
     ⭐ BADGE HELPERS
  ------------------------------------------------------- */
  const profitColor = (profit: number | null | undefined) => {
    if (profit == null) return "text-gray-400";
    if (profit < 0) return "text-red-500";
    if (profit < 500) return "text-yellow-400";
    return "text-green-400";
  };

  const motExpiryBadge = (expiry?: string | null) => {
    if (!expiry) return "bg-gray-600 text-white";
    const exp = new Date(expiry);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();
    const days = diff / (1000 * 60 * 60 * 24);

    if (days < 0) return "bg-red-600 text-white";
    if (days < 30) return "bg-yellow-500 text-black";
    return "bg-green-600 text-white";
  };

  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      <SupernovaHeroHeader
        title="Vehicle Inventory"
        subtitle="Motors Module • Stock Dashboard"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        {/* ⭐ Search + Filters */}
        <SupernovaSectionDivider label="Search & Filters" />

        <SupernovaGlowCard>
          <SupernovaInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search by reg, make, model, title..."
          />

          <div className="flex gap-3 mt-4">
            {["ALL", "AVAILABLE", "SOLD", "FAV"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-xl font-bold border ${
                  filter === f
                    ? "bg-yellow-400 text-black border-yellow-500"
                    : "bg-white/10 border-white/20 text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </SupernovaGlowCard>

        {/* ⭐ Vehicle List */}
        <SupernovaSectionDivider label="Vehicles" />

        {filteredVehicles.length === 0 ? (
          <p className="text-white/60 text-center text-lg">
            No vehicles match your search or filter.
          </p>
        ) : (
          filteredVehicles.map((v) => {
            const purchase = purchases.find((p) => p.vehicleId === v.id);
            const supplier = purchase?.source ?? "Unknown";

            return (
              <div
                key={v.id}
                className="cursor-pointer hover:bg-white/5 transition"
               onClick={() => navigate(`/dealer-ai/vehicle/${v.id}`)}

              >
                <SupernovaGlowCard>
                  <div className="flex gap-6">
                    
                    {/* ⭐ Thumbnail */}
                    <div className="w-40 h-28 rounded-xl overflow-hidden border border-white/20">
                      {v.images?.[0] ? (
                        <img
                          src={v.images[0]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-black/40 flex items-center justify-center text-white/40 text-sm">
                          No Image
                        </div>
                      )}
                    </div>

                    {/* ⭐ Main Info */}
                    <div className="flex-1">
                      <h2 className="text-xl font-bold">{v.title}</h2>

                      <p className="text-white/70 text-sm">
                        {v.mot?.make} {v.mot?.model} • {v.mot?.year}
                      </p>

                      <p className="text-white/50 text-sm">
                        Reg: {v.mot?.reg ?? "—"}
                      </p>

                      {/* ⭐ Supplier (REAL from bookkeeping) */}
                      <p className="text-white/60 text-sm mt-1">
                        Supplier:{" "}
                        <span className="font-bold text-white">{supplier}</span>
                      </p>

                      {/* ⭐ Profit */}
                      <p className={`${profitColor(v.profit)} font-bold mt-2`}>
                        {v.profit != null ? `£${v.profit}` : "No sale yet"}
                      </p>
                    </div>

                    {/* ⭐ Right Side Badges */}
                    <div className="flex flex-col items-end gap-3">
                      
                      {/* ⭐ MOT Badge */}
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${motExpiryBadge(
                          v.mot?.expiryDate ?? v.mot?.motExpiry
                        )}`}
                      >
                        MOT: {v.mot?.expiryDate ?? v.mot?.motExpiry ?? "—"}
                      </span>

                      {/* ⭐ Favourite Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavourite(v.id);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          v.favourite
                            ? "bg-yellow-400 text-black"
                            : "bg-white/10 text-white"
                        }`}
                      >
                        {v.favourite ? "★ Favourite" : "☆ Favourite"}
                      </button>

                      {/* ⭐ Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteVehicle(v.id);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </SupernovaGlowCard>
              </div>
            );
          })
        )}

        {/* ⭐ Add Vehicle */}
        <div className="sticky bottom-10">
          <SupernovaGlowButton
            label="Add Vehicle"
            onClick={() => navigate("/vehicles/new")}
          />
        </div>
      </div>
    </div>
  );
}
