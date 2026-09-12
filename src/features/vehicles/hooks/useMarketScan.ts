import { useState } from "react";

export type MarketScanResult = {
  googlePriceMin?: number | null;
  googlePriceMax?: number | null;
  lowest?: number | null;
  highest?: number | null;
  average?: number | null;
  smartPrice?: number | null;
  soldCount?: number | null;
  demandScore?: number | null;
  aiPriceMin?: number | null;
  aiPriceMax?: number | null;
  aiPriceConfidence?: number | null;
};

export function useMarketScan() {
  const [loading, setLoading] = useState(false);

  const fetchMarketScan = async (query: {
    title: string;
    buyPrice: number | null;
    sellPrice: number | null;
    notes: string;
    images: string[];
  }): Promise<MarketScanResult | null> => {
    try {
      setLoading(true);

      // 🔥 replace with your backend endpoint
      const res = await fetch("https://your-backend.com/market/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data as MarketScanResult;
    } catch (e) {
      console.log("Market scan error", e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchMarketScan, loading };
}
