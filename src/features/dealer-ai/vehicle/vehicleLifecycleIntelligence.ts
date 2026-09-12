import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export function vehicleLifecycleIntelligence(vehicle: FlipRecord) {
  const year = (vehicle as any).year;
  const age = year ? new Date().getFullYear() - year : 0;

  const mileage = vehicle.mileage ?? 0;

  let stage = "Active Retail";

  if (age > 15 || mileage > 150000) stage = "End of Life";
  else if (age > 10 || mileage > 120000) stage = "Late Retail";
  else if (age > 7 || mileage > 90000) stage = "Mid Retail";
  else if (age > 3 || mileage > 60000) stage = "Early Retail";

  const failuresCount = vehicle.mot?.failures
    ? vehicle.mot.failures.length
    : 0;

  const risk =
    failuresCount * 20 +
    ((vehicle.flipScore ?? 50) < 40 ? 20 : 0);

  return {
    stage,
    age,
    mileage,
    risk,
    recommendation:
      stage === "End of Life"
        ? "Wholesale recommended"
        : stage === "Late Retail"
        ? "Price reduction recommended"
        : stage === "Mid Retail"
        ? "Standard listing"
        : "Premium listing",
  };
}
