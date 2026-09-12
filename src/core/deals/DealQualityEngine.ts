export interface DealQualityInput {
  purchasePrice: number;
  reconCost: number;
  expectedSale: number;
  supplier: string;
  marketHeat: number;     // 0–100
  riskScore: number;      // 0–100
}

export interface DealQualityResult {
  score: number;          // 0–100
  profitMargin: number;
  efficiency: number;     // recon efficiency
  supplierAdvantage: number;
  timing: number;         // market timing
  riskCurve: number;
}

export const DealQualityEngine = {
  evaluate(input: DealQualityInput): DealQualityResult {
    const profitMargin =
      ((input.expectedSale - (input.purchasePrice + input.reconCost)) /
        input.expectedSale) *
      100;

    const efficiency = Math.max(0, 100 - input.reconCost / 50);

    const supplierAdvantage =
      input.supplier === "BCA"
        ? 80
        : input.supplier === "Copart"
        ? 70
        : 60;

    const timing = input.marketHeat;

    const riskCurve = 100 - input.riskScore;

    const score = Math.round(
      profitMargin * 0.35 +
        efficiency * 0.2 +
        supplierAdvantage * 0.15 +
        timing * 0.15 +
        riskCurve * 0.15
    );

    return {
      score,
      profitMargin,
      efficiency,
      supplierAdvantage,
      timing,
      riskCurve,
    };
  },
};
