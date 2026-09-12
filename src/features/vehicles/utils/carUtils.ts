import { CarRecord, CarCondition } from "@/features/vehicles/models/CarRecord";



/**
 * PROFIT
 */
export const getCarProfit = (car: CarRecord): number => {
  const sale = car.salePrice ?? car.expectedSalePrice ?? 0;
  return sale - car.purchasePrice;
};

/**
 * ROI
 */
export const getCarROI = (car: CarRecord): number => {
  if (!car.purchasePrice) return 0;
  return (getCarProfit(car) / car.purchasePrice) * 100;
};

/**
 * FLIPSCORE
 */
export const getCarFlipScore = (car: CarRecord): number => {
  const roi = getCarROI(car);

  const ageFactor = Math.max(0, 30 - (new Date().getFullYear() - car.year));

  const mileageFactor =
    car.mileage < 60000 ? 20 :
    car.mileage < 120000 ? 10 :
    0;

  let conditionFactor = 0;
  switch (car.condition) {
    case "excellent":
      conditionFactor = 25;
      break;
    case "good":
      conditionFactor = 18;
      break;
    case "fair":
      conditionFactor = 10;
      break;
    case "poor":
      conditionFactor = 0;
      break;
  }

  const base = roi / 2 + ageFactor + mileageFactor + conditionFactor;

  return Math.max(0, Math.min(100, Math.round(base)));
};

/**
 * FLIP SUMMARY
 */
export const getFlipSummary = (car: CarRecord): string => {
  const score = getCarFlipScore(car);

  if (score >= 80) return "Excellent flip potential";
  if (score >= 60) return "Strong flip";
  if (score >= 40) return "Moderate flip";

  return "High‑risk flip";
};

/**
 * MOT STATUS
 */
export function getMotStatus(expiry?: string) {
  if (!expiry) return "unknown";

  const now = new Date();
  const exp = new Date(expiry);

  if (exp < now) return "expired";

  const diffDays = Math.ceil(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 30) return "dueSoon";

  return "valid";
}
