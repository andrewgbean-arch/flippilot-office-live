import React, { createContext, useContext, useState, useEffect } from "react";
import type { Appointment, AppointmentStatus } from "@/appointments/appointmentTypes";
import { loadAppointments, updateAppointmentStatus } from "@/appointments/appointmentStorage.web";
import { useAuth } from "@/context/AuthContext";

interface AppointmentsContextType {
  appointments: Appointment[];
  loading: boolean;
  decide: (id: string, status: AppointmentStatus) => Promise<string | null>;
}

const AppointmentsContext = createContext<AppointmentsContextType | undefined>(undefined);

export function AppointmentsProvider({ children }: { children: React.ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setAppointments(await loadAppointments());
      setLoading(false);
    })();
  }, [user?.dealershipId]);

  async function decide(id: string, status: AppointmentStatus) {
    const res = await updateAppointmentStatus(id, status);
    if (res.ok) setAppointments(res.items);
    return res.ok ? null : res.error ?? "Could not update appointment";
  }

  return (
    <AppointmentsContext.Provider value={{ appointments, loading, decide }}>{children}</AppointmentsContext.Provider>
  );
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error("useAppointments must be used inside AppointmentsProvider");
  return ctx;
}
