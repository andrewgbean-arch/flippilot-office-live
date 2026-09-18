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

// V4 (Market Intelligence)
export interface MarketHealth {
  overall: number;
  demand: number;
  pricing: number;
  supply: number;
  confidence: "high" | "medium" | "low";
}

export interface PricingIntelligence {
  vehicleId: string;
  make: string;
  model: string;
  askingPrice: number;
  marketAverage: number;
  deltaPercent: number;
  confidence: "high" | "medium" | "low";
}

export interface MarketOpportunity {
  title: string;
  detail: string;
}

export interface TrendResult {
  direction: "rising" | "falling" | "stable" | "insufficient_data";
  changePercent: number | null;
  daysOfHistory: number;
}

export interface MarketCheckResult {
  ok: boolean;
  health: MarketHealth;
  pricingIntel: PricingIntelligence[];
  trends: Record<string, TrendResult>;
  opportunities: MarketOpportunity[];
  vehiclesChecked: number;
  platformInsight: { available: boolean; message: string };
  error?: string;
}

// Real eBay calls behind this — explicitly triggered only (a button
// press), never fetched automatically on page load, unlike the Watcher.
export async function fetchMarketCheck(): Promise<MarketCheckResult | null> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/market`, { headers: authHeaders() });
    const data = await res.json();
    return res.ok ? data : null;
  } catch (err) {
    console.error("fetchMarketCheck: backend unreachable", err);
    return null;
  }
}

// V5 (Super Brain), Chief of Staff Mode — "what should we work on
// today", a real ranked top-4 combining every module built so far.
export interface TodaysPriority {
  rank: number;
  title: string;
  detail: string;
}

export async function fetchTodaysPriorities(): Promise<{ ok: boolean; priorities: TodaysPriority[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/priorities`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, priorities: data.priorities ?? [], error: data.error };
  } catch (err) {
    console.error("fetchTodaysPriorities: backend unreachable", err);
    return { ok: false, priorities: [], error: "Network error" };
  }
}

// V6 (The Operator) — real prepared actions, waiting for a real human
// approval before anything is written. Pilot Brain never executes
// these on its own.
export type OperatorActionType = "bookkeeping_categorize" | "lead_followup";
export type OperatorActionStatus = "prepared" | "rejected" | "completed" | "rolled_back";

export interface OperatorAction {
  id: string;
  type: OperatorActionType;
  status: OperatorActionStatus;
  title: string;
  description: string;
  reason: string;
  payload: Record<string, unknown>;
  preparedAt: string;
  reviewedByName?: string;
  reviewedAt?: string;
  completedAt?: string;
  rolledBackAt?: string;
}

export async function fetchOperatorActions(): Promise<{ ok: boolean; actions: OperatorAction[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/actions`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, actions: data.actions ?? [], error: data.error };
  } catch (err) {
    console.error("fetchOperatorActions: backend unreachable", err);
    return { ok: false, actions: [], error: "Network error" };
  }
}

export async function prepareOperatorActions(): Promise<{ ok: boolean; prepared: number; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/actions/prepare`, { method: "POST", headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, prepared: data.prepared ?? 0, error: data.error };
  } catch (err) {
    console.error("prepareOperatorActions: backend unreachable", err);
    return { ok: false, prepared: 0, error: "Network error" };
  }
}

async function operatorActionCommand(
  id: string,
  command: "approve" | "reject" | "rollback"
): Promise<{ ok: boolean; action?: OperatorAction; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/actions/${id}/${command}`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    return { ok: res.ok, action: data.action, error: data.error };
  } catch (err) {
    console.error(`operatorActionCommand(${command}): backend unreachable`, err);
    return { ok: false, error: "Network error" };
  }
}

export const approveOperatorAction = (id: string) => operatorActionCommand(id, "approve");
export const rejectOperatorAction = (id: string) => operatorActionCommand(id, "reject");
export const rollbackOperatorAction = (id: string) => operatorActionCommand(id, "rollback");
