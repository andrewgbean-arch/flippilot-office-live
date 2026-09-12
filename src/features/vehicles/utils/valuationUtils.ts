import { CarRecord, CarCondition } from "@/features/vehicles/models/CarRecord";


export type CarInput = {
  make: string;
  model: string;
  year: number;
  mileage: number;
  condition: CarCondition;
  extras?: string[];
};

export type CarValuation = {
  estimatedPrice: number;
  tradeInPrice: number;
  privateSalePrice: number;
  confidence: number;
};

export function estimateCarValue(car: CarInput): CarValuation {
  const currentYear = new Date().getFullYear();

  let basePrice = 20000;

  const age = currentYear - car.year;
  basePrice -= age * 800;

  basePrice -= Math.floor(car.mileage / 10000) * 300;

  const multipliers: Record<CarCondition, number> = {
    excellent: 1.2,
    good: 1.0,
    fair: 0.8,
    poor: 0.6,
  };

  basePrice *= multipliers[car.condition];

  if (car.extras && car.extras.length > 0) {
    basePrice += car.extras.length * 150;
  }

  const privateSalePrice = Math.round(basePrice);
  const tradeInPrice = Math.round(basePrice * 0.85);
  const estimatedPrice = Math.round((privateSalePrice + tradeInPrice) / 2);

  const confidence = Math.max(60, 100 - age * 2);

  return {
    estimatedPrice,
    tradeInPrice,
    privateSalePrice,
    confidence,
  };
}
