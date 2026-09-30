import React, { createContext, useContext, useEffect, useState } from "react";
import { authHeaders } from "@/lib/authToken";
import { useAuth } from "@/context/AuthContext";

import { BASE_URL } from "@/lib/apiBaseUrl";

// Shape of the dealer data
interface DealerInfo {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  // Settings: sign everyone out after this many minutes unused (0 = never,
  // unset = the default). See lib/idleSignOut.ts.
  autoSignOutMinutes?: number;
}

type DealerPatch = { name?: string; phone?: string; address?: string; vatNumber?: string; autoSignOutMinutes?: number };

// Context shape
interface DealerContextType {
  dealer: DealerInfo | null;
  loading: boolean;
  setDealer: (dealer: DealerInfo) => void;
  updateDealer: (patch: DealerPatch) => Promise<void>;
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
  const { user } = useAuth();
  // Which signed-in dealership the load below has finished for (whether it
  // worked or not). `loading` is worked out from it on every render, so it is
  // true from the very render a user appears until their own dealership has
  // arrived. A flag set by the effect was a render late: the automatic
  // sign-out saw "loaded, no setting", used the 15-minute default over an
  // owner's longer time or "never", and signed out on page load.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const wanted = user?.dealershipId ?? null;
  const loading = wanted !== null && loadedFor !== wanted;

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
    const dealershipId = user?.dealershipId;
    if (!dealershipId) return;

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
            autoSignOutMinutes: data.dealership.autoSignOutMinutes,
          });
        }
      } catch (err) {
        console.error("DealerContext: failed to load dealership", err);
      } finally {
        setLoadedFor(dealershipId);
      }
    })();
  }, [user?.dealershipId]);

  async function updateDealer(patch: DealerPatch) {
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
      autoSignOutMinutes: data.dealership.autoSignOutMinutes,
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
