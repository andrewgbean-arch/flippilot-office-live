import React, { createContext, useContext, useMemo } from "react";
import { DealershipAIEngine } from "../ai/core/DealershipAIEngine";
import { FlipRecord } from "../features/vehicles/models/FlipRecord";





const DealershipAIContext = createContext<DealershipAIEngine | null>(null);

export function DealershipAIProvider({
  vehicles,
  leads,
  branches,
  children,
}: {
  vehicles: FlipRecord[];
  leads: any[];
  branches?: { name: string; vehicles: FlipRecord[]; leads: any[] }[];
  children: React.ReactNode;
}) {
  const engine = useMemo(() => {
    return new DealershipAIEngine(vehicles, leads, branches);
  }, [vehicles, leads, branches]);

  return (
    <DealershipAIContext.Provider value={engine}>
      {children}
    </DealershipAIContext.Provider>
  );
}

export function useDealershipAI() {
  const ctx = useContext(DealershipAIContext);
  if (!ctx) {
    throw new Error("useDealershipAI must be used inside DealershipAIProvider");
  }
  return ctx;
}
