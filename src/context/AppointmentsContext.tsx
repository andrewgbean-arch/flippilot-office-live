import React, { createContext, useContext, useState, useEffect } from "react";
import type { Appointment } from "@/appointments/appointmentTypes";
import { loadAppointments, updateAppointment, type AppointmentEdit } from "@/appointments/appointmentStorage.web";
import { useAuth } from "@/context/AuthContext";

interface AppointmentsContextType {
  appointments: Appointment[];
  loading: boolean;
  update: (id: string, patch: AppointmentEdit) => Promise<string | null>;
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

  async function update(id: string, patch: AppointmentEdit) {
    const res = await updateAppointment(id, patch);
    if (res.ok) setAppointments(res.items);
    return res.ok ? null : res.error ?? "Could not update appointment";
  }

  return <AppointmentsContext.Provider value={{ appointments, loading, update }}>{children}</AppointmentsContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error("useAppointments must be used inside AppointmentsProvider");
  return ctx;
}
