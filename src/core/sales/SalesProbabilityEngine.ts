export interface SalesProbabilityInput {
  marketHeat: number;   // 0–100
  demandScore: number;  // 0–100
  priceAggression: number; // 0–100 (how cheap vs market)
  reconQuality: number; // 0–100
}

export interface SalesProbabilityResult {
  probability: number;  // 0–100
  daysToSale: number;   // estimated days
}

export const SalesProbabilityEngine = {
  evaluate(input: SalesProbabilityInput): SalesProbabilityResult {
    const base =
      input.marketHeat * 0.35 +
      input.demandScore * 0.25 +
      input.priceAggression * 0.25 +
      input.reconQuality * 0.15;

    const probability = Math.max(0, Math.min(100, Math.round(base)));

    const daysToSale = Math.round(60 - probability * 0.4); // 0–60 days

    return {
      probability,
      daysToSale,
    };
  },
};
