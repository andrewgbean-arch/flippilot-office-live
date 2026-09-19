import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";
import type { MessagePhoto } from "@/lib/messagePhotosApi";

export interface StaffMessage {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  // Empty for a message that's only photos.
  message: string;
  // Signed links that expire after 24 hours and are re-issued on every fetch,
  // so they're shown as they arrive and never kept.
  photos?: MessagePhoto[];
  createdAt: string;
  readAt?: string;
}

// `photoIds` are photos already uploaded with uploadMessagePhoto(); with at
// least one, `message` may be empty.
export async function submitStaffMessage(
  toUserId: string,
  message: string,
  photoIds?: string[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/staff-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        toUserId,
        message,
        ...(photoIds && photoIds.length > 0 ? { photoIds } : {}),
      }),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("submitStaffMessage: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function fetchStaffMessages(): Promise<{
  ok: boolean;
  messages: StaffMessage[];
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/staff-messages`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, messages: data.messages ?? [], error: data.error };
  } catch (err) {
    console.error("fetchStaffMessages: backend unreachable", err);
    return { ok: false, messages: [], error: "Network error" };
  }
}
