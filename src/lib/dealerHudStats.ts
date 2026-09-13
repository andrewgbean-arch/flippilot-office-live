import type { Vehicle } from "@/types/Vehicle";
import type { MotAiResult } from "@/engines/motAiEngine";

export type DealerHudStats = {
  aiSync: "idle" | "syncing";
  marketTrend: "rising" | "flat" | "falling";
  riskLevel: "low" | "medium" | "high";
  flipScore: number;
  motHealth: "good" | "watch" | "bad";
};

const MOT_RISK_RANK: Record<"low" | "medium" | "high", number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// Real fleet-wide numbers for the Supernova HUD, computed from whatever
// IntelligenceProvider has already calculated per vehicle — this used to
// be a set of hardcoded literals passed at the layout level ("syncing",
// "rising", "medium", 87, "watch") that never changed no matter what was
// actually in the inventory.
export function computeDealerHudStats(
  vehicles: Vehicle[],
  loading: boolean,
  flipScores: Record<string, number>,
  riskScores: Record<string, number>,
  marketIntel: Record<string, { demandIndex?: number }>,
  motHealth: Record<string, MotAiResult>
): DealerHudStats {
  if (loading || vehicles.length === 0) {
    return {
      aiSync: loading ? "syncing" : "idle",
      marketTrend: "flat",
      riskLevel: "low",
      flipScore: 0,
      motHealth: "good",
    };
  }

  const ids = vehicles.map((v) => v.id);

  const avgFlipScore = Math.round(average(ids.map((id) => flipScores[id] ?? 0)));
  const avgRisk = average(ids.map((id) => riskScores[id] ?? 0));
  const avgDemand = average(ids.map((id) => marketIntel[id]?.demandIndex ?? 50));

  const marketTrend: DealerHudStats["marketTrend"] =
    avgDemand >= 65 ? "rising" : avgDemand <= 40 ? "falling" : "flat";

  const riskLevel: DealerHudStats["riskLevel"] =
    avgRisk >= 60 ? "high" : avgRisk >= 30 ? "medium" : "low";

  const worstMotRisk = ids.reduce<"low" | "medium" | "high">((worst, id) => {
    const level = motHealth[id]?.riskLevel ?? "low";
    return MOT_RISK_RANK[level] > MOT_RISK_RANK[worst] ? level : worst;
  }, "low");

  const motHealthLabel: DealerHudStats["motHealth"] =
    worstMotRisk === "high" ? "bad" : worstMotRisk === "medium" ? "watch" : "good";

  return {
    aiSync: "idle",
    marketTrend,
    riskLevel,
    flipScore: avgFlipScore,
    motHealth: motHealthLabel,
  };
}
