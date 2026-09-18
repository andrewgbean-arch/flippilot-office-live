import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

export interface WebSearchSource {
  url: string;
  title: string;
  pageAge?: string;
}

export interface WebSearchLogEntry {
  id: string;
  at: string;
  askedByName: string;
  query: string;
  resultCount: number;
  sources: WebSearchSource[];
  errorCode?: string;
}

export interface WebAccessState {
  enabled: boolean;
  dailyCap: number;
  usedToday: number;
  // Only the owner is sent the log of what was searched.
  recent: WebSearchLogEntry[];
}

export interface WebAccessResult {
  ok: boolean;
  status: number;
  state?: WebAccessState;
  error?: string;
}

async function call(method: "GET" | "PUT", body?: object): Promise<WebAccessResult> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/web-access`, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...authHeaders() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return { ok: false, status: res.status, error: data.error };
    return {
      ok: true,
      status: res.status,
      state: {
        enabled: data.enabled === true,
        dailyCap: Number(data.dailyCap) || 0,
        usedToday: Number(data.usedToday) || 0,
        recent: Array.isArray(data.recent) ? data.recent : [],
      },
    };
  } catch (err) {
    console.error("pilotBrainWebApi: backend unreachable", err);
    return { ok: false, status: 0, error: "Network error" };
  }
}

export const fetchWebAccess = () => call("GET");
export const setWebAccess = (enabled: boolean) => call("PUT", { enabled });
