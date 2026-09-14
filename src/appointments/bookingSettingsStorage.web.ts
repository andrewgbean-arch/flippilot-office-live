import { authHeaders } from "@/lib/authToken";

const BASE_URL = "http://localhost:4001";

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface BookingSettings {
  openDays: WeekDay[];
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  // One-off closures (bank holidays, a short-staffed day) that override
  // openDays for that specific date. yyyy-mm-dd strings.
  closedDates: string[];
}

export async function loadBookingSettings(): Promise<BookingSettings | null> {
  try {
    const res = await fetch(`${BASE_URL}/booking-settings`, { headers: authHeaders() });
    const data = await res.json();
    return data.ok ? data.settings : null;
  } catch (err) {
    console.error("loadBookingSettings: backend unreachable", err);
    return null;
  }
}

export async function saveBookingSettings(settings: BookingSettings): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/booking-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    return { ok: res.ok && data.ok, error: data.error };
  } catch (err) {
    console.error("saveBookingSettings: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
