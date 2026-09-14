import React, { createContext, useContext, useState, useEffect } from "react";
import type { WorkPattern, LeaveRequest, Shift, RotaSettings } from "@/planner/plannerTypes";
import {
  loadWorkPatterns,
  saveWorkPatterns,
  loadLeave,
  requestLeave as requestLeaveApi,
  decideLeave as decideLeaveApi,
  withdrawLeave as withdrawLeaveApi,
  loadRotaSettings,
  saveRotaSettings,
  loadShifts,
  saveShifts,
  generateShifts as generateShiftsApi,
} from "@/planner/plannerStorage.web";
import { useAuth } from "@/context/AuthContext";
import { sendNotification } from "@/notifications/notificationStorage.web";

const DEFAULT_ROTA_SETTINGS: RotaSettings = {
  openDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  openTime: "09:00",
  closeTime: "18:00",
};

interface PlannerContextType {
  workPatterns: WorkPattern[];
  leave: LeaveRequest[];
  shifts: Shift[];
  rotaSettings: RotaSettings;
  loading: boolean;
  saveWorkPattern: (pattern: WorkPattern) => Promise<void>;
  removeWorkPattern: (userId: string) => Promise<void>;
  requestLeave: (input: { type: string; startDate: string; endDate: string; notes?: string }) => Promise<string | null>;
  decideLeave: (id: string, status: "approved" | "declined") => Promise<string | null>;
  withdrawLeave: (id: string) => Promise<string | null>;
  updateRotaSettings: (settings: RotaSettings) => Promise<void>;
  saveShift: (shift: Shift) => Promise<void>;
  removeShift: (id: string) => Promise<void>;
  generateWeek: (weekStart: string) => Promise<{ error: string | null; generatedCount: number }>;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [workPatterns, setWorkPatterns] = useState<WorkPattern[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rotaSettings, setRotaSettings] = useState<RotaSettings>(DEFAULT_ROTA_SETTINGS);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Keyed on the authenticated user's dealershipId, not `[]` — same
  // auth-reactive fetch fix applied to every other provider this app
  // (see InventoryProvider/LeadsContext/StaffContext/JobsContext for
  // the confirmed bug a plain mount-once effect causes here).
  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [wp, lv, sh, rs] = await Promise.all([
        loadWorkPatterns(),
        loadLeave(),
        loadShifts(),
        loadRotaSettings(),
      ]);
      setWorkPatterns(wp);
      setLeave(lv);
      setShifts(sh);
      setRotaSettings(rs);
      setLoading(false);
    })();
  }, [user?.dealershipId]);

  async function saveWorkPattern(pattern: WorkPattern) {
    const updated = [...workPatterns.filter(p => p.userId !== pattern.userId), pattern];
    setWorkPatterns(updated);
    await saveWorkPatterns(updated);
  }

  async function removeWorkPattern(userId: string) {
    const updated = workPatterns.filter(p => p.userId !== userId);
    setWorkPatterns(updated);
    await saveWorkPatterns(updated);
  }

  async function handleRequestLeave(input: { type: string; startDate: string; endDate: string; notes?: string }) {
    const res = await requestLeaveApi(input);
    if (res.ok) setLeave(res.items);
    return res.ok ? null : res.error ?? "Could not submit leave request";
  }

  async function handleDecideLeave(id: string, status: "approved" | "declined") {
    const target = leave.find(l => l.id === id);
    const res = await decideLeaveApi(id, status);
    if (res.ok) {
      setLeave(res.items);
      if (target && target.userId !== user?.id) {
        sendNotification({
          userId: target.userId,
          title: status === "approved" ? "Leave request approved" : "Leave request declined",
          message: `${target.type} — ${target.startDate} to ${target.endDate}`,
          type: status === "approved" ? "success" : "warning",
        }).catch(() => {});
      }
    }
    return res.ok ? null : res.error ?? "Could not update leave request";
  }

  async function handleWithdrawLeave(id: string) {
    const res = await withdrawLeaveApi(id);
    if (res.ok) setLeave(res.items);
    return res.ok ? null : res.error ?? "Could not withdraw leave request";
  }

  async function updateRotaSettings(settings: RotaSettings) {
    setRotaSettings(settings);
    await saveRotaSettings(settings);
  }

  async function saveShift(shift: Shift) {
    const updated = [...shifts.filter(s => s.id !== shift.id), shift];
    setShifts(updated);
    await saveShifts(updated);
  }

  async function removeShift(id: string) {
    const updated = shifts.filter(s => s.id !== id);
    setShifts(updated);
    await saveShifts(updated);
  }

  async function generateWeek(weekStart: string) {
    const res = await generateShiftsApi(weekStart);
    if (res.ok) {
      setShifts(res.items);
      return { error: null, generatedCount: res.generated.length };
    }
    return { error: res.error ?? "Could not generate rota", generatedCount: 0 };
  }

  return (
    <PlannerContext.Provider
      value={{
        workPatterns,
        leave,
        shifts,
        rotaSettings,
        loading,
        saveWorkPattern,
        removeWorkPattern,
        requestLeave: handleRequestLeave,
        decideLeave: handleDecideLeave,
        withdrawLeave: handleWithdrawLeave,
        updateRotaSettings,
        saveShift,
        removeShift,
        generateWeek,
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside PlannerProvider");
  return ctx;
}
