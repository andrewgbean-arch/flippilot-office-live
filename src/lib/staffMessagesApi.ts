import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

export interface StaffMessage {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  message: string;
  createdAt: string;
  readAt?: string;
}

export async function submitStaffMessage(
  toUserId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/staff-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ toUserId, message }),
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
