import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { Appointment } from "@/appointments/appointmentTypes";
import { loadAppointments, updateAppointment, type AppointmentEdit } from "@/appointments/appointmentStorage.web";
import { useAuth } from "@/context/AuthContext";

interface AppointmentsContextType {
  appointments: Appointment[];
  loading: boolean;
  update: (id: string, patch: AppointmentEdit) => Promise<string | null>;
  // Fetches the list again (the Bookings screen calls it when it opens).
  refresh: () => Promise<void>;
}

// Customers book from the public page at any time, so the list is fetched
// again every minute while the app is on screen, and straight away when
// someone comes back to it. It used to be read once at sign-in, so a dealer
// who kept FlipPilot open all day never saw a new booking until a reload.
const REFRESH_MS = 60_000;

const AppointmentsContext = createContext<AppointmentsContextType | undefined>(undefined);

export function AppointmentsProvider({ children }: { children: React.ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Bumped by every load and every save: a load only lands if nothing newer
  // happened while it was in flight, so a slow refresh can't undo a save.
  const version = useRef(0);
  const dealershipId = user?.dealershipId;

  const refresh = useCallback(async () => {
    if (!dealershipId) return;
    const v = ++version.current;
    const items = await loadAppointments();
    // A failed read keeps what's on screen: it is never "no bookings".
    if (items && v === version.current) setAppointments(items);
  }, [dealershipId]);

  useEffect(() => {
    if (!dealershipId) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    refresh().finally(() => { if (live) setLoading(false); });

    const onScreen = () => document.visibilityState === "visible";
    const timer = window.setInterval(() => { if (onScreen()) void refresh(); }, REFRESH_MS);
    const back = () => { if (onScreen()) void refresh(); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
    };
  }, [dealershipId, refresh]);

  async function update(id: string, patch: AppointmentEdit) {
    version.current++;
    const res = await updateAppointment(id, patch);
    if (res.ok && res.items) setAppointments(res.items);
    else if (res.ok) void refresh();
    return res.ok ? null : res.error ?? "Could not update appointment";
  }

  return <AppointmentsContext.Provider value={{ appointments, loading, update, refresh }}>{children}</AppointmentsContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error("useAppointments must be used inside AppointmentsProvider");
  return ctx;
}
