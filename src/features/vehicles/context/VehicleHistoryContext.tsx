import { createContext, ReactNode, useContext, useEffect, useMemo, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { calcFlipScore } from "@/features/vehicles/utils/calcFlipScore";
import { useDealerNotifications } from "@/features/dealer-notifications/DealerNotificationsContext";
import { formatMoney } from "@/lib/formatMoney";

// ⭐ Web-safe haptic fallback
const triggerHaptic = () => {
  try {
    if (navigator.vibrate) navigator.vibrate(30);
  } catch {}
};

const STORAGE_KEY = "flippilot_vehicle_history_web_v1";

type VehicleHistoryContextType = {
  vehicles: FlipRecord[];
  addVehicle: (data: Omit<FlipRecord, "id" | "timestamp">) => FlipRecord;
  deleteVehicle: (id: string) => void;
  toggleFavourite: (id: string) => void;
  updateVehicle: (id: string, data: Partial<FlipRecord>) => void;
  clearAll: () => Promise<void>;
  tempVehicle: FlipRecord | null;
  setTempVehicle: (v: FlipRecord | null) => void;

  refreshMot: (vehicleId: string) => Promise<{ success: boolean; error?: any }>;

  totalProfit: number;

  flashTrigger: number;
  setFlashTrigger: (v: number) => void;
};

const VehicleHistoryContext = createContext<VehicleHistoryContextType | null>(null);

export const VehicleHistoryProvider = ({ children }: { children: ReactNode }) => {
  const [vehicles, setVehicles] = useState<FlipRecord[]>([]);
  const [tempVehicle, setTempVehicle] = useState<FlipRecord | null>(null);

  const { addNotification } = useDealerNotifications();

  const [flashTrigger, setFlashTrigger] = useState<number>(0);
  const flash = () => setFlashTrigger(Date.now());

  const milestonesReached = useRef<number[]>([]);
  const profitMilestones = [1000, 5000, 10000, 25000, 50000];

  /* -------------------------------------------------------
     ⭐ LOAD VEHICLES (localStorage)
  ------------------------------------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: FlipRecord[] = JSON.parse(raw);
      setVehicles(parsed);
    } catch (e) {
      console.log("VehicleHistory load error", e);
      setVehicles([]);
    }
  }, []);

  /* -------------------------------------------------------
     ⭐ SAVE VEHICLES (localStorage)
  ------------------------------------------------------- */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
    } catch (e) {
      console.log("VehicleHistory save error", e);
    }
  }, [vehicles]);

  /* -------------------------------------------------------
     ⭐ TOTAL PROFIT + MILESTONES
  ------------------------------------------------------- */
  const totalProfit = useMemo(() => {
    const profit = vehicles.reduce((sum, v) => sum + (v.profit ?? 0), 0);

    profitMilestones.forEach((m) => {
      if (profit >= m && !milestonesReached.current.includes(m)) {
        milestonesReached.current.push(m);

        triggerHaptic();
        flash();

        addNotification({
          type: "SYSTEM",
          title: "Profit Milestone",
          message: `Dealer milestone reached: ${formatMoney(m)}`,
        });
      }
    });

    return profit;
  }, [vehicles]);

  /* -------------------------------------------------------
     ⭐ ADD VEHICLE
  ------------------------------------------------------- */
  const addVehicle = (data: Omit<FlipRecord, "id" | "timestamp">): FlipRecord => {
    const newVehicle: FlipRecord = {
      ...data,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    if (newVehicle.buyPrice != null && newVehicle.sellPrice != null) {
      newVehicle.profit = newVehicle.sellPrice - newVehicle.buyPrice;
    }

    newVehicle.flipScore = calcFlipScore(newVehicle);

    setVehicles((prev) => [newVehicle, ...prev]);
    setTempVehicle(newVehicle);

    triggerHaptic();

    addNotification({
      type: "STOCK",
      title: "Vehicle Added",
      message: `${newVehicle.title} added to stock.`,
    });

    return newVehicle;
  };

  /* -------------------------------------------------------
     ⭐ DELETE VEHICLE
  ------------------------------------------------------- */
  const deleteVehicle = (id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  /* -------------------------------------------------------
     ⭐ TOGGLE FAVOURITE
  ------------------------------------------------------- */
  const toggleFavourite = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, favourite: !v.favourite } : v
      )
    );
  };

  /* -------------------------------------------------------
     ⭐ UPDATE VEHICLE
  ------------------------------------------------------- */
  const updateVehicle = (id: string, data: Partial<FlipRecord>) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;

        const updated = { ...v, ...data };

        if (updated.buyPrice != null && updated.sellPrice != null) {
          updated.profit = updated.sellPrice - updated.buyPrice;

          triggerHaptic();
          flash();

          addNotification({
            type: "SALE",
            title: "Vehicle Sold",
            message: `${updated.title} sold for £${updated.sellPrice}. Profit: £${updated.profit}.`,
          });
        }

        updated.flipScore = calcFlipScore(updated);

        if (updated.flipScore != null) {
          if (updated.flipScore >= 80) {
            triggerHaptic();
            flash();

            addNotification({
              type: "SYSTEM",
              title: "High Flip Score",
              message: `${updated.title} has a strong flip score (${updated.flipScore}).`,
            });
          }

          if (updated.flipScore <= 30) {
            triggerHaptic();

            addNotification({
              type: "SYSTEM",
              title: "Flip Score Warning",
              message: `${updated.title} has a low flip score (${updated.flipScore}).`,
            });
          }
        }

        return updated;
      })
    );
  };

  /* -------------------------------------------------------
     ⭐ MOT REFRESH (mock)
  ------------------------------------------------------- */
  const refreshMot = async (vehicleId: string) => {
    try {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (!vehicle || !vehicle.mot?.reg) {
        return { success: false, error: "Vehicle or registration missing" };
      }

      const reg = vehicle.mot.reg;

      const api = {
        make: vehicle.mot.make,
        model: vehicle.mot.model,
        year: vehicle.mot.year,
        colour: vehicle.mot.colour,
        expiryDate: "2026-12-01",
        keepers: vehicle.mot.keepers ?? 1,
        tests: [
          {
            date: "2025-11-20",
            mileage: vehicle.mot.mileage ?? 50000,
            advisories: [],
            failures: [],
          },
        ],
      };

      const mappedMot = {
        reg,
        make: api.make ?? null,
        model: api.model ?? null,
        year: api.year ?? null,
        colour: api.colour ?? null,
        keepers: api.keepers ?? null,
        mileage: Number(api.tests?.[0]?.mileage ?? 0),
        motExpiry: api.expiryDate ?? null,
        expiryDate: api.expiryDate ?? null,
        advisories: api.tests?.[0]?.advisories ?? [],
        failures: api.tests?.[0]?.failures ?? [],
        mileageHistory:
          api.tests?.map((t: any) => ({
            date: t.date,
            mileage: Number(t.mileage ?? 0),
          })) ?? [],
      };

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicleId
            ? {
                ...v,
                mot: {
                  ...v.mot,
                  ...mappedMot,
                },
              }
            : v
        )
      );

      triggerHaptic();

      addNotification({
        type: "MOT",
        title: "MOT Updated",
        message: `${vehicle.title} MOT data refreshed.`,
      });

      return { success: true };
    } catch (err) {
      console.log("MOT lookup failed:", err);
      return { success: false, error: err };
    }
  };

  /* -------------------------------------------------------
     ⭐ CLEAR ALL
  ------------------------------------------------------- */
  const clearAll = async () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.log("VehicleHistory clear error", e);
    }
    setVehicles([]);
  };

  /* -------------------------------------------------------
     ⭐ CONTEXT VALUE
  ------------------------------------------------------- */
  const value = useMemo<VehicleHistoryContextType>(
    () => ({
      vehicles,
      addVehicle,
      deleteVehicle,
      toggleFavourite,
      updateVehicle,
      clearAll,
      tempVehicle,
      setTempVehicle,
      refreshMot,
      totalProfit,
      flashTrigger,
      setFlashTrigger,
    }),
    [vehicles, tempVehicle, totalProfit, flashTrigger]
  );

  return (
    <VehicleHistoryContext.Provider value={value}>
      {children}
    </VehicleHistoryContext.Provider>
  );
};

export const useVehicleHistory = () => {
  const ctx = useContext(VehicleHistoryContext);
  if (!ctx) throw new Error("Wrap your app in VehicleHistoryProvider");
  return ctx;
};
