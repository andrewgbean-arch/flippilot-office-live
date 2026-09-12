import React, { createContext, useContext, useState } from "react";

// Shape of the dealer data
interface DealerInfo {
  id: string;
  name: string;
  branch?: string;
}

// Context shape
interface DealerContextType {
  dealer: DealerInfo | null;
  setDealer: (dealer: DealerInfo) => void;
}

// Create context
const DealerContext = createContext<DealerContextType | undefined>(undefined);

// Provider
export function DealerContextProvider({ children }: { children: React.ReactNode }) {
  const [dealer, setDealer] = useState<DealerInfo | null>({
    id: "default-dealer",
    name: "FlipPilot Motors",
    branch: "Main Branch",
  });

  return (
    <DealerContext.Provider value={{ dealer, setDealer }}>
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
