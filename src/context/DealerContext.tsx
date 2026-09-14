import React, { createContext, useContext, useEffect, useState } from "react";
import { authHeaders } from "@/lib/authToken";
import { useAuth } from "@/context/AuthContext";

const BASE_URL = "http://localhost:4001";

// Shape of the dealer data
interface DealerInfo {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
}

// Context shape
interface DealerContextType {
  dealer: DealerInfo | null;
  loading: boolean;
  setDealer: (dealer: DealerInfo) => void;
  updateDealer: (patch: { name?: string; phone?: string; address?: string; vatNumber?: string }) => Promise<void>;
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
  const { user } = useAuth();

  // Was `}, [])` — fetched once at app boot and never again. Since
  // every provider like this one sits above the router and never
  // unmounts, a real user who logs in via the normal client-side form
  // (no full page reload) would be stuck forever with whatever this
  // fetched during the brief unauthenticated moment before they logged
  // in (a 401 in this case, silently leaving `dealer` at null) — the
  // dealership name/phone/address would just never appear until they
  // manually refreshed the page. Depending on the authenticated user's
  // dealershipId makes this re-run exactly when a real login completes
  // (or a different account logs in over an old session in the same tab).
  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }

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
            vatNumber: data.dealership.vatNumber,
          });
        }
      } catch (err) {
        console.error("DealerContext: failed to load dealership", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.dealershipId]);

  async function updateDealer(patch: { name?: string; phone?: string; address?: string; vatNumber?: string }) {
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
      vatNumber: data.dealership.vatNumber,
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
