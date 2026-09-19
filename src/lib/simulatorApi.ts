import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";
import type { AuthUser } from "@/context/AuthContext";
import { parseConfidence, type Decision, type SimulationSnapshot } from "@/lib/decisionTypes";

// The Simulator's side of the wire (Pilot Brain V8). The routes are in
// src/backend/src/routes/simulator.ts: owners and managers only. A simulation is
// arithmetic on the dealership's own records; running one changes nothing, and
// "saving" one only adds it to a decision record. The limits below are the
// server's (src/backend/src/engines/simulator.ts): a backend test fails if they drift.

export const SIM_AMOUNT_MIN = 1;
export const SIM_AMOUNT_MAX = 1000000;
export const SIM_CUT_MIN = 0;
export const SIM_CUT_MAX = 10000;
export const SIM_DAYS_MIN = 7;
export const SIM_DAYS_MAX = 365;
export const SIM_EXTRA_SALES_MIN = 0;
export const SIM_EXTRA_SALES_MAX = 500;
export const SIM_DEFAULT_DAYS = 60;
export const SIM_DEFAULT_CUT = 500;

// A run result has no id yet: nothing is saved until Boss saves it to a decision.
export type SimulationPreview = Omit<SimulationSnapshot, "id">;

export type SimulationRequest =
  | { kind: "stock_investment"; params: { amountGbp: number } }
  | { kind: "price_cut_aged_stock"; params: { daysThreshold?: number; cutGbp?: number; extraSalesFromCut?: number } };

export const NO_ACCESS_MESSAGE = "Only owners and managers can use the Simulator.";
export const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
const GENERIC_MESSAGE = "Something went wrong working that out. Please try again.";

// The same rule the server enforces (owner, or a manager account): used only to
// show the plain "owners and managers only" message instead of controls that would 403.
export function canUseSimulator(user: Pick<AuthUser, "role" | "staffRole"> | null | undefined): boolean {
  if (!user) return false;
  return user.role === "owner" || user.staffRole === "manager";
}

export type RunResult = { ok: true; simulation: SimulationPreview } | { ok: false; status: number; error: string };
export type AttachResult = { ok: true; decision: Decision; simulation: SimulationSnapshot } | { ok: false; status: number; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Only something that looks like a simulation, with a confidence that is one of
// the three words (never a percentage), is ever shown.
function looksLikeSimulation(v: unknown): v is SimulationPreview {
  return (
    isObject(v) &&
    Array.isArray(v.scenarios) &&
    Array.isArray(v.assumptions) &&
    Array.isArray(v.confidenceReasons) &&
    typeof v.title === "string" &&
    parseConfidence(v.confidence) !== null
  );
}

function failure(status: number, data: unknown): { ok: false; status: number; error: string } {
  if (status === 403) return { ok: false, status, error: NO_ACCESS_MESSAGE };
  if (status === 401) return { ok: false, status, error: "Please log in again." };
  const message = isObject(data) && typeof data.error === "string" && data.error.trim() !== "" ? data.error : GENERIC_MESSAGE;
  return { ok: false, status, error: message };
}

async function post(path: string, request: SimulationRequest): Promise<{ status: number; ok: boolean; data: unknown } | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(request),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null; // not JSON (a gateway error page, say): handled as a generic failure
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    console.error("simulatorApi: backend unreachable", err);
    return null;
  }
}

// Works one out and shows it. Saves nothing.
export async function runSimulation(request: SimulationRequest): Promise<RunResult> {
  const sent = await post("/pilot-brain/simulator/run", request);
  if (!sent) return { ok: false, status: 0, error: NETWORK_MESSAGE };
  if (!sent.ok) return failure(sent.status, sent.data);
  const simulation = isObject(sent.data) ? sent.data.simulation : undefined;
  if (!looksLikeSimulation(simulation)) return { ok: false, status: sent.status, error: GENERIC_MESSAGE };
  return { ok: true, simulation };
}

// Adds a simulation to a decision that is still open. The server works it out
// again from these numbers itself: only the request is sent, never a result.
export async function attachSimulation(decisionId: string, request: SimulationRequest): Promise<AttachResult> {
  const sent = await post(`/pilot-brain/decisions/${encodeURIComponent(decisionId)}/simulations`, request);
  if (!sent) return { ok: false, status: 0, error: NETWORK_MESSAGE };
  if (!sent.ok) return failure(sent.status, sent.data);
  const data = isObject(sent.data) ? sent.data : {};
  const decision = data.decision;
  const simulation = data.simulation;
  if (!isObject(decision) || !Array.isArray(decision.simulations) || !looksLikeSimulation(simulation)) {
    return { ok: false, status: sent.status, error: GENERIC_MESSAGE };
  }
  return { ok: true, decision: decision as unknown as Decision, simulation: simulation as SimulationSnapshot };
}
