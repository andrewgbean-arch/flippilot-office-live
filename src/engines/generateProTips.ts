import { FlipRecord } from "../features/vehicles/models/FlipRecord";

export function generateProTips(flip: FlipRecord): string[] {
  const tips: string[] = [];

  /* ================================
     ⭐ PRICE STRATEGY (AI + fallback)
  ================================= */

  const aiSell =
    (flip.market && "aiPriceMax" in flip.market && typeof flip.market.aiPriceMax === "number"
      ? flip.market.aiPriceMax
      : null) ??
    (flip.market && "googlePriceMax" in flip.market && typeof flip.market.googlePriceMax === "number"
      ? flip.market.googlePriceMax
      : null);

  if (aiSell != null && typeof flip.sellPrice === "number") {
    const diff = flip.sellPrice - aiSell;

    if (diff > 100) {
      tips.push(
        "Your sell price is above AI recommendation — consider lowering slightly to increase buyer interest."
      );
    } else if (diff < -100) {
      tips.push(
        "Your sell price is below AI recommendation — you may be able to list higher without reducing demand."
      );
    } else {
      tips.push(
        "Your sell price is close to AI recommendation — this is a strong pricing position."
      );
    }
  }

  /* ================================
     ⭐ DEMAND SCORE
  ================================= */

  const demand =
    flip.market && "demandScore" in flip.market && typeof flip.market.demandScore === "number"
      ? flip.market.demandScore
      : null;

  if (demand != null) {
    if (demand > 70) {
      tips.push("Demand is high — list ASAP to maximise visibility.");
    } else if (demand < 40) {
      tips.push(
        "Demand is low — consider boosting your listing with better photos or a sharper price."
      );
    }
  }

  /* ================================
     ⭐ CONDITION
  ================================= */

  if (flip.ai?.condition === "Excellent") {
    tips.push("Condition is excellent — highlight this in your listing title.");
  } else if (flip.ai?.condition === "Poor") {
    tips.push(
      "Condition is poor — include clear photos and be upfront to build trust."
    );
  }

  /* ================================
     ⭐ SELL SPEED
  ================================= */

  if (flip.sellSpeed === "Fast") {
    tips.push("This item sells fast — expect quick interest once listed.");
  } else if (flip.sellSpeed === "Slow") {
    tips.push("Sell speed is slow — consider listing on multiple platforms.");
  }

  /* ================================
     ⭐ RARITY
  ================================= */

  if (flip.rarity === "Ultra Rare") {
    tips.push("Ultra rare item — price confidently and emphasise scarcity.");
  }

  /* ================================
     ⭐ SMART PRICE
  ================================= */

  const smartPrice =
    flip.market && "smartPrice" in flip.market && typeof flip.market.smartPrice === "number"
      ? flip.market.smartPrice
      : null;

  if (smartPrice != null) {
    tips.push(
      `SmartPrice suggests £${smartPrice} — consider aligning your listing with this.`
    );
  }

  /* ================================
     ⭐ AI CONFIDENCE
  ================================= */

  const confidence =
    flip.market &&
    "aiPriceConfidence" in flip.market &&
    typeof flip.market.aiPriceConfidence === "number"
      ? flip.market.aiPriceConfidence
      : null;

  if (confidence != null) {
    if (confidence > 70) {
      tips.push("AI confidence is high — pricing recommendations are reliable.");
    } else if (confidence < 40) {
      tips.push(
        "AI confidence is low — rely more on market averages and demand."
      );
    }
  }

  return tips;
}
