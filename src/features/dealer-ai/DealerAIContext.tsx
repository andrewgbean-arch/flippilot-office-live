import React, { createContext, useContext } from "react";

/* -------------------------------------------------------
   DealerAI Type — All Modules V3 → V9 + Finance + CRM + V15
------------------------------------------------------- */
export type DealerAI = {
  // V3 — Core Pricing & Flip Logic
  priceVehicle: (vehicle: any) => number;
  flipAdvice: (vehicle: any) => string;
  motRiskScore: (vehicle: any) => number;
  autoWriteListing: (vehicle: any) => string;
  profitForecast: (vehicle: any) => number;

  // V4 — Market Intelligence
  photoQualityScore: (photos: string[]) => number;
  damageDetection: (photos: string[]) => string;
  marketComparison: (vehicle: any, market: any[]) => number | string;
  autoMarketPrice: (vehicle: any, market: any[]) => number;
  flipProbability: (vehicle: any) => number;
  stockRotationAdvice: (vehicle: any) => string;

  // V5 — Service & Maintenance AI
  decodeVIN: (vin: string) => any;
  reconstructServiceHistory: (vehicle: any) => string[];
  predictiveMaintenance: (vehicle: any) => string;
  buyerPersona: (vehicle: any) => string;
  salesScript: (vehicle: any) => string;

  // V6 — Fraud & Risk
  fraudRisk: (vehicle: any) => number;
  odometerTamperRisk: (vehicle: any) => number;
  auctionPriceHint: (vehicle: any, market: any[]) => number;
  wholesaleRecommendation: (vehicle: any) => string;
  conditionScore: (vehicle: any) => number;

  // V7 — Sales Intelligence
  negotiationPredictor: (vehicle: any) => string;
  leadQualityScore: (lead: any) => number;
  financeApprovalLikelihood: (buyer: any) => string;
  testDriveBehaviour: (vehicle: any) => string;
  closingProbability: (vehicle: any, lead: any) => number;

  // V8 — Buyer Psychology & Automation
  buyerPersonalityProfile: (lead: any) => string;
  upsellRecommendations: (vehicle: any, buyer: any) => string[];
  warrantyRiskScore: (vehicle: any) => number;
  salesFunnelStage: (lead: any) => string;
  followUpTiming: (lead: any) => string;

  // V9 — Emotion, Finance, Diagnostics, Closing Engine
  buyerEmotion: (lead: any) => string;
  financePlanHint: (buyer: any, vehicle: any) => {
    deposit: number;
    term: number;
    riskBand: string;
    monthly: number;
  };
  serviceDeskDiagnostics: (vehicle: any) => string;
  dealClosingMove: (vehicle: any, lead: any, buyer: any) => string;
  followUpScript: (vehicle: any, lead: any, buyer: any) => string;

  // ⭐ V16 — Finance Intelligence
  financeApprovalAI: (buyer: any, vehicle: any) => string;
  depositOptimiser: (buyer: any, vehicle: any) => {
    riskBand: string;
    recommendedDeposit: number;
    monthly: number;
    message: string;
  };
  aprSensitivity: (vehicle: any, buyer: any) => {
    baseAPR: number;
    apr: number;
    creditImpact: number;
    fraudImpact: number;
    ageImpact: number;
    message: string;
  };
  paymentStressTest: (buyer: any, vehicle: any) => {
    monthly: number;
    affordability: number;
    safeZone: boolean;
    dangerZone: boolean;
    message: string;
  };
  lenderMatch: (buyer: any, vehicle: any) => string;
  financeClosingScript: (buyer: any, vehicle: any) => string;
  financeObjectionHandler: (objection: string) => string;
  financeComplianceCheck: (buyer: any, vehicle: any) => string[];


  // Finance Engine
  financeAPR: (vehicle: any) => number;
  monthlyPayment: (vehicle: any) => number;
  affordabilityScore: (vehicle: any) => number;
  holdingCost: (vehicle: any) => number;
  roiScore: (vehicle: any) => number;

  // CRM Engine
  buyerIntentScore: (vehicle: any) => number;
  followUpUrgency: (vehicle: any) => number;
  communicationQuality: (vehicle: any) => number;
  testDriveProbability: (vehicle: any) => number;
  buyerProfile: (vehicle: any) => string;

  // ⭐ V15 — Dealer Marketing Engine
  generateAd: (vehicle: any) => string;
  keywordHints: (vehicle: any) => string;
  postingStrategy: (vehicle: any) => string;
  competitorComparison: (vehicle: any) => string;
  engagementPrediction: (vehicle: any) => string;
};

const DealerAIContext = createContext<DealerAI | null>(null);

/* -------------------------------------------------------
   Provider — All AI Logic V3 → V9 + Finance + CRM + V15
------------------------------------------------------- */
export function DealerAIProvider({ children }: { children: React.ReactNode }) {

  /* ------------------------------
     V3 — Core Pricing & Flip Logic
  ------------------------------ */
  const priceVehicle = (vehicle: any) => {
    if (!vehicle) return 0;
    const base = vehicle.price ?? 0;
    const miles = vehicle.mileage ?? 0;
    const age = vehicle.year ? new Date().getFullYear() - vehicle.year : 0;
    return Math.max(base - miles * 0.03 - age * 120, 500);
  };

  const flipAdvice = (vehicle: any) => {
    if (!vehicle) return "No vehicle data — unable to generate flip advice.";
    const score = vehicle.flipScore ?? 0;
    if (score < 40) return "High risk flip. Improve photos and reduce price.";
    if (score < 70) return "Medium flip. Consider minor repairs.";
    return "Strong flip. List immediately.";
  };

  const motRiskScore = (vehicle: any) => {
    if (!vehicle || !vehicle.mot?.motExpiry) return 0;
    const expiry = new Date(vehicle.mot.motExpiry).getTime();
    const diff = expiry - Date.now();
    return Math.max(0, 100 - diff / (1000 * 60 * 60 * 24));
  };

  const autoWriteListing = (vehicle: any) => {
    if (!vehicle) return "Vehicle details missing.";
    return `For sale: ${vehicle.title}. Clean condition, drives well. MOT: ${
      vehicle.mot?.motExpiry ?? "Unknown"
    }. Great value for money. Contact for viewing.`;
  };

  const profitForecast = (vehicle: any) => {
    if (!vehicle) return 0;
    const buy = vehicle.buyPrice ?? 0;
    const sell = priceVehicle(vehicle);
    return sell - buy;
  };

  /* ------------------------------
     V4 — Market Intelligence
  ------------------------------ */
  const photoQualityScore = (photos: string[]) =>
    photos && photos.length ? Math.min(100, photos.length * 15) : 0;

  const damageDetection = (photos: string[]) => {
    if (!photos || !photos.length) return "No photos provided.";
    if (photos.length < 3) return "Possible damage — insufficient photos.";
    return "No visible damage detected.";
  };

  const marketComparison = (vehicle: any, market: any[]) => {
    if (!vehicle || !market || !market.length) return "No market data available.";
    const similar = market.filter((m) => m.year === vehicle.year);
    if (!similar.length) return "No market data available.";
    return similar.reduce((a, b) => a + b.price, 0) / similar.length;
  };

  const autoMarketPrice = (vehicle: any, market: any[]) => {
    const avg = marketComparison(vehicle, market);
    if (!vehicle) return 0;
    return typeof avg === "string" ? priceVehicle(vehicle) : Math.round(avg * 0.97);
  };

  const flipProbability = (vehicle: any) => {
    if (!vehicle) return 0;
    const score = vehicle.flipScore ?? 50;
    const mot = motRiskScore(vehicle);
    const profit = profitForecast(vehicle);
    return Math.min(100, score * 0.6 + (100 - mot) * 0.2 + (profit > 500 ? 20 : 5));
  };

  const stockRotationAdvice = (vehicle: any) => {
    if (!vehicle) return "No vehicle data — unable to assess rotation.";
    const days = vehicle.daysListed ?? 0;
    if (days < 10) return "Fresh listing — no action needed.";
    if (days < 30) return "Consider refreshing photos.";
    if (days < 60) return "Reduce price by 5–10%.";
    return "High rotation risk — relist or wholesale.";
  };

  /* ------------------------------
     V5 — Service & Maintenance AI
  ------------------------------ */
  const decodeVIN = (vin: string) => ({
    vin,
    country: "UK",
    manufacturer: "Ford",
    model: "Focus",
    engine: "1.6L Petrol",
    year: 2017,
  });

  const reconstructServiceHistory = (vehicle: any) => {
    if (!vehicle) return ["No vehicle data — unable to reconstruct history"];
    const history: string[] = [];
    if (vehicle.mileage > 60000) history.push("Recommended: Timing belt inspection");
    if (vehicle.mileage > 80000) history.push("Recommended: Suspension check");
    if (!vehicle.mot?.motExpiry) history.push("Missing MOT history");
    return history.length ? history : ["No service issues detected"];
  };

  const predictiveMaintenance = (vehicle: any) => {
    if (!vehicle) return "No vehicle data — unable to predict maintenance.";
    if (vehicle.mileage > 100000) return "High risk: Engine wear likely within 12 months.";
    if (vehicle.mileage > 70000) return "Medium risk: Brake and suspension wear expected.";
    return "Low risk: No major maintenance predicted.";
  };

  const buyerPersona = (vehicle: any) => {
    if (!vehicle) return "Unknown buyer — vehicle data missing.";
    if (vehicle.price < 3000) return "Budget buyer — wants reliability";
    if (vehicle.price < 8000) return "Practical buyer — wants value";
    return "Premium buyer — expects top condition";
  };

  const salesScript = (vehicle: any) => {
    if (!vehicle) {
      return "This vehicle offers strong value and reliability.";
    }
    return `This ${vehicle.title} is a fantastic choice. It offers great value, strong reliability, and a clean MOT history.`;
  };

  /* ------------------------------
     V6 — Fraud & Risk
  ------------------------------ */
  const fraudRisk = (vehicle: any) => {
    if (!vehicle) return 0;

    let risk = 0;

    if (!vehicle.mot || !vehicle.mot.motExpiry) risk += 25;

    if (vehicle.mileage && vehicle.year) {
      const age = new Date().getFullYear() - vehicle.year;
      const perYear = vehicle.mileage / Math.max(age, 1);
      if (perYear < 3000) risk += 30;
    }

    if (
      vehicle.price &&
      vehicle.marketAvg &&
      vehicle.price < vehicle.marketAvg * 0.7
    ) {
      risk += 30;
    }

    return Math.min(100, risk);
  };

  const odometerTamperRisk = (vehicle: any) => {
    if (!vehicle) return 0;
    if (!vehicle.mileage || !vehicle.year) return 0;
    const age = new Date().getFullYear() - vehicle.year;
    const perYear = vehicle.mileage / Math.max(age, 1);
    if (perYear < 3000) return 60;
    if (perYear < 5000) return 30;
    return 10;
  };

  const auctionPriceHint = (vehicle: any, market: any[]) => {
    if (!vehicle) return 0;
    const avg = marketComparison(vehicle, market);
    return typeof avg === "string"
      ? Math.round(priceVehicle(vehicle) * 0.8)
      : Math.round(avg * 0.8);
  };

  const wholesaleRecommendation = (vehicle: any) => {
    if (!vehicle) return "No vehicle data — unable to recommend wholesale.";
    const prob = flipProbability(vehicle);
    const risk = fraudRisk(vehicle);
    if (prob < 40 || risk > 60) return "Recommend wholesale / trade disposal.";
    return "Suitable for retail listing.";
  };

  const conditionScore = (vehicle: any) => {
    if (!vehicle) return 0;
    let score = 70;
    if (vehicle.mileage > 100000) score -= 20;
    if (!vehicle.mot?.motExpiry) score -= 15;
    if (vehicle.flipScore) score = (score + vehicle.flipScore) / 2;
    return Math.max(0, Math.min(100, score));
  };

  /* ------------------------------
     V7 — Sales Intelligence
  ------------------------------ */
  const negotiationPredictor = (vehicle: any) => {
    if (!vehicle) return "No vehicle data — unable to predict negotiation.";
    const price = vehicle.price ?? 0;
    const condition = vehicle.conditionScore ?? 70;
    if (price < 3000) return "Low negotiation — budget buyers accept asking price.";
    if (condition < 50) return "High negotiation — expect pushback.";
    return "Medium negotiation — expect small reductions.";
  };

  const leadQualityScore = (lead: any) => {
    if (!lead) return 0;
    let score = 50;
    if (lead.message?.length > 50) score += 20;
    if (lead.requestedTestDrive) score += 20;
    if (lead.sentMultipleMessages) score += 10;
    return Math.min(100, score);
  };

  const financeApprovalLikelihood = (buyer: any) => {
    if (!buyer) return "Unknown — buyer data missing.";
    if (!buyer.creditScore) return "Unknown — missing credit score.";
    if (buyer.creditScore > 700) return "High likelihood of approval.";
    if (buyer.creditScore > 550) return "Medium likelihood of approval.";
    return "Low likelihood — buyer may need a guarantor.";
  };

  const testDriveBehaviour = (vehicle: any) => {
    if (!vehicle) return "No vehicle data — unable to predict behaviour.";
    if (vehicle.price > 10000) return "Expect careful driving and detailed questions.";
    if (vehicle.mileage > 120000) return "Expect focus on engine noise and suspension.";
    return "Normal behaviour — casual but interested.";
  };

  const closingProbability = (vehicle: any, lead: any) => {
    if (!vehicle || !lead) return 0;
    const leadScore = leadQualityScore(lead);
    const condition = vehicle.conditionScore ?? 70;
    return Math.min(100, Math.round(leadScore * 0.6 + condition * 0.4));
  };

  /* ------------------------------
     V8 — Buyer Psychology & Automation
  ------------------------------ */
  const buyerPersonalityProfile = (lead: any) => {
    if (!lead) return "Unknown — lead data missing.";
    const msg = lead.message?.toLowerCase() ?? "";
    if (msg.includes("best price") || msg.includes("lowest")) return "The Negotiator";
    if (msg.includes("urgent") || msg.includes("today")) return "The Impulse Buyer";
    if (msg.includes("service history") || msg.includes("mot")) return "The Researcher";
    if (msg.includes("not sure") || msg.includes("concern")) return "The Skeptic";
    return "The Premium Buyer";
  };

  const upsellRecommendations = (vehicle: any, buyer: any) => {
    if (!vehicle) return ["No vehicle data — unable to recommend upsells"];
    const list: string[] = [];
    if (vehicle.mileage > 80000) list.push("Extended Warranty");
    if (vehicle.price > 8000) list.push("Premium Detailing Package");
    if (buyer && buyer.creditScore && buyer.creditScore > 650) list.push("Finance Plan");
    if (vehicle.conditionScore && vehicle.conditionScore < 60) list.push("Service Package");
    return list.length ? list : ["No upsells recommended"];
  };

  const warrantyRiskScore = (vehicle: any) => {
    if (!vehicle) return 0;
    let risk = 20;
    if (vehicle.mileage > 100000) risk += 40;
    if (!vehicle.mot?.motExpiry) risk += 20;
    if (vehicle.year && vehicle.year < 2012) risk += 20;
    return Math.min(100, risk);
  };

  const salesFunnelStage = (lead: any) => {
    if (!lead) return "Unknown";
    if (lead.requestedTestDrive) return "Test‑Drive";
    if (lead.sentMultipleMessages) return "Consideration";
    if (lead.message?.length > 40) return "Interest";
    return "Awareness";
  };

  const followUpTiming = (lead: any) => {
    if (!lead) return "Follow up tomorrow morning";
    if (lead.requestedTestDrive) return "Follow up now";
    if (lead.sentMultipleMessages) return "Follow up in 2 hours";
    if (lead.message?.includes("thinking")) return "Wait — buyer is thinking";
    return "Follow up tomorrow morning";
  };

  /* ------------------------------
     V9 — Emotion, Finance, Diagnostics, Closing Engine
  ------------------------------ */
  const buyerEmotion = (lead: any) => {
    if (!lead) return "Calm & Confident";
    const msg = lead.message?.toLowerCase() ?? "";

    if (msg.includes("not sure") || msg.includes("worried")) return "Anxious & Unsure";
    if (msg.includes("best price") || msg.includes("too much")) return "Price‑Sensitive";
    if (msg.includes("great") || msg.includes("love")) return "Excited & Ready";
    if (msg.includes("why") || msg.includes("explain")) return "Defensive / Guarded";

    return "Calm & Confident";
  };

  const financePlanHint = (buyer: any, vehicle: any) => {
    const price = vehicle?.price ?? 0;
    const credit = buyer?.creditScore ?? 600;

   const riskBand =
      credit > 700 ? "Low"
      : credit > 550 ? "Medium"
      : "High";

const deposit = Math.round(price * (riskBand === "High" ? 0.25 : 0.1));
const term = riskBand === "Low" ? 48 : riskBand === "Medium" ? 36 : 24;

const monthly = term > 0 ? Math.round((price - deposit) / term) : 0;

return { deposit, term, riskBand, monthly };
  };

  /* ------------------------------
     V9 — Diagnostics Engine
  ------------------------------ */
  const serviceDeskDiagnostics = (vehicle: any) => {
    const mileage = vehicle?.mileage ?? 0;
    const year = vehicle?.year ?? 2015;

    if (mileage > 120000)
      return "High risk: Suspension, clutch, and brake wear likely.";

    if (mileage > 90000)
      return "Medium risk: Brake discs and shocks may need attention.";

    if (year < 2010)
      return "Age‑related risk: Cooling system and electronics may require inspection.";

    return "Low risk: No major issues predicted.";
  };

  /* ------------------------------
     V9 — Closing Engine
  ------------------------------ */
  const dealClosingMove = (vehicle: any, lead: any, buyer: any) => {
    if (!vehicle || !lead)
      return "Send a friendly check‑in message and keep momentum.";

    const emotion = buyerEmotion(lead);
    const funnel = salesFunnelStage(lead);
    const closing = closingProbability(vehicle, lead);

    if (closing > 80)
      return "Send a finance quote and propose a viewing slot.";

    if (emotion === "Excited & Ready")
      return "Send a short video of the vehicle.";

    if (funnel === "Consideration")
      return "Follow up with MOT history and service records.";

    if (emotion === "Price‑Sensitive")
      return "Offer a small goodwill discount or free detailing.";

    return "Send a friendly check‑in message and keep momentum.";
  };

  const followUpScript = (vehicle: any, lead: any, buyer: any) => {
    if (!vehicle || !lead) {
      return "Hi! Just checking in. Once we have full details, I can send a tailored follow‑up message.";
    }

    const emotion = buyerEmotion(lead);
    const persona = buyerPersona(vehicle);
    const funnel = salesFunnelStage(lead);

    return `Hi! Just checking in about the ${vehicle.title}. Based on what you've said, you're in the ${funnel} stage and seem ${emotion.toLowerCase()}. This car suits a ${persona.toLowerCase()}, and I think you'd love it. Let me know if you'd like a video or to arrange a viewing.`;
  };

  /* ------------------------------
     ⭐ Finance Engine
  ------------------------------ */
  const financeAPR = (vehicle: any) => {
    if (!vehicle) return 0;
    const base = 6.9;
    const age = vehicle.year ? new Date().getFullYear() - vehicle.year : 0;
    const mileageFactor = (vehicle.mileage ?? 0) / 20000 * 0.3;
    return Math.round(base + age * 0.15 + mileageFactor);
  };

  const monthlyPayment = (vehicle: any) => {
    if (!vehicle) return 0;
    const price =
      vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? 0;
    const apr = financeAPR(vehicle);
    const months = 48;
    const interest = (price * (apr / 100)) / 12;
    return Math.round(price / months + interest);
  };

  const affordabilityScore = (vehicle: any) => {
    if (!vehicle) return 0;
    const price =
      vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? 0;

    if (price <= 3000) return 90;
    if (price <= 6000) return 75;
    if (price <= 10000) return 60;
    return 45;
  };

  const holdingCost = (vehicle: any) => {
    if (!vehicle) return 0;
    const daily = 4.5;
    const days = 30;
    return Math.round(daily * days);
  };

  const roiScore = (vehicle: any) => {
    if (!vehicle) return 0;
    const buy = vehicle.buyPrice ?? 0;
    const sell = vehicle.sellPrice ?? vehicle.valuation ?? 0;
    const profit = sell - buy;

    if (profit <= 0) return 20;
    if (profit <= 500) return 50;
    if (profit <= 1500) return 70;
    return 90;
  };

  /* ------------------------------
     ⭐ CRM Engine
  ------------------------------ */
  const buyerIntentScore = (vehicle: any) => {
    if (!vehicle) return 0;
    const score = vehicle.flipScore ?? 50;
    const price =
      vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? 0;

    return Math.min(100, Math.round(score * 0.6 + (price < 5000 ? 20 : 5)));
  };

  const followUpUrgency = (vehicle: any) => {
    if (!vehicle) return 0;
    const days = vehicle.daysListed ?? 0;

    if (days < 5) return 30;
    if (days < 15) return 60;
    return 85;
  };

  const communicationQuality = (vehicle: any) => {
    if (!vehicle) return 0;
    const score = vehicle.flipScore ?? 50;
    return Math.round(score * 0.7);
  };

  const testDriveProbability = (vehicle: any) => {
    if (!vehicle) return 0;
    const price =
      vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? 0;

    if (price < 3000) return 40;
    if (price < 8000) return 60;
    return 75;
  };

  const buyerProfile = (vehicle: any) => {
    if (!vehicle) return "Unknown buyer profile";

    const price =
      vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? 0;

    if (price < 3000) return "Budget Buyer — wants reliability";
    if (price < 8000) return "Practical Buyer — wants value";
    return "Premium Buyer — expects top condition";
  };
/* -------------------------------------------------------
   ⭐ V16 — Finance Intelligence Engine
------------------------------------------------------- */

/* 1️⃣ Finance Approval AI */
const financeApprovalAI = (buyer: any, vehicle: any) => {
  if (!buyer || !vehicle) return "Unknown — missing buyer or vehicle data.";

  const credit = buyer.creditScore ?? 600;
  const age = vehicle.year ? new Date().getFullYear() - vehicle.year : 0;
  const mileage = vehicle.mileage ?? 0;
  const fraud = fraudRisk(vehicle);
  const condition = conditionScore(vehicle);

  let score = 0;

  // Credit score weight
  score += credit > 700 ? 40 : credit > 550 ? 25 : 10;

  // Vehicle age weight
  score += age < 5 ? 20 : age < 10 ? 10 : 5;

  // Mileage weight
  score += mileage < 60000 ? 20 : mileage < 100000 ? 10 : 5;

  // Fraud & condition
  score += (100 - fraud) * 0.1;
  score += condition * 0.1;

  if (score > 75) return "High approval likelihood";
  if (score > 50) return "Medium approval likelihood";
  return "Low approval likelihood";
};

/* 2️⃣ Deposit Optimiser */
const depositOptimiser = (buyer: any, vehicle: any) => {
  const price = vehicle?.price ?? 0;
  const credit = buyer?.creditScore ?? 600;

  const riskBand =
    credit > 700 ? "Low"
    : credit > 550 ? "Medium"
    : "High";

  const recommendedDeposit =
    riskBand === "High"
      ? Math.round(price * 0.25)
      : riskBand === "Medium"
      ? Math.round(price * 0.15)
      : Math.round(price * 0.1);

  const monthly = Math.round((price - recommendedDeposit) / (riskBand === "Low" ? 48 : riskBand === "Medium" ? 36 : 24));

  return {
    riskBand,
    recommendedDeposit,
    monthly,
    message:
      riskBand === "High"
        ? "Higher deposit recommended to reduce risk and improve approval."
        : riskBand === "Medium"
        ? "Moderate deposit improves approval chances."
        : "Low deposit acceptable — buyer is low risk.",
  };
};

/* 3️⃣ APR Sensitivity Model */
const aprSensitivity = (vehicle: any, buyer: any) => {
  const baseAPR = financeAPR(vehicle);
  const credit = buyer?.creditScore ?? 600;
  const fraud = fraudRisk(vehicle);
  const age = vehicle.year ? new Date().getFullYear() - vehicle.year : 0;

  const creditImpact = credit < 550 ? 3 : credit < 650 ? 1.5 : 0.5;
  const fraudImpact = fraud > 50 ? 2 : fraud > 30 ? 1 : 0.5;
  const ageImpact = age > 10 ? 1.5 : age > 5 ? 1 : 0.5;

  const apr = Math.round(baseAPR + creditImpact + fraudImpact + ageImpact);

  return {
    baseAPR,
    apr,
    creditImpact,
    fraudImpact,
    ageImpact,
    message: `APR affected by credit (${creditImpact}), fraud (${fraudImpact}), and age (${ageImpact}).`,
  };
};

/* 4️⃣ Payment Stress Test */
const paymentStressTest = (buyer: any, vehicle: any) => {
  const monthly = monthlyPayment(vehicle);
  const affordability = affordabilityScore(vehicle);

  const safeZone = affordability >= 75;
  const dangerZone = affordability <= 45;

  return {
    monthly,
    affordability,
    safeZone,
    dangerZone,
    message:
      safeZone
        ? "Buyer is comfortably within affordability range."
        : dangerZone
        ? "High risk: monthly payment may exceed buyer affordability."
        : "Moderate risk: consider adjusting deposit or term.",
  };
};

/* 5️⃣ Lender Match Engine */
const lenderMatch = (buyer: any, vehicle: any) => {
  const credit = buyer?.creditScore ?? 600;
  const price = vehicle?.price ?? 0;

  if (credit > 700)
    return "Matched with Prime Lender — best APR and flexible terms.";

  if (credit > 550)
    return "Matched with Mid‑Tier Lender — moderate APR, standard terms.";

  return "Matched with Specialist Lender — higher APR, shorter terms.";
};

/* 6️⃣ Finance Closing Script */
const financeClosingScript = (buyer: any, vehicle: any) => {
  const persona = buyerPersona(vehicle);
  const approval = financeApprovalAI(buyer, vehicle);

  return `Based on your profile, you're a great fit for this finance plan. Your approval likelihood is ${approval.toLowerCase()}, and the ${vehicle.title} suits a ${persona.toLowerCase()}. We can secure a tailored plan today — want me to run the quote?`;
};

/* 7️⃣ Objection Handling AI */
const financeObjectionHandler = (objection: string) => {
  const msg = objection.toLowerCase();

  if (msg.includes("monthly"))
    return "Totally understand — we can adjust the term or deposit to reduce the monthly payment.";

  if (msg.includes("deposit"))
    return "No problem — we can explore lower‑deposit options or flexible plans.";

  if (msg.includes("apr"))
    return "APR depends on risk band — improving deposit or term can reduce it.";

  return "I hear you — let’s explore a plan that fits your comfort zone.";
};

/* 8️⃣ FCA‑Safe Compliance Helper */
const financeComplianceCheck = (buyer: any, vehicle: any) => {
  const affordability = affordabilityScore(vehicle);
  const fraud = fraudRisk(vehicle);

  const warnings = [];

  if (affordability < 50)
    warnings.push("Affordability risk — buyer may struggle with payments.");

  if (fraud > 50)
    warnings.push("Vehicle risk — fraud indicators detected.");

  warnings.push("Ensure buyer receives cooling‑off period and full disclosure.");

  return warnings;
};

  /* ------------------------------
     ⭐ V15 — Dealer Marketing Engine
  ------------------------------ */
  const generateAd = (vehicle: any) => {
    if (!vehicle) return "Vehicle data missing — unable to generate ad.";

    return `🔥 ${vehicle.make ?? ""} ${vehicle.model ?? ""} ${vehicle.year ?? ""}
• ${vehicle.mileage ?? "Unknown"} miles
• ${vehicle.engineSize ?? "Efficient engine"}
• ${vehicle.transmission ?? "Smooth drive"}
• Priced at £${vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? "N/A"}

Perfect for daily commuting, reliable, clean, and ready to go. Message now to book a viewing.`;
  };

  const keywordHints = (vehicle: any) => {
    if (!vehicle) return "No vehicle data — unable to generate keywords.";

    const keywords = [
      "Full Service History",
      "ULEZ compliant",
      "Low mileage",
      "New arrival",
      "Great condition",
      "Perfect first car",
      "Economical",
      "Reliable",
    ];

    return `Suggested keywords: ${keywords.slice(0, 5).join(", ")}`;
  };

  const postingStrategy = (vehicle: any) => {
    const times = ["7:30pm", "8:15pm", "6:45pm", "9:00pm"];
    return `Best posting time: ${
      times[Math.floor(Math.random() * times.length)]
    }. Use a 3‑photo carousel with a strong hero shot.`;
  };

  const competitorComparison = (vehicle: any) => {
    const competitorViews = Math.floor(Math.random() * (350 - 120 + 1)) + 120;
    const quality = ["Weak", "Average", "Strong", "Very Strong"];

    return `Competitors average ${competitorViews} views. Their ad quality is ${
      quality[Math.floor(Math.random() * quality.length)]
    }.`;
  };

  const engagementPrediction = (vehicle: any) => {
    const views = Math.floor(Math.random() * (260 - 80 + 1)) + 80;
    const saves = Math.floor(Math.random() * (18 - 3 + 1)) + 3;
    const messages = Math.floor(Math.random() * (12 - 1 + 1)) + 1;

    return `Expected: ${views} views • ${saves} saves • ${messages} messages in first 7 days.`;
  };

  /* -------------------------------------------------------
     Provider Value — Export All Modules
  ------------------------------------------------------- */
  return (
    <DealerAIContext.Provider
      value={{
        // V3
        priceVehicle,
        flipAdvice,
        motRiskScore,
        autoWriteListing,
        profitForecast,

        // V4
        photoQualityScore,
        damageDetection,
        marketComparison,
        autoMarketPrice,
        flipProbability,
        stockRotationAdvice,

        // V5
        decodeVIN,
        reconstructServiceHistory,
        predictiveMaintenance,
        buyerPersona,
        salesScript,

        // V6
        fraudRisk,
        odometerTamperRisk,
        auctionPriceHint,
        wholesaleRecommendation,
        conditionScore,

        // V7
        negotiationPredictor,
        leadQualityScore,
        financeApprovalLikelihood,
        testDriveBehaviour,
        closingProbability,

        // V8
        buyerPersonalityProfile,
        upsellRecommendations,
        warrantyRiskScore,
        salesFunnelStage,
        followUpTiming,

        // V9
        buyerEmotion,
        financePlanHint,
        serviceDeskDiagnostics,
        dealClosingMove,
        followUpScript,

        // V16 Finance Intelligence
financeApprovalAI,
depositOptimiser,
aprSensitivity,
paymentStressTest,
lenderMatch,
financeClosingScript,
financeObjectionHandler,
financeComplianceCheck,


        // Finance Engine
        financeAPR,
        monthlyPayment,
        affordabilityScore,
        holdingCost,
        roiScore,

        // CRM Engine
        buyerIntentScore,
        followUpUrgency,
        communicationQuality,
        testDriveProbability,
        buyerProfile,

        // V15 Marketing Engine
        generateAd,
        keywordHints,
        postingStrategy,
        competitorComparison,
        engagementPrediction,
      }}
    >
      {children}
    </DealerAIContext.Provider>
  );
}

export const useDealerAI = () => {
  const ctx = useContext(DealerAIContext);
  if (!ctx) throw new Error("Wrap your app in DealerAIProvider");
  return ctx;
};

