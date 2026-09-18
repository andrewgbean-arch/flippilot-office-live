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

export interface WatcherAlert {
  severity: "info" | "warning" | "critical";
  category: "lead" | "inventory" | "appointment" | "activity";
  title: string;
  message: string;
  sourceKey: string;
}

export interface WatcherHealth {
  overall: number;
  salesHealth: number;
  leadHealth: number;
  inventoryHealth: number;
  activityHealth: number;
}

export interface WatcherResult {
  ok: boolean;
  health: WatcherHealth;
  alerts: WatcherAlert[];
  risks: { title: string; message: string }[];
  activity: {
    leadsAddedLast7Days: number;
    appointmentsBookedLast7Days: number;
    tasksCompletedLast7Days: number;
    leadsWonTotal: number;
  };
  error?: string;
}

export async function fetchWatcher(): Promise<WatcherResult | null> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/watcher`, { headers: authHeaders() });
    const data = await res.json();
    return res.ok ? data : null;
  } catch (err) {
    console.error("fetchWatcher: backend unreachable", err);
    return null;
  }
}

export const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
export type OpenAiVoice = (typeof OPENAI_VOICES)[number];

// Real AI voice (OpenAI tts-1) — returns a playable object URL, or null
// if it's not available/configured/failed, so the caller can fall back
// to the free browser voice rather than going silent.
export async function fetchSpeech(text: string, voice: OpenAiVoice): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("fetchSpeech: backend unreachable", err);
    return null;
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

export type ReviewPeriod = "daily" | "weekly" | "monthly" | "quarterly";

export async function fetchPerformanceReview(period: ReviewPeriod): Promise<{ ok: boolean; review?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/review?period=${period}`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, review: data.review, error: data.error };
  } catch (err) {
    console.error("fetchPerformanceReview: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
