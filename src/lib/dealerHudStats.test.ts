import { describe, it, expect } from "vitest";
import { computeDealerHudStats } from "./dealerHudStats";
import type { Vehicle } from "@/types/Vehicle";

function mockVehicle(id: string): Vehicle {
  return { id } as Vehicle;
}

describe("computeDealerHudStats", () => {
  it("returns honest zero/idle defaults for an empty inventory, not fabricated numbers", () => {
    const result = computeDealerHudStats([], false, {}, {}, {}, {});
    expect(result.flipScore).toBe(0);
    expect(result.marketTrend).toBe("flat");
    expect(result.riskLevel).toBe("low");
    expect(result.aiSync).toBe("idle");
  });

  it("shows syncing while loading, regardless of vehicle count", () => {
    const result = computeDealerHudStats([mockVehicle("v1")], true, {}, {}, {}, {});
    expect(result.aiSync).toBe("syncing");
  });

  it("averages real flip scores across the fleet, not a hardcoded 87", () => {
    const vehicles = [mockVehicle("v1"), mockVehicle("v2")];
    const flipScores = { v1: 40, v2: 60 };
    const result = computeDealerHudStats(vehicles, false, flipScores, {}, {}, {});
    expect(result.flipScore).toBe(50);
  });

  it("classifies market trend from real demand index, not a hardcoded 'rising'", () => {
    const vehicles = [mockVehicle("v1")];
    const rising = computeDealerHudStats(vehicles, false, {}, {}, { v1: { demandIndex: 80 } }, {});
    const falling = computeDealerHudStats(vehicles, false, {}, {}, { v1: { demandIndex: 20 } }, {});
    const flat = computeDealerHudStats(vehicles, false, {}, {}, { v1: { demandIndex: 50 } }, {});
    expect(rising.marketTrend).toBe("rising");
    expect(falling.marketTrend).toBe("falling");
    expect(flat.marketTrend).toBe("flat");
  });

  it("classifies risk level from real average risk score, not a hardcoded 'medium'", () => {
    const vehicles = [mockVehicle("v1")];
    const low = computeDealerHudStats(vehicles, false, {}, { v1: 10 }, {}, {});
    const high = computeDealerHudStats(vehicles, false, {}, { v1: 90 }, {}, {});
    expect(low.riskLevel).toBe("low");
    expect(high.riskLevel).toBe("high");
  });

  it("MOT health reflects the single worst vehicle in the fleet, not an average that could hide a real risk", () => {
    const vehicles = [mockVehicle("v1"), mockVehicle("v2")];
    const motHealth = {
      v1: { riskLevel: "low" } as any,
      v2: { riskLevel: "high" } as any,
    };
    const result = computeDealerHudStats(vehicles, false, {}, {}, {}, motHealth);
    // One vehicle with real MOT risk should surface as "bad" fleet-wide,
    // not be diluted away by the other vehicle being fine.
    expect(result.motHealth).toBe("bad");
  });

  it("treats a vehicle missing from the score maps as a real zero, not silently excluded from the average", () => {
    const vehicles = [mockVehicle("v1"), mockVehicle("v2")];
    const flipScores = { v1: 100 }; // v2 has no entry at all
    const result = computeDealerHudStats(vehicles, false, flipScores, {}, {}, {});
    expect(result.flipScore).toBe(50); // (100 + 0) / 2, not 100
  });
});
