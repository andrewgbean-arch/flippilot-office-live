import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
export function wholesaleVsRetailAI(vehicle: FlipRecord) {
  const profit =
    (vehicle.sellPrice ?? vehicle.valuation ?? 0) - (vehicle.buyPrice ?? 0);
  const motRisk = vehicle.mot?.failures?.length ?? 0;
  const flipScore = vehicle.flipScore ?? 50;

  let recommendation = "Retail";

  if (motRisk > 3) recommendation = "Wholesale";
  if (flipScore < 40) recommendation = "Wholesale";
  if (profit < 300) recommendation = "Wholesale";

  return {
    profit,
    motRisk,
    flipScore,
    recommendation,
  };
}
