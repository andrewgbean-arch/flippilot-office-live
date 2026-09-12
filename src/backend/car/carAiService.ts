import { MotData, CarRecord } from "@/types/carTypes";

export async function generateAiSummary(input: {
  make: string;
  model: string;
  year: number;
  mileage: number;
  purchasePrice: number;
  valuation: {
    estimatedValue: number;
    confidence: number;
    status: "fair" | "undervalued" | "overpriced";
    lastUpdated: string;
  };
  mot: MotData;
}): Promise<CarRecord["aiSummary"]> {

  const age = new Date().getFullYear() - input.year;

  const riskLevel =
    age > 15 || input.mileage > 150000
      ? "high"
      : age > 10 || input.mileage > 100000
      ? "medium"
      : "low";

  const difficulty =
    (age > 15 ? 40 : age > 10 ? 25 : 10) +
    (input.mileage > 150000 ? 40 : input.mileage > 100000 ? 25 : 10);

  const demandScore =
    input.model.toLowerCase().includes("sport") ||
    input.model.toLowerCase().includes("hybrid")
      ? 80
      : 60;

  const buyerProfile =
    demandScore > 70
      ? "Enthusiasts or younger buyers looking for style/performance."
      : "General buyers wanting a reliable daily driver.";

  const recommendedRepairs = [];

  if (input.mot?.advisories?.length) {
    recommendedRepairs.push("Address MOT advisories");
  }
  if (input.mileage > 120000) {
    recommendedRepairs.push("Check timing belt / water pump");
  }
  if (age > 12) {
    recommendedRepairs.push("Inspect suspension components");
  }
  if (!recommendedRepairs.length) {
    recommendedRepairs.push("No urgent repairs — good flip candidate.");
  }

  const saleStrategy =
    riskLevel === "low"
      ? "List at a premium with clean photos and highlight MOT history."
      : riskLevel === "medium"
      ? "Price competitively and emphasise recent maintenance."
      : "Sell quickly at a fair price — avoid over-investing.";

  const profitForecast =
    input.valuation.estimatedValue - input.purchasePrice;

  const verdict =
    profitForecast > 1500 && riskLevel === "low"
      ? "Excellent Flip"
      : profitForecast > 800
      ? "Good Flip"
      : profitForecast > 300
      ? "Possible Flip"
      : "Avoid";

  const recommendedSalePrice =
    input.valuation.estimatedValue *
    (riskLevel === "low" ? 1.05 : riskLevel === "medium" ? 1 : 0.95);

  const summary = `This ${input.year} ${input.make} ${input.model} shows ${riskLevel} risk with a demand score of ${demandScore}. Estimated profit is around £${profitForecast}. Verdict: ${verdict}.`;

  return {
    summary,
    riskLevel,
    demandScore,
    recommendedSalePrice,
    lastUpdated: new Date().toISOString(),
    buyerProfile,
    recommendedRepairs,
    saleStrategy,
    profitForecast,
    difficulty,
    verdict,
  };
}
