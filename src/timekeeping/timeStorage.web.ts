import { authHeaders } from "@/lib/authToken";
import type { TimeEntry } from "./timeTypes";

const BASE_URL = "http://localhost:4001";

interface ClockResult {
  ok: boolean;
  error?: string;
  items: TimeEntry[];
}

export async function loadTimeEntries(): Promise<TimeEntry[]> {
  try {
    const res = await fetch(`${BASE_URL}/timekeeping`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadTimeEntries: backend unreachable", err);
    return [];
  }
}

export async function clockIn(): Promise<ClockResult> {
  try {
    const res = await fetch(`${BASE_URL}/timekeeping/clock-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    console.error("clockIn: backend unreachable", err);
    return { ok: false, error: "Network error", items: [] };
  }
}

export async function clockOut(): Promise<ClockResult> {
  try {
    const res = await fetch(`${BASE_URL}/timekeeping/clock-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    console.error("clockOut: backend unreachable", err);
    return { ok: false, error: "Network error", items: [] };
  }
}

// Manager-only correction of a mistaken or missed punch.
export async function correctTimeEntry(
  id: string,
  changes: { clockIn?: string; clockOut?: string | null }
): Promise<ClockResult> {
  try {
    const res = await fetch(`${BASE_URL}/timekeeping/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(changes),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    console.error("correctTimeEntry: backend unreachable", err);
    return { ok: false, error: "Network error", items: [] };
  }
}
