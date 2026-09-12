export interface PricingInput {
  basePrice: number;        // priceTrade or priceRetail baseline
  reconCost: number;        // total recon cost
  marketHeat: number;       // 0–100
  volatility: number;       // 0–100
  supplierAdvantage: number; // 0–100
  demandScore: number;      // 0–100
}

export interface PricingResult {
  recommendedPrice: number;
  adjustments: {
    market: number;
    volatility: number;
    recon: number;
    supplier: number;
    demand: number;
  };
}

export const PricingAIEngine = {
  evaluate(input: PricingInput): PricingResult {
    const marketAdj = input.basePrice * (input.marketHeat / 300); // hotter market = higher price
    const volatilityAdj = -(input.basePrice * (input.volatility / 500)); // volatile market = lower price
    const reconAdj = -(input.reconCost * 0.8); // recon reduces margin
    const supplierAdj = input.basePrice * (input.supplierAdvantage / 400);
    const demandAdj = input.basePrice * (input.demandScore / 350);

    const recommendedPrice = Math.round(
      input.basePrice +
        marketAdj +
        volatilityAdj +
        reconAdj +
        supplierAdj +
        demandAdj
    );

    return {
      recommendedPrice,
      adjustments: {
        market: Math.round(marketAdj),
        volatility: Math.round(volatilityAdj),
        recon: Math.round(reconAdj),
        supplier: Math.round(supplierAdj),
        demand: Math.round(demandAdj),
      },
    };
  },
};
