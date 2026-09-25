import { formatMoney } from "@/lib/formatMoney";
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useLedgerPurchases } from "@/bookkeeping/useLedgerPurchases";
import { useInventory } from "@/context/InventoryProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";

export default function SupplierAnalytics() {
  const navigate = useNavigate();
  // Margin-scheme purchases carry no VAT, so "VAT Impact" never counts VAT that
  // does not exist (older purchases were saved with phantom VAT: see purchaseVat.ts).
  const purchases = useLedgerPurchases();
  const { vehicles } = useInventory();
  // A car's profit is only known once it has sold: the same figure the
  // Bookkeeping hub uses (sale price, less what it cost and its costs).
  const { getProfitForVehicle, getSaleForVehicle } = useBookkeeping();

  /* -------------------------------------------------------
     ⭐ Build Supplier Analytics
  ------------------------------------------------------- */
  const sourceStats = useMemo(() => {
    const map: Record<
      string,
      {
        source: string;
        totalSpend: number;
        totalProfit: number;
        avgBuy: number;
        avgSell: number;
        avgProfit: number;
        count: number;
        soldCount: number;
        saleTotal: number;
        vatTotal: number;
      }
    > = {};

    purchases.forEach((p) => {
      const source = p.source ?? "Unknown";
      const vehicle = vehicles.find((v) => v.id === p.vehicleId);

      if (!map[source]) {
        map[source] = {
          source,
          totalSpend: 0,
          totalProfit: 0,
          avgBuy: 0,
          avgSell: 0,
          avgProfit: 0,
          count: 0,
          soldCount: 0,
          saleTotal: 0,
          vatTotal: 0,
        };
      }

      const buy = p.purchasePrice ?? 0;
      const sold = getProfitForVehicle(p.vehicleId);
      const sale = getSaleForVehicle(p.vehicleId);

      map[source].totalSpend += buy;
      if (sold && sale) {
        map[source].totalProfit += sold.profit;
        map[source].saleTotal += sale.salePrice;
        map[source].soldCount += 1;
      }
      map[source].vatTotal += p.vatAmount ?? 0;
      map[source].count += 1;
    });

    // Compute averages
    Object.values(map).forEach((s) => {
      s.avgBuy = s.totalSpend / s.count;
      s.avgProfit = s.soldCount > 0 ? s.totalProfit / s.soldCount : 0;
      s.avgSell = s.soldCount > 0 ? s.saleTotal / s.soldCount : 0;

    });

    return Object.values(map).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [purchases, vehicles, getProfitForVehicle, getSaleForVehicle]);

  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      <SupernovaHeroHeader
        title="Purchase Source Analytics"
        subtitle="Bookkeeping Module • Performance Dashboard"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        <SupernovaSectionDivider label="Source Performance" />

        {sourceStats.length === 0 ? (
          <p className="text-white/60 text-center text-lg">
            No purchase data available yet.
          </p>
        ) : (
          sourceStats.map((s) => (
            <div
              key={s.source}
              className="cursor-pointer hover:bg-white/5 transition"
              onClick={() => navigate(`/supplier/${s.source}`)}
            >
              <SupernovaGlowCard>
                <div className="flex justify-between items-center">

                  {/* ⭐ Source Name */}
                  <div>
                    <h2 className="text-xl font-bold">{s.source}</h2>
                    <p className="text-white/60 text-sm">
                      {s.count} vehicles purchased
                    </p>
                  </div>

                  {/* ⭐ Metrics */}
                  <div className="flex gap-10">
                    <div>
                      <p className="text-white/60 text-sm">Total Spend</p>
                      <p className="text-yellow-300 font-bold">
                        {formatMoney(s.totalSpend)}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">Profit on cars sold ({s.soldCount})</p>
                      <p
                        className={`font-bold ${
                          s.totalProfit < 0
                            ? "text-red-400"
                            : s.totalProfit < 1000
                            ? "text-yellow-300"
                            : "text-green-400"
                        }`}
                      >
                        {formatMoney(s.totalProfit)}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">Avg Buy</p>
                      <p className="text-white font-bold">
                        {formatMoney(s.avgBuy)}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">Avg sale price</p>
                      <p className="text-white font-bold">
                        {formatMoney(s.avgSell)}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">Avg profit per car sold</p>
                      <p
                        className={`font-bold ${
                          s.avgProfit < 0
                            ? "text-red-400"
                            : s.avgProfit < 500
                            ? "text-yellow-300"
                            : "text-green-400"
                        }`}
                      >
                        {formatMoney(s.avgProfit)}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/60 text-sm">VAT Impact</p>
                      <p className="text-white font-bold">
                        {formatMoney(s.vatTotal)}
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
