import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

export type SecurityEventKind = "blocked_message" | "lockout" | "reply_withheld" | "memory_rejected" | "probing";

export interface SecurityEvent {
  id: string;
  at: string;
  userId: string;
  userName: string;
  kind: SecurityEventKind;
  categories: string[];
  // What was actually typed (flattened and capped). Owner-only.
  snippet: string;
}

export interface PausedPerson {
  userId: string;
  userName: string;
  until: string;
}

export interface SecurityLog {
  events: SecurityEvent[];
  locked: PausedPerson[];
}

export interface SecurityResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function fetchSecurityLog(): Promise<SecurityResult<SecurityLog>> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/security-log`, { headers: authHeaders() });
    const body = await res.json();
    if (!res.ok || !body.ok) return { ok: false, error: body.error };
    return {
      ok: true,
      data: {
        events: Array.isArray(body.events) ? body.events : [],
        locked: Array.isArray(body.locked) ? body.locked : [],
      },
    };
  } catch (err) {
    console.error("pilotBrainSecurityApi: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function unlockPerson(userId: string): Promise<SecurityResult<null>> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/security-log/unlock/${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: authHeaders(),
    });
    const body = await res.json();
    return res.ok && body.ok ? { ok: true, data: null } : { ok: false, error: body.error };
  } catch (err) {
    console.error("pilotBrainSecurityApi: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
