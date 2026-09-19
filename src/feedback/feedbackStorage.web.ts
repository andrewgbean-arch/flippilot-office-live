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

// Like loadFeedback, but a failure comes back as null instead of an empty
// board, so a refresh can tell "nothing posted" from "couldn't reach the
// server" and never blanks a board that is already on screen.
export async function fetchFeedback(): Promise<FeedbackEntry[] | null> {
  try {
    const res = await fetch(`${BASE_URL}/feedback`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : null;
  } catch (err) {
    console.error("fetchFeedback: backend unreachable", err);
    return null;
  }
}

// `photoIds` are photos already uploaded with uploadMessagePhoto(); with at
// least one, `message` may be empty.
export async function submitFeedback(input: {
  message: string;
  anonymous: boolean;
  photoIds?: string[] | undefined;
}): Promise<{ ok: boolean; error?: string; entry?: FeedbackEntry }> {
  try {
    const res = await fetch(`${BASE_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        message: input.message,
        anonymous: input.anonymous,
        ...(input.photoIds && input.photoIds.length > 0 ? { photoIds: input.photoIds } : {}),
      }),
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
