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

// A real wrong reply sitting in the recent-history window can keep
// getting echoed back turn after turn even once the underlying issue
// is fixed — this clears only the caller's own conversation, letting
// them start fresh.
export async function clearPilotBrainConversation(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/messages`, { method: "DELETE", headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("clearPilotBrainConversation: backend unreachable", err);
    return { ok: false, error: "Network error" };
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
export type OperatorActionType =
  | "bookkeeping_categorize"
  | "lead_followup"
  | "rota_shift"
  | "appointment_followup"
  // a small edit to a car's asking price, a lead's status, or a job
  | "record_update";
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

// V7 (The Co-Founder) — real goals with real progress, and one
// executive-level snapshot combining every earlier version's health
// signals plus goal progress.
export type GoalMetric = "revenue" | "profit" | "stockCount" | "leadsAdded" | "salesCount";

export interface BusinessGoal {
  id: string;
  metric: GoalMetric;
  targetValue: number;
  period: "monthly" | "quarterly";
  label: string;
  createdAt: string;
  createdByName: string;
}

export interface GoalProgress {
  goal: BusinessGoal;
  currentValue: number;
  percent: number;
  onTrack: boolean;
}

export async function fetchGoals(): Promise<{ ok: boolean; goals: GoalProgress[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/goals`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, goals: data.goals ?? [], error: data.error };
  } catch (err) {
    console.error("fetchGoals: backend unreachable", err);
    return { ok: false, goals: [], error: "Network error" };
  }
}

export async function createGoal(
  metric: GoalMetric,
  targetValue: number,
  period: "monthly" | "quarterly",
  label: string
): Promise<{ ok: boolean; goal?: BusinessGoal; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ metric, targetValue, period, label }),
    });
    const data = await res.json();
    return { ok: res.ok, goal: data.goal, error: data.error };
  } catch (err) {
    console.error("createGoal: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function deleteGoal(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/goals/${id}`, { method: "DELETE", headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, error: data.error };
  } catch (err) {
    console.error("deleteGoal: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export interface ExecutiveBriefing {
  businessHealth: number;
  marketHealth: number | null;
  strategicHealth: { overall: number; businessHealth: number; marketHealth: number | null; goalProgressAverage: number | null };
  greatestOpportunity: { title: string; detail: string } | null;
  greatestRisk: { title: string; detail?: string; message?: string } | null;
  recommendedFocus: { title: string; detail: string } | null;
  goalProgress: GoalProgress[];
}

export async function fetchExecutiveBriefing(): Promise<{ ok: boolean; briefing?: ExecutiveBriefing; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/executive-briefing`, { headers: authHeaders() });
    const data = await res.json();
    return { ok: res.ok, briefing: data, error: data.error };
  } catch (err) {
    console.error("fetchExecutiveBriefing: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}
