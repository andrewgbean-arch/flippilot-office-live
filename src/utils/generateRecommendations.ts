import { FlipRecord } from "../features/vehicles/models/FlipRecord";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface CategoryMap {
  [key: string]: number;
}

export function generateRecommendations(flips: FlipRecord[]): string[] {
  if (flips.length === 0) return [];

  const categories: CategoryMap = {};
  const profits: CategoryMap = {};
  const rois: CategoryMap = {};

  flips.forEach((f) => {
    const cat = f.category ?? "Unknown";

    // Count category frequency
    categories[cat] = (categories[cat] || 0) + 1;

    // Profit calculation
    const profit =
      f.pricing?.recommendedSellPrice != null &&
      f.pricing?.recommendedBuyPrice != null
        ? f.pricing.recommendedSellPrice - f.pricing.recommendedBuyPrice
        : f.pricing?.predictedProfit ?? 0;

    profits[cat] = (profits[cat] || 0) + profit;

    // ROI calculation
    const roi =
      f.pricing?.recommendedSellPrice != null &&
      f.pricing?.recommendedBuyPrice != null
        ? ((f.pricing.recommendedSellPrice - f.pricing.recommendedBuyPrice) /
            f.pricing.recommendedBuyPrice) *
          100
        : 0;

    rois[cat] = (rois[cat] || 0) + roi;
  });

  const bestCategory =
    Object.keys(profits).sort((a, b) => (profits[b] ?? 0) - (profits[a] ?? 0))[0];

  const bestROI =
    Object.keys(rois).sort((a, b) => (rois[b] ?? 0) - (rois[a] ?? 0))[0];

  return [
    `You flip the most items in: ${bestCategory}`,
    `Your highest profit category is: ${bestCategory}`,
    `Your best ROI category is: ${bestROI}`,
    `Try scanning more items similar to your top category`,
  ];
}
