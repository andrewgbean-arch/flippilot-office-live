import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";
import type { Decision } from "@/lib/decisionTypes";

// Pilot's view and the Devil's Advocate (Pilot Brain V8). Both are owner and
// manager only on the server; a 403 comes back to the screen as plain words
// (see analysisErrorMessage). Each call costs a model call and takes one of the
// dealership's daily allowances, so this is only ever called from a click.

export type AnalysisKind = "recommend" | "challenge";

export interface AnalysisResult {
  ok: boolean;
  status: number; // 0 when the server could not be reached
  decision?: Decision | undefined; // the decision as saved, with the new answer on it
  remaining?: number | undefined; // how many of today's allowances are left
  error?: string | undefined; // the server's plain-English reason, when it gave one
}

const isDecision = (value: unknown): value is Decision =>
  typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string";

export async function runAnalysis(decisionId: string, kind: AnalysisKind): Promise<AnalysisResult> {
  try {
    const res = await fetch(`${BASE_URL}/pilot-brain/decisions/${encodeURIComponent(decisionId)}/${kind}`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data: unknown = await res.json().catch(() => ({}));
    const body = (typeof data === "object" && data !== null ? data : {}) as { ok?: unknown; decision?: unknown; remaining?: unknown; error?: unknown };
    const error = typeof body.error === "string" ? body.error : undefined;
    if (!res.ok || body.ok !== true) return { ok: false, status: res.status, error };
    if (!isDecision(body.decision)) return { ok: false, status: res.status, error: "Pilot's answer came back in a form this screen could not read. Please reload the page." };
    return {
      ok: true,
      status: res.status,
      decision: body.decision,
      remaining: typeof body.remaining === "number" ? body.remaining : undefined,
    };
  } catch (err) {
    console.error("decisionAnalysisApi: backend unreachable", err);
    return { ok: false, status: 0, error: "Network error" };
  }
}
