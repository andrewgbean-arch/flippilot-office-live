import React, { useMemo } from "react";
import SupernovaCard from "@/components/SupernovaCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";

import {
  FiTruck,
  FiTrendingUp,
  FiClock,
  FiStar,
  FiAlertTriangle,
  FiDollarSign,
  FiTool,
  FiList,
  FiActivity,
} from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";
import { useIntelligence } from "@/context/IntelligenceProvider";

export default function DealerMotorsDashboard() {
  // This used to be a hardcoded `const vehicles = []` literally
  // commented "TEMP DATA (replace with backend later)" — the metrics
  // logic below was already real, it just had nothing real to run on,
  // so this always rendered "0 vehicles / £0.00 / No category data."
  const { vehicles: inventory } = useInventory();
  const { flipScores } = useIntelligence();

  const vehicles = useMemo(
    () =>
      inventory.map((v) => ({
        id: v.id,
        title: `${v.make} ${v.model}`,
        buyPrice: v.buyPrice ?? v.priceTrade ?? undefined,
        sellPrice: v.sellPrice ?? undefined,
        valuation: v.priceRetail ?? undefined,
        flipScore: flipScores[v.id],
        motExpiry: v.mot?.expiry,
        category: v.make,
      })),
    [inventory, flipScores]
  );

  // ⭐ Metrics
  const metrics = useMemo(() => {
    const total = vehicles.length;

    const totalValuation = vehicles.reduce((sum, v) => {
      const val = v.valuation ?? v.sellPrice ?? v.buyPrice ?? 0;
      return sum + val;
    }, 0);

    const avgFlipScore = total
      ? Math.round(
          vehicles.reduce((sum, v) => sum + (v.flipScore ?? 0), 0) / total
        )
      : 0;

    const motRisk = vehicles.filter((v) => {
      if (!v.motExpiry) return false;
      const daysLeft =
        (new Date(v.motExpiry).getTime() - Date.now()) / 86400000;
      return daysLeft <= 30;
    }).length;

    const categories = (() => {
      const map: Record<string, number> = {};
      vehicles.forEach((v) => {
        if (!v.category) return;
        map[v.category] = (map[v.category] ?? 0) + 1;
      });
      return Object.entries(map).sort((a, b) => b[1] - a[1]);
    })();

    return { total, totalValuation, avgFlipScore, motRisk, categories };
  }, [vehicles]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto animate-fadeIn">

      <SupernovaSectionDivider label="Motors Dashboard" />

      <p className="text-white/60 mb-6">
        Live overview of dealership stock, MOT compliance, and FlipScore performance.
      </p>

      {/* ⭐ Overview */}
      <SupernovaCard title="Motors Overview" accent="gold">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white/70">
          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiTruck /> Total Vehicles
            </div>
            <p className="mt-1">{metrics.total}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiDollarSign /> Total Valuation
            </div>
            <p className="mt-1">£{metrics.totalValuation.toFixed(2)}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiStar /> Avg FlipScore
            </div>
            <p className="mt-1">{metrics.avgFlipScore}/100</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-yellow-400 font-semibold">
              <FiAlertTriangle /> MOT Risk
            </div>
            <p className="mt-1">{metrics.motRisk}</p>
          </div>
        </div>
      </SupernovaCard>

      {/* ⭐ Category Breakdown */}
      <SupernovaCard
        title="Category Breakdown"
        subtitle="Distribution of vehicles across categories."
        accent="blue"
      >
        {metrics.categories.length === 0 ? (
          <p className="text-white/50 text-sm">No category data available.</p>
        ) : (
          <div className="space-y-4">
            {metrics.categories.map(([category, count]) => (
              <div
                key={category}
                className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
              >
                <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                  <FiList /> {category}
                </div>
                <p className="text-white/70 mt-1">{count} vehicles</p>
              </div>
            ))}
          </div>
        )}
      </SupernovaCard>

      {/* ⭐ MOT Risk */}
      <SupernovaCard
        title="MOT Risk Vehicles"
        subtitle="Vehicles with MOT expiry under 30 days."
        accent="red"
      >
        {metrics.motRisk === 0 ? (
          <p className="text-white/50 text-sm">No MOT risk vehicles.</p>
        ) : (
          <div className="space-y-4">
            {vehicles
              .filter((v) => {
                if (!v.motExpiry) return false;
                const daysLeft =
                  (new Date(v.motExpiry).getTime() - Date.now()) /
                  86400000;
                return daysLeft <= 30;
              })
              .map((v) => {
                const daysLeft = Math.ceil(
                  (new Date(v.motExpiry!).getTime() - Date.now()) /
                    86400000
                );

                const val =
                  v.valuation ?? v.sellPrice ?? v.buyPrice ?? 0;

                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-lg bg-black/40 border border-yellow-500 hover:bg-black/60 transition"
                  >
                    <div className="text-yellow-400 font-semibold text-lg">
                      {v.title}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-white/70">
                      <div>
                        <FiClock className="inline mr-1 text-red-400" />
                        MOT:{" "}
                        <span className="text-red-400 font-bold">
                          {daysLeft < 0
                            ? `${Math.abs(daysLeft)} days expired`
                            : `${daysLeft} days left`}
                        </span>
                      </div>

                      <div>
                        <FiDollarSign className="inline mr-1 text-yellow-400" />
                        Valuation:{" "}
                        <span className="text-yellow-400 font-bold">
                          £{val}
                        </span>
                      </div>

                      <div>
                        <FiStar className="inline mr-1 text-blue-400" />
                        FlipScore:{" "}
                        <span className="text-blue-400 font-bold">
                          {v.flipScore ?? "?"}
                        </span>
                      </div>
                    </div>

                    <p className="text-white/60 mt-2 text-sm italic">
                      AI Insight: Vehicles with MOT under 30 days show 2× higher
                      risk of price suppression.
                    </p>
                  </div>
                );
              })}
          </div>
        )}
      </SupernovaCard>

      {/* ⭐ AI Insights — was 4 static, generic claims regardless of
          actual stock ("EV stock shows rising demand" with no EV/fuel
          data anywhere in the Vehicle model); now real counts against
          this dealer's actual vehicles. */}
      <SupernovaCard
        title="AI Motors Insights"
        subtitle="Patterns detected across your real stock, MOT, and FlipScore data."
        accent="gold"
      >
        {metrics.total === 0 ? (
          <p className="text-white/50 text-sm">Add vehicles to your inventory to see insights.</p>
        ) : (
          <ul className="list-disc pl-6 text-white/70 space-y-2">
            <li>Average FlipScore across your stock is {metrics.avgFlipScore}/100.</li>
            {metrics.motRisk > 0 && (
              <li>{metrics.motRisk} vehicle{metrics.motRisk === 1 ? "" : "s"} have an MOT due within 30 days.</li>
            )}
            {metrics.categories.length > 0 && (
              <li>{metrics.categories[0]![0]} is your best-stocked make, with {metrics.categories[0]![1]} vehicle{metrics.categories[0]![1] === 1 ? "" : "s"}.</li>
            )}
          </ul>
        )}
      </SupernovaCard>
    </div>
  );
}
