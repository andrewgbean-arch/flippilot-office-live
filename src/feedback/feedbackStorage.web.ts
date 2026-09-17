import { authHeaders } from "@/lib/authToken";
import type { FeedbackEntry, FeedbackStatus } from "./feedbackTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

export async function loadFeedback(): Promise<FeedbackEntry[]> {
  try {
    const res = await fetch(`${BASE_URL}/feedback`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadFeedback: backend unreachable", err);
    return [];
  }
}

export async function submitFeedback(input: {
  message: string;
  anonymous: boolean;
}): Promise<{ ok: boolean; error?: string; entry?: FeedbackEntry }> {
  try {
    const res = await fetch(`${BASE_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, entry: data.entry };
  } catch (err) {
    console.error("submitFeedback: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus
): Promise<{ ok: boolean; error?: string; items: FeedbackEntry[] }> {
  try {
    const res = await fetch(`${BASE_URL}/feedback/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    console.error("updateFeedbackStatus: backend unreachable", err);
    return { ok: false, error: "Network error", items: [] };
  }
}
