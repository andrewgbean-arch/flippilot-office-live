import { authHeaders } from "@/lib/authToken";
import { loadJson, loadList } from "@/lib/loadJson";
import type { WorkPattern, LeaveRequest, Shift, RotaSettings } from "./plannerTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

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

// Every loader below returns null when the data couldn't be read
// (dropped connection, 401/402/403/5xx, wrong shape) and only ever
// returns [] / real settings for a successful answer. Work patterns and
// shifts are saved back as WHOLE lists, so a failed read taken for "no
// patterns / no shifts" wiped the team's rota on the next edit (see
// loadJson.ts). The rota-settings loader also used to fall back to
// invented default opening hours, which the next save then wrote over
// the real ones.
export async function loadWorkPatterns(): Promise<WorkPattern[] | null> {
  return loadList<WorkPattern>("/work-patterns");
}

export async function saveWorkPatterns(items: WorkPattern[]): Promise<{ ok: boolean; error?: string }> {
  return sendJson("/work-patterns", "PUT", { items });
}

export async function loadLeave(): Promise<LeaveRequest[] | null> {
  return loadList<LeaveRequest>("/leave");
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

export async function loadRotaSettings(): Promise<RotaSettings | null> {
  const data = (await loadJson("/rota-settings")) as { settings?: RotaSettings } | null;
  const settings = data?.settings;
  // The backend answers with its own defaults when none are saved, so a
  // successful response always carries settings.
  return settings && Array.isArray(settings.openDays) ? settings : null;
}

export async function saveRotaSettings(settings: RotaSettings): Promise<{ ok: boolean; error?: string }> {
  return sendJson("/rota-settings", "PUT", settings);
}

export async function loadShifts(): Promise<Shift[] | null> {
  return loadList<Shift>("/shifts");
}

export async function saveShifts(items: Shift[]): Promise<{ ok: boolean; error?: string }> {
  return sendJson("/shifts", "PUT", { items });
}

export async function generateShifts(
  weekStart: string
): Promise<{ ok: boolean; error?: string; generated: Shift[]; items: Shift[] }> {
  return sendJson("/shifts/generate", "POST", { weekStart });
}
