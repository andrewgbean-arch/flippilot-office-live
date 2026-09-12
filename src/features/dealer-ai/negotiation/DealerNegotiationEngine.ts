import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export interface NegotiationPlan {
  targetOfferMin: number;
  targetOfferMax: number;
  walkAwayPrice: number;
  buyerLeverage: number; // 0–100
  stance: "FIRM" | "FLEXIBLE" | "AGGRESSIVE";
  suggestedLines: string[];
}

export function evaluateNegotiation(vehicle: FlipRecord): NegotiationPlan {
  const notes: string[] = [];

  const valuation = vehicle.aiValuation?.estimatedValue ?? vehicle.valuation ?? vehicle.price ?? 0;
  const recommendedSell =
    vehicle.aiPrice?.recommendedSellPrice ??
    vehicle.pricing?.recommendedSellPrice ??
    valuation;

  const demand = vehicle.market?.demandScore ?? 50;
  const flipScore = vehicle.flipScore ?? 50;

  // Buyer leverage: lower when demand + flipScore are high
  const buyerLeverage = Math.min(
    100,
    60 - (demand / 2) - (flipScore / 3)
  );

  // Target range
  const targetOfferMin = Math.round(recommendedSell * 0.95);
  const targetOfferMax = Math.round(recommendedSell * 1.03);

  // Walk‑away price
  const walkAwayPrice = Math.round(recommendedSell * 0.9);

  // Stance
  let stance: "FIRM" | "FLEXIBLE" | "AGGRESSIVE" = "FLEXIBLE";
  if (demand > 70 && flipScore > 70) stance = "FIRM";
  if (buyerLeverage > 60) stance = "AGGRESSIVE";

  const suggestedLines: string[] = [];

  if (stance === "FIRM") {
    suggestedLines.push("This price reflects the current market and condition—it's already very competitive.");
    suggestedLines.push("We’ve had strong interest in this vehicle, so we’re holding close to the asking price.");
  }

  if (stance === "FLEXIBLE") {
    suggestedLines.push("There’s a little room to move, but we’re already close to market value.");
    suggestedLines.push("If we can agree somewhere in the middle, I think we can make this work today.");
  }

  if (stance === "AGGRESSIVE") {
    suggestedLines.push("We can look at sharpening the numbers if you’re ready to move forward today.");
    suggestedLines.push("Given your position, I’ll see how close we can get to your figure without losing the deal.");
  }

  return {
    targetOfferMin,
    targetOfferMax,
    walkAwayPrice,
    buyerLeverage: Math.round(buyerLeverage),
    stance,
    suggestedLines,
  };
}
