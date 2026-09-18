import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

export interface PilotBrainMessage {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function fetchPilotBrainMessages(): Promise<{
  ok: boolean;
  messages: PilotBrainMessage[];
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/messages`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, messages: data.messages ?? [], error: data.error };
  } catch (err) {
    console.error("fetchPilotBrainMessages: backend unreachable", err);
    return { ok: false, messages: [], error: "Network error" };
  }
}

export async function sendPilotBrainMessage(message: string): Promise<{
  ok: boolean;
  message?: PilotBrainMessage;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    return { ok: res.ok, message: data.message, error: data.error };
  } catch (err) {
    console.error("sendPilotBrainMessage: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function fetchMorningBriefing(): Promise<{ ok: boolean; briefing?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/briefing`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, briefing: data.briefing, error: data.error };
  } catch (err) {
    console.error("fetchMorningBriefing: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
