import { CarRecord } from "@/types/carTypes";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export function carToFlipRecord(car: CarRecord): FlipRecord {
  return {
    id: car.id,

    title: `${car.make} ${car.model}`,

    buyPrice: car.purchasePrice,
    sellPrice: car.salePrice ?? null,

    profit: car.profit ?? null,
    timestamp: car.createdAt,

    favourite: car.favourite ?? false,

    flipScore: car.analytics?.flipScore ?? 0,

    mot: car.mot ?? null, // FIXED
  };
}
