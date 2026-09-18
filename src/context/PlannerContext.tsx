import React, { createContext, useContext, useState } from "react";
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
import { useGuardedLoad } from "@/lib/useGuardedLoad";

const DEFAULT_ROTA_SETTINGS: RotaSettings = {
  openDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  openTime: "09:00",
  closeTime: "18:00",
};

// Work patterns, shifts and the rota settings are all saved by replacing
// the server's whole copy, so they are only ever saved after ALL of the
// planner's data has loaded. Returned when a write is refused because it
// hasn't.
const NOT_LOADED_ERROR =
  "Couldn't save — the rota hasn't loaded, so saving now could overwrite it. Use Try again at the top of the page, then repeat this.";

interface LoadedPlanner {
  workPatterns: WorkPattern[];
  leave: LeaveRequest[];
  shifts: Shift[];
  rotaSettings: RotaSettings;
}

interface PlannerContextType {
  workPatterns: WorkPattern[];
  leave: LeaveRequest[];
  shifts: Shift[];
  rotaSettings: RotaSettings;
  loading: boolean;
  saveWorkPattern: (pattern: WorkPattern) => Promise<string | null>;
  removeWorkPattern: (userId: string) => Promise<string | null>;
  requestLeave: (input: { type: string; startDate: string; endDate: string; notes?: string }) => Promise<string | null>;
  decideLeave: (id: string, status: "approved" | "declined") => Promise<string | null>;
  withdrawLeave: (id: string) => Promise<string | null>;
  updateRotaSettings: (settings: RotaSettings) => Promise<string | null>;
  saveShift: (shift: Shift) => Promise<string | null>;
  removeShift: (id: string) => Promise<string | null>;
  generateWeek: (weekStart: string) => Promise<{ error: string | null; generatedCount: number }>;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [workPatterns, setWorkPatterns] = useState<WorkPattern[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rotaSettings, setRotaSettings] = useState<RotaSettings>(DEFAULT_ROTA_SETTINGS);
  const { user } = useAuth();

  // Keyed on the authenticated user's dealershipId, not `[]` — same
  // auth-reactive fetch fix applied to every other provider this app
  // (see InventoryProvider/LeadsContext/StaffContext/JobsContext for
  // the confirmed bug a plain mount-once effect causes here).
  //
  // A failed load used to fall back to an empty rota with invented
  // default opening hours, and the next work-pattern/shift/settings save
  // wrote that over the team's real one. Now the planner counts as
  // loaded only if all four reads succeed; otherwise it is reported to
  // the shared banner and guardSave() blocks the writes below.
  const { loading, guardSave } = useGuardedLoad<LoadedPlanner>({
    id: "rota",
    label: "rota",
    key: user?.dealershipId,
    load: async () => {
      const [wp, lv, sh, rs] = await Promise.all([
        loadWorkPatterns(),
        loadLeave(),
        loadShifts(),
        loadRotaSettings(),
      ]);
      if (wp === null || lv === null || sh === null || rs === null) return null;
      return { workPatterns: wp, leave: lv, shifts: sh, rotaSettings: rs };
    },
    apply: data => {
      setWorkPatterns(data.workPatterns);
      setLeave(data.leave);
      setShifts(data.shifts);
      setRotaSettings(data.rotaSettings);
    },
    clear: () => {
      setWorkPatterns([]);
      setLeave([]);
      setShifts([]);
      setRotaSettings(DEFAULT_ROTA_SETTINGS);
    },
  });

  async function saveWorkPattern(pattern: WorkPattern) {
    if (!guardSave()) return NOT_LOADED_ERROR;
    const updated = [...workPatterns.filter(p => p.userId !== pattern.userId), pattern];
    const res = await saveWorkPatterns(updated);
    if (!res.ok) return res.error ?? "Could not save work pattern";
    setWorkPatterns(updated);
    return null;
  }

  async function removeWorkPattern(userId: string) {
    if (!guardSave()) return NOT_LOADED_ERROR;
    const updated = workPatterns.filter(p => p.userId !== userId);
    const res = await saveWorkPatterns(updated);
    if (!res.ok) return res.error ?? "Could not save work pattern";
    setWorkPatterns(updated);
    return null;
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
    if (!guardSave()) return NOT_LOADED_ERROR;
    const res = await saveRotaSettings(settings);
    if (!res.ok) return res.error ?? "Could not save rota settings";
    setRotaSettings(settings);
    return null;
  }

  async function saveShift(shift: Shift) {
    if (!guardSave()) return NOT_LOADED_ERROR;
    const updated = [...shifts.filter(s => s.id !== shift.id), shift];
    const res = await saveShifts(updated);
    if (!res.ok) return res.error ?? "Could not save shift";
    setShifts(updated);
    return null;
  }

  async function removeShift(id: string) {
    if (!guardSave()) return NOT_LOADED_ERROR;
    const updated = shifts.filter(s => s.id !== id);
    const res = await saveShifts(updated);
    if (!res.ok) return res.error ?? "Could not remove shift";
    setShifts(updated);
    return null;
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
