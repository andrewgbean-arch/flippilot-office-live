import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatMileage } from "./vehicleListModel";

// The Vehicle Snapshot on a car's page printed the mileage raw ("Mileage: 64000") while the
// header above it said "64,000 miles".

describe("mileage on a car's page", () => {
  it("is written with a thousands separator and its unit", () => {
    expect(formatMileage(64000)).toBe("64,000 miles");
    expect(formatMileage(null)).toBeNull();
  });

  it("is never printed raw in the Vehicle Snapshot", () => {
    const source = readFileSync(join(__dirname, "VehicleOverview.tsx"), "utf8");
    const line = source.split("\n").find(l => l.includes('text-white/60">Mileage:'))!;
    expect(line).toContain("formatMileage(vehicle.mileage)");
    expect(line).not.toMatch(/\{vehicle\.mileage\b/);
  });
});
