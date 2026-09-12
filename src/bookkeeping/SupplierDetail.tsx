import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { purchases } = useBookkeeping();
  const { vehicles } = useVehicleHistory();

  const supplierName = id ?? "Unknown";

  /* -------------------------------------------------------
     ⭐ Build Supplier Stats
  ------------------------------------------------------- */
  const stats = useMemo(() => {
    const supplierPurchases = purchases.filter(
      (p) => p.supplier?.toLowerCase() === supplierName.toLowerCase()
    );

    const supplierVehicles = supplierPurchases
      .map((p) => vehicles.find((v) => v.id === p.vehicleId))
      .filter(Boolean);

    const totalSpend = supplierPurchases.reduce(
      (sum, p) => sum + (p.purchasePrice ?? 0),
      0
    );

    const totalVAT = supplierPurchases.reduce(
      (sum, p) => sum + (p.vatAmount ?? 0),
      0
    );

    const totalProfit = supplierVehicles.reduce((sum, v) => {
      if (v?.sellPrice != null && v?.buyPrice != null) {
        return sum + (v.sellPrice - v.buyPrice);
      }
      return sum;
    }, 0);

    return {
      supplierPurchases,
      supplierVehicles,
      totalSpend,
      totalVAT,
      totalProfit,
    };
  }, [purchases, vehicles, supplierName]);

  const profitColor = (profit: number) => {
    if (profit < 0) return "text-red-400";
    if (profit < 500) return "text-yellow-300";
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
      {/* ⭐ Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
      >
        <FiArrowLeft /> Back
      </button>

      <SupernovaHeroHeader
        title={`Supplier: ${supplierName}`}
        subtitle="Bookkeeping Module • Supplier Detail"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        {/* ⭐ Summary */}
        <SupernovaSectionDivider label="Supplier Summary" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-white/60 text-sm">Total Spend</p>
              <p className="text-yellow-300 font-bold text-xl">
                £{stats.totalSpend.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Total Profit</p>
              <p className={`${profitColor(stats.totalProfit)} font-bold text-xl`}>
                £{stats.totalProfit.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">VAT Impact</p>
              <p className="text-white font-bold text-xl">
                £{stats.totalVAT.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Vehicles Purchased</p>
              <p className="text-white font-bold text-xl">
                {stats.supplierVehicles.length}
              </p>
            </div>
          </div>
        </SupernovaGlowCard>

        {/* ⭐ Vehicle List */}
        <SupernovaSectionDivider label="Vehicles from this Supplier" />

        {stats.supplierVehicles.length === 0 ? (
          <p className="text-white/60 text-center text-lg">
            No vehicles found for this supplier.
          </p>
        ) : (
          stats.supplierVehicles.map((v) => (
            <div
              key={v!.id}
              className="cursor-pointer hover:bg-white/5 transition"
              onClick={() => navigate(`/vehicles/overview/${v!.id}`)}
            >
              <SupernovaGlowCard>
                <div className="flex gap-6">
                  {/* ⭐ Thumbnail */}
                  <div className="w-40 h-28 rounded-xl overflow-hidden border border-white/20">
                    {v!.images?.[0] ? (
                      <img
                        src={v!.images[0]}
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
                    <h2 className="text-xl font-bold">{v!.title}</h2>

                    <p className="text-white/70 text-sm">
                      {v!.mot?.make} {v!.mot?.model} • {v!.mot?.year}
                    </p>

                    <p className="text-white/50 text-sm">
                      Reg: {v!.mot?.reg ?? "—"}
                    </p>

                    {/* ⭐ Profit */}
                    <p className={`${profitColor(v!.profit ?? 0)} font-bold mt-2`}>
                      {v!.profit != null ? `£${v!.profit}` : "No sale yet"}
                    </p>
                  </div>

                  {/* ⭐ Right Side Badges */}
                  <div className="flex flex-col items-end gap-3">
                    {/* ⭐ MOT Badge */}
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${motExpiryBadge(
                        v!.mot?.expiryDate ?? v!.mot?.motExpiry
                      )}`}
                    >
                      MOT: {v!.mot?.expiryDate ?? v!.mot?.motExpiry ?? "—"}
                    </span>
                  </div>
                </div>
              </SupernovaGlowCard>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
