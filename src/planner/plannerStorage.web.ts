import { authHeaders } from "@/lib/authToken";
import type { WorkPattern, LeaveRequest, Shift, RotaSettings } from "./plannerTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
    return await res.json();
  } catch (err) {
    console.error(`${path}: backend unreachable`, err);
    return fallback;
  }
}

async function sendJson(path: string, method: string, body?: unknown): Promise<any> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    return { ...data, status: res.status };
  } catch (err) {
    console.error(`${path}: backend unreachable`, err);
    return { ok: false, error: "Network error", status: 0 };
  }
}

export async function loadWorkPatterns(): Promise<WorkPattern[]> {
  const data = await getJson<{ items?: WorkPattern[] }>("/work-patterns", {});
  return Array.isArray(data.items) ? data.items : [];
}

export async function saveWorkPatterns(items: WorkPattern[]): Promise<{ ok: boolean; error?: string }> {
  return sendJson("/work-patterns", "PUT", { items });
}

export async function loadLeave(): Promise<LeaveRequest[]> {
  const data = await getJson<{ items?: LeaveRequest[] }>("/leave", {});
  return Array.isArray(data.items) ? data.items : [];
}

export async function requestLeave(input: {
  type: string;
  startDate: string;
  endDate: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string; items: LeaveRequest[] }> {
  return sendJson("/leave", "POST", input);
}

export async function decideLeave(
  id: string,
  status: "approved" | "declined"
): Promise<{ ok: boolean; error?: string; items: LeaveRequest[] }> {
  return sendJson(`/leave/${id}`, "PUT", { status });
}

export async function withdrawLeave(id: string): Promise<{ ok: boolean; error?: string; items: LeaveRequest[] }> {
  return sendJson(`/leave/${id}`, "DELETE");
}

export async function loadRotaSettings(): Promise<RotaSettings> {
  const data = await getJson<{ settings?: RotaSettings }>("/rota-settings", {});
  return (
    data.settings ?? { openDays: ["mon", "tue", "wed", "thu", "fri", "sat"], openTime: "09:00", closeTime: "18:00" }
  );
}

export async function saveRotaSettings(settings: RotaSettings): Promise<{ ok: boolean; error?: string }> {
  return sendJson("/rota-settings", "PUT", settings);
}

export async function loadShifts(): Promise<Shift[]> {
  const data = await getJson<{ items?: Shift[] }>("/shifts", {});
  return Array.isArray(data.items) ? data.items : [];
}

export async function saveShifts(items: Shift[]): Promise<{ ok: boolean; error?: string }> {
  return sendJson("/shifts", "PUT", { items });
}

export async function generateShifts(
  weekStart: string
): Promise<{ ok: boolean; error?: string; generated: Shift[]; items: Shift[] }> {
  return sendJson("/shifts/generate", "POST", { weekStart });
}
