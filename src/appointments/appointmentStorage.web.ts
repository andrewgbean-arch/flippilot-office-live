import { authHeaders } from "@/lib/authToken";
import type { Appointment, AppointmentStatus, AppointmentOutcome } from "./appointmentTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

export async function loadAppointments(): Promise<Appointment[]> {
  try {
    const res = await fetch(`${BASE_URL}/appointments`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadAppointments: backend unreachable", err);
    return [];
  }
}

export interface AppointmentEdit {
  status?: AppointmentStatus;
  outcome?: AppointmentOutcome;
  requestedDate?: string;
  requestedTime?: string;
  notes?: string;
}

export async function updateAppointment(
  id: string,
  patch: AppointmentEdit
): Promise<{ ok: boolean; error?: string; items: Appointment[] }> {
  try {
    const res = await fetch(`${BASE_URL}/appointments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    console.error("updateAppointment: backend unreachable", err);
    return { ok: false, error: "Network error", items: [] };
  }
}
