import { authHeaders } from "@/lib/authToken";
import type { Appointment, AppointmentStatus } from "./appointmentTypes";

const BASE_URL = "http://localhost:4001";

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

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<{ ok: boolean; error?: string; items: Appointment[] }> {
  try {
    const res = await fetch(`${BASE_URL}/appointments/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    console.error("updateAppointmentStatus: backend unreachable", err);
    return { ok: false, error: "Network error", items: [] };
  }
}
