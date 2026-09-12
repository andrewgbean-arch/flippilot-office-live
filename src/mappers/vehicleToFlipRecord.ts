import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { CarRecord } from "@/types/carTypes";

export function mapVehicleToFlipRecord(v: CarRecord): FlipRecord {
  return {
    id: v.id,
    title: `${v.make} ${v.model}`,
    buyPrice: v.purchasePrice,
    sellPrice: v.salePrice ?? null,
    valuation: v.valuation?.estimatedValue ?? null,
    mileage: v.mileage,
    flipScore: v.analytics?.flipScore ?? 0,
    timestamp: v.createdAt,
    mot: {
      motExpiry: v.mot?.expiry ?? null, // FIXED
    },
  };
}
