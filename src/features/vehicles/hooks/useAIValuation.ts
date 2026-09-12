import { useState } from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";


type AIResponse = {
  recommendedSellPrice: number;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  aiPriceMin: number;
  aiPriceMax: number;
  insights: string;
};

export function useAIValuation() {
  const [loading, setLoading] = useState(false);

  const fetchAIValuation = async (vehicle: FlipRecord): Promise<AIResponse | null> => {
    try {
      setLoading(true);

      // 🔥 Replace with your backend endpoint
      const res = await fetch("https://your-backend.com/ai/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicle),
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data as AIResponse;
    } catch (e) {
      console.log("AI valuation error", e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchAIValuation, loading };
}
