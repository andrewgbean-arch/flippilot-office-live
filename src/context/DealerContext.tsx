import React, { createContext, useContext, useEffect, useState } from "react";
import { authHeaders } from "@/lib/authToken";

const BASE_URL = "http://localhost:4001";

// Shape of the dealer data
interface DealerInfo {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

// Context shape
interface DealerContextType {
  dealer: DealerInfo | null;
  loading: boolean;
  setDealer: (dealer: DealerInfo) => void;
  updateDealer: (patch: { name?: string; phone?: string; address?: string }) => Promise<void>;
}

// Create context
const DealerContext = createContext<DealerContextType | undefined>(undefined);

// Provider
//
// This used to hand out a hardcoded { name: "FlipPilot Motors" } stub
// forever, regardless of what dealership you actually signed up as —
// the public marketplace page (DealerPublicPage.tsx) reads dealer.name
// directly, so every dealer's public page showed the same fake name.
// Now it loads the real dealership from the backend (already built for
// billing/trial status) and can save edits back to it.
export function DealerContextProvider({ children }: { children: React.ReactNode }) {
  const [dealer, setDealer] = useState<DealerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/dealership/me`, { headers: authHeaders() });
        const data = await res.json();
        if (data.ok && data.dealership) {
          setDealer({
            id: data.dealership.id,
            name: data.dealership.name,
            phone: data.dealership.phone,
            address: data.dealership.address,
          });
        }
      } catch (err) {
        console.error("DealerContext: failed to load dealership", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function updateDealer(patch: { name?: string; phone?: string; address?: string }) {
    const res = await fetch(`${BASE_URL}/dealership/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || "Failed to update dealership");
    }
    setDealer({
      id: data.dealership.id,
      name: data.dealership.name,
      phone: data.dealership.phone,
      address: data.dealership.address,
    });
  }

  return (
    <DealerContext.Provider value={{ dealer, loading, setDealer, updateDealer }}>
      {children}
    </DealerContext.Provider>
  );
}

// Hook for easy access
export function useDealer() {
  const context = useContext(DealerContext);
  if (!context) {
    throw new Error("useDealer must be used inside DealerContextProvider");
  }
  return context;
}
