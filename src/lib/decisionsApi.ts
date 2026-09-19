import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";
import type { Decision, DecisionState, FigureUnit, Outcome } from "@/lib/decisionTypes";

// The Decision Journal (Pilot Brain V8). Owners and managers only: every route
// answers 403 to anyone else, and the page says so plainly. The routes are in
// src/backend/src/routes/decisions.ts.
//
// Every call answers { ok: true, ...data } or { ok: false, error, status } and
// never throws, so a screen only has to look at ok. `error` is always a plain
// sentence that is safe to show as it is.

export type Verdict = "close" | "above" | "below" | "unknown";

// One expectation set beside what happened. expected is PREDICTED (Boss's
// assumption), actual is KNOWN or null (= not known, never 0), delta and
// deltaPercent are INFERRED (worked out from those two).
export interface ExpectationResult {
  expectationId: string;
  metric: string;
  unit: FigureUnit;
  horizonDays: number;
  basis: string;
  expected: number;
  actual: number | null;
  delta: number | null;
  deltaPercent: number | null; // null when 0 was expected, or the result is not known
  verdict: Verdict;
  note: string;
}

export interface DecisionSummary {
  id: string;
  question: string;
  state: DecisionState;
  createdAt: string;
  decidedAt: string | null;
  chosenOption: string | null;
  followedPilot: boolean | null;
  reviewDueAt: string | null;
  hasRecommendation: boolean;
  hasChallenge: boolean;
  simulationCount: number;
}

export interface VerdictTally {
  close: number;
  above: number;
  below: number;
  unknown: number;
  total: number;
}

export interface GroupStats {
  reviewedDecisions: number;
  tally: VerdictTally;
  sentence: string;
}

export interface JournalStats {
  total: number;
  counts: Record<DecisionState, number>;
  followedPilot: number;
  overrodePilot: number;
  reviewedDecisions: number;
  enoughReviewed: boolean;
  closeWithinPercent: number;
  minReviewedForRates: number;
  tally: VerdictTally;
  followedGroup: GroupStats;
  overrodeGroup: GroupStats;
  // The accuracy sentence, or "Too few reviewed decisions to say anything yet."
  summary: string;
}

export interface DecisionDetail {
  decision: Decision;
  state: DecisionState;
  comparison: ExpectationResult[] | null; // only once what happened has been recorded
  closeWithinPercent: number;
}

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; status: number };

// What goes to the server.
export interface DecisionDraftInput {
  question: string;
  context: string;
  options: Array<{ label: string; note?: string }>;
}

export interface ExpectationInput {
  metric: string;
  unit: FigureUnit;
  expected: number;
  horizonDays: number;
  basis: string;
}

export interface DecideBody {
  optionKey: string; // "a".."f" or "other"
  otherText?: string;
  reasoning: string;
  expectations: ExpectationInput[];
  reviewInDays: number;
}

export interface OutcomeBody {
  actuals: Array<{ expectationId: string; actual: number | null; note: string }>;
  notes: string;
  lessons: Outcome["lessons"];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

// The sentence to show when a call fails: the server's own plain-English reason
// where it gave one, otherwise something sensible for the kind of failure.
export function failureMessage(status: number, data: unknown): string {
  const fromServer = isObject(data) && typeof data.error === "string" && data.error.trim() ? data.error.trim() : "";
  if (fromServer) return fromServer;
  if (status === 401) return "Please log in again.";
  if (status === 403) return "Decisions are for owners and managers.";
  if (status === 402) return "Pilot Brain is a premium add-on. Subscribe to it in Billing to use the Decision Journal.";
  if (status === 404) return "That decision wasn't found.";
  return "Something went wrong. Please try again.";
}

async function call<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/decisions${path}`, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...authHeaders() },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // not JSON (a proxy error page, say): handled below
    }
    if (!res.ok || !isObject(data) || data.ok !== true) {
      return { ok: false, error: failureMessage(res.status, data), status: res.status };
    }
    return data as ApiResult<T>;
  } catch (err) {
    console.error(`decisionsApi ${method} ${path}: backend unreachable`, err);
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again.", status: 0 };
  }
}

const idPath = (id: string) => `/${encodeURIComponent(id)}`;

export const fetchDecisions = () => call<{ decisions: DecisionSummary[]; stats: JournalStats }>("GET", "");
export const createDecision = (draft: DecisionDraftInput) => call<DecisionDetail>("POST", "", draft);
export const fetchDecision = (id: string) => call<DecisionDetail>("GET", idPath(id));
export const editDecision = (id: string, changes: Partial<DecisionDraftInput>) => call<DecisionDetail>("PUT", idPath(id), changes);
export const decideDecision = (id: string, body: DecideBody) => call<DecisionDetail>("PUT", `${idPath(id)}/decide`, body);
export const recordOutcome = (id: string, body: OutcomeBody) => call<DecisionDetail>("PUT", `${idPath(id)}/outcome`, body);
