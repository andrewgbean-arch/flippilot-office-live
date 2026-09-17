import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

export type SupportMessageStatus = "new" | "reviewed" | "resolved";

export interface SupportMessage {
  id: string;
  dealershipId: string;
  dealershipName: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  status: SupportMessageStatus;
  createdAt: string;
  adminReply?: string;
  adminReplyAt?: string;
}

export async function submitSupportMessage(message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/support/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("submitSupportMessage: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function checkIsSupportAdmin(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/support/is-admin`, { headers: authHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.isAdmin);
  } catch {
    return false;
  }
}

export async function fetchSupportMessages(): Promise<{ ok: boolean; messages: SupportMessage[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/support/messages`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, messages: data.messages ?? [], error: data.error };
  } catch (err) {
    console.error("fetchSupportMessages: backend unreachable", err);
    return { ok: false, messages: [], error: "Network error" };
  }
}

export async function updateSupportMessageStatus(
  id: string,
  status: SupportMessageStatus
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/support/messages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("updateSupportMessageStatus: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function replyToSupportMessage(
  id: string,
  reply: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/support/messages/${id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ reply }),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("replyToSupportMessage: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function fetchMySupportMessages(): Promise<{
  ok: boolean;
  messages: SupportMessage[];
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/support/my-messages`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, messages: data.messages ?? [], error: data.error };
  } catch (err) {
    console.error("fetchMySupportMessages: backend unreachable", err);
    return { ok: false, messages: [], error: "Network error" };
  }
}
