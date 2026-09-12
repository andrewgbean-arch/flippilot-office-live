// ---------------------------------------------
// DealerAI V17 — Provider
// ---------------------------------------------

import React, { createContext, useContext } from "react";

import {
  DealerAIV17,
  Vehicle,
  Buyer,
  Lead,
  RiskBand,
  bandFromScore,   // ⭐ correct import location
} from "./dealerai-v17-types";

import {
  scoreProfile,
  financeAPR,
  monthlyPayment,
  affordabilityScore,
  depositSuggestion,
  closingProbability,
  buyerEmotion,
  buyerPersona,
  fraudRisk,
  conditionScore,
  generateAd,
} from "./dealerai-v17-helpers";

const DealerAIContext = createContext<DealerAIV17 | null>(null);

export function DealerAIV17Provider({ children }: { children: React.ReactNode }) {
  const value: DealerAIV17 = {
    scoreProfile,
    riskBand: bandFromScore,
    financeAPR,
    monthlyPayment,
    affordabilityScore,
    depositSuggestion,
    closingProbability,

    closingHint: (vehicle: Vehicle, buyer: Buyer, lead: Lead) => {
      const prob = closingProbability(vehicle, buyer, lead);
      const emotion = buyerEmotion(lead);

      if (prob > 80) return "Send finance quote and propose viewing slot.";
      if (emotion === "Excited") return "Send a short video and lock in a time.";
      if (emotion === "Price‑Sensitive") return "Offer small goodwill or highlight value.";
      return "Send friendly check‑in and keep momentum.";
    },

    fraudRisk,
    conditionScore,
    buyerPersona,
    buyerEmotion,
    generateAd,
  };

  return (
    <DealerAIContext.Provider value={value}>
      {children}
    </DealerAIContext.Provider>
  );
}

export const useDealerAI = () => {
  const ctx = useContext(DealerAIContext);
  if (!ctx) throw new Error("DealerAI V17 not available");
  return ctx;
};
