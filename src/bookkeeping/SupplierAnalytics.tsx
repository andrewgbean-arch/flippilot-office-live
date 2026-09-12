import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

export default function SupplierAnalytics() {
  const navigate = useNavigate();
  const { purchases } = useBookkeeping();
  const { vehicles } = useVehicleHistory();

  /* -------------------------------------------------------
     ⭐ Build Supplier Analytics
  ------------------------------------------------------- */
  const supplierStats = useMemo(() => {
    const map: Record<
      string,
      {
        supplier: string;
        totalSpend: number;
        totalProfit: number;
        avgBuy: number;
        avgSell: number;
        avgProfit: number;
        count: number;
        vatTotal: number;
      }
    > = {};

    purchases.forEach((p) => {
      const supplier = p.supplier ?? "Unknown";
      const vehicle = vehicles.find((v) => v.id === p.vehicleId);

      if (!map[supplier]) {
        map[supplier] = {
          supplier,
          totalSpend: 0,
          totalProfit: 0,
          avgBuy: 0,
          avgSell: 0,
          avgProfit: 0,
          count: 0,
          vatTotal: 0,
        };
      }

      const buy = p.purchasePrice ?? 0;
      const sell = vehicle?.sellPrice ?? null;
      const profit = sell != null ? sell - buy : 0;

      map[supplier].totalSpend += buy;
      map[supplier].totalProfit += profit;
      map[supplier].vatTotal += p.vatAmount ?? 0;
      map[supplier].count += 1;
    });

    // Compute averages
    Object.values(map).forEach((s) => {
      s.avgBuy = s.totalSpend / s.count;
      s.avgProfit = s.totalProfit / s.count;

      const supplierVehicles = purchases
        .filter((p) => p.supplier === s.supplier)
        .map((p) => vehicles.find((v) => v.id === p.vehicleId))
        .filter((v) => v?.sellPrice != null);

      if (supplierVehicles.length > 0) {
        s.avgSell =
          supplierVehicles.reduce((sum, v) => sum + (v?.sellPrice ?? 0), 0) /
          supplierVehicles.length;
      } else {
        s.avgSell = 0;
      }
    });

    return Object.values(map).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [purchases, vehicles]);

  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      <SupernovaHeroHeader
        title="Supplier Analytics"
        subtitle="Bookkeeping Module • Performance Dashboard"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        <SupernovaSectionDivider label="Supplier Performance" />

        {supplierStats.length === 0 ? (
          <p className="text-white/60 text-center text-lg">
            No supplier data available yet.
          </p>
        ) : (
          supplierStats.map((s) => (
            <div
              key={s.supplier}
              className="cursor-pointer hover:bg-white/5 transition"
              onClick={() => navigate(`/supplier/${s.supplier}`)}
            >
              <SupernovaGlowCard>
                <div className="flex justify-between items-center">
                  
                  {/* ⭐ Supplier Name */}
                  <div>
                    <h2 className="text-xl font-bold">{s.supplier}</h2>
                    <p className="text-white/60 text-sm">
                      {s.count} vehicles purchased
                    </p>
                  </div>

                  {/* ⭐ Metrics */}
                  <div className="flex gap-10">
                    <div>
                      <p className="text-white/60 text-sm">Total Spend</p>
                      <p className="text-yellow-300 font-bold">
                        £{s.totalSpend.toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">Total Profit</p>
                      <p
                        className={`font-bold ${
                          s.totalProfit < 0
                            ? "text-red-400"
                            : s.totalProfit < 1000
                            ? "text-yellow-300"
                            : "text-green-400"
                        }`}
                      >
                        £{s.totalProfit.toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">Avg Buy</p>
                      <p className="text-white font-bold">
                        £{s.avgBuy.toFixed(0)}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">Avg Sell</p>
                      <p className="text-white font-bold">
                        £{s.avgSell.toFixed(0)}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">Avg Profit</p>
                      <p
                        className={`font-bold ${
                          s.avgProfit < 0
                            ? "text-red-400"
                            : s.avgProfit < 500
                            ? "text-yellow-300"
                            : "text-green-400"
                        }`}
                      >
                        £{s.avgProfit.toFixed(0)}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">VAT Impact</p>
                      <p className="text-white font-bold">
                        £{s.vatTotal.toFixed(0)}
                      </p>
                    </div>
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
