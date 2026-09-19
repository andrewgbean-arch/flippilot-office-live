import { decisionState, type Confidence, type Decision } from "@/lib/decisionTypes";
import { runAnalysis, type AnalysisKind, type AnalysisResult } from "@/lib/decisionAnalysisApi";

// The decisions the Analysis card makes, kept apart from the drawing so they can
// be tested on their own.

export type AnalysisAvailability = { available: true } | { available: false; reason: string };

// Pilot's view and the challenge exist to help Boss decide, so they are only on
// offer while the decision is open. Once Boss has decided (or it has been
// reviewed) the record is left alone: what Pilot said stays visible, but nothing
// new is asked. The server refuses too; this stops the button being offered.
export function analysisAvailability(
  decision: Pick<Decision, "bossDecision" | "outcome" | "reviewDueAt">,
  now: number
): AnalysisAvailability {
  const state = decisionState(decision, now);
  if (state === "open") return { available: true };
  if (state === "reviewed") return { available: false, reason: "This decision has been reviewed, so Pilot's view is closed." };
  return { available: false, reason: "Boss has decided, so Pilot's view is closed." };
}

// What to tell the person when a call did not work. The server's own wording is
// used where it is already plain (a daily limit, a missing service, a decision
// that changed); a few cases are worded here because the screen knows better
// than the server what the person was trying to do.
export function analysisErrorMessage(status: number, serverError: string | undefined): string {
  if (status === 403) return "Only owners and managers can ask Pilot for a view or challenge a decision.";
  if (status === 401) return "Please sign in again to use Pilot.";
  if (status === 0) return "Couldn't reach the server. Check your connection and try again.";
  if (status === 404) return "That decision wasn't found. Try reloading the page.";
  if (status === 429) return serverError ?? "You have used all of today's Pilot views and challenges. They start again tomorrow.";
  return serverError ?? "Something went wrong. Please try again.";
}

export type AnalysisOutcome =
  | { ok: true; decision: Decision; remaining: number | null }
  | { ok: false; error: string };

// One click on "Ask Pilot" or "Challenge me": makes the call and turns whatever
// came back into either the updated decision or the words to show. (`run` is a
// parameter only so a test can stand in for the server.)
export async function requestAnalysis(
  decisionId: string,
  kind: AnalysisKind,
  run: (decisionId: string, kind: AnalysisKind) => Promise<AnalysisResult> = runAnalysis
): Promise<AnalysisOutcome> {
  const result = await run(decisionId, kind);
  if (result.ok && result.decision) return { ok: true, decision: result.decision, remaining: result.remaining ?? null };
  return { ok: false, error: analysisErrorMessage(result.status, result.error) };
}

// Always a word, never a number or a percentage (roadmap rule 04).
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export const CONFIDENCE_COLOURS: Record<Confidence, { text: string; border: string; background: string }> = {
  low: { text: "#ffb08a", border: "#fb923c", background: "rgba(251,146,60,0.14)" },
  medium: { text: "#a9cdfb", border: "#60a5fa", background: "rgba(96,165,250,0.14)" },
  high: { text: "#a3e8b0", border: "#4ade80", background: "rgba(74,222,128,0.14)" },
};

// The option Pilot recommended, by its label. If the option has since been
// removed or renamed away, say so rather than showing a bare letter.
export function optionLabel(decision: Pick<Decision, "options">, key: string): string {
  const option = decision.options.find(o => o.key === key);
  return option ? option.label : "an option that is no longer on this decision";
}

// True when the decision was edited AFTER Pilot gave this answer, so the answer
// may be about a question or options that have since changed.
export function editedSince(decision: Pick<Decision, "events">, answeredAt: string): boolean {
  const answered = Date.parse(answeredAt);
  if (Number.isNaN(answered)) return false;
  return decision.events.some(e => e.action === "edited" && Date.parse(e.at) > answered);
}

// A short date and time in UK time, for "asked on".
export function whenText(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
