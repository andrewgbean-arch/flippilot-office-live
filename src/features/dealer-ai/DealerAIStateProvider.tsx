import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";

import { getDealerStock } from "@/backend/car/carStorage.web";
import { seedDealerStock } from "@/dealer/seed";

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { mapVehicleToFlipRecord } from "@/mappers/vehicleToFlipRecord";

type DealerEvent = {
  id: string;
  type: "lead" | "buyer" | "deal" | "risk";
  vehicleId?: string | number;
  payload: any;
  timestamp: string;
};

type DealerAIState = {
  events: DealerEvent[];
  addEvent: (event: Omit<DealerEvent, "timestamp">) => void;

  cars: FlipRecord[];
  reloadCars: () => Promise<void>;
};

const DealerAIStateContext = createContext<DealerAIState | null>(null);

export function DealerAIProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<DealerEvent[]>([]);
  const [cars, setCars] = useState<FlipRecord[]>([]);

  const reloadCars = async () => {
    const stock = getDealerStock(); // dealer stock
     console.log("🔥 Dealer stock from backend:", stock);
  const mapped = (stock as any[]).map((v: any) => mapVehicleToFlipRecord(v));

    setCars(mapped);
  };

  useEffect(() => {
    seedDealerStock().then(() => reloadCars());
  }, []);

  const addEvent: DealerAIState["addEvent"] = (event) => {
    setEvents((prev) => [
      ...prev,
      { ...event, timestamp: new Date().toISOString() },
    ]);
  };

  const value = useMemo(
    () => ({
      events,
      addEvent,
      cars,
      reloadCars,
    }),
    [events, cars]
  );

  return (
    <DealerAIStateContext.Provider value={value}>
      {children}
    </DealerAIStateContext.Provider>
  );
}

export function useDealerAIState() {
  const ctx = useDealerAIStateContext();
  if (!ctx) {
    throw new Error("useDealerAIState must be used within DealerAIProvider");
  }
  return ctx;
}

function useDealerAIStateContext() {
  return React.useContext(DealerAIStateContext);
}
