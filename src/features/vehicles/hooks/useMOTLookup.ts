import { useState } from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
type MOTResponse = {
  motStatus: "Valid" | "Expired" | "Unknown";
  expiryDate: string | null;
  mileageHistory: { date: string; mileage: number }[];
  advisories: string[];
  failures: string[];
};
export function useMOTLookup() {
  const [loading, setLoading] = useState(false);
  const fetchMOT = async (reg: string): Promise<MOTResponse | null> => {
    try {
      setLoading(true);
      const res = await fetch("https://your-backend.com/mot/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reg }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data as MOTResponse;
    } catch (e) {
      console.log("MOT lookup error", e);
      return null;
    } finally {
      setLoading(false);
    }
  };
  return { fetchMOT, loading };
}
