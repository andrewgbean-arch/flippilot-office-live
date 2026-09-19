// Pilot Brain V8 ("Digital Twin") — the shape of a DECISION and everything that
// hangs off it: the Decision Journal, the Devil's Advocate and the Simulator all
// read and write this one record, so it lives here, once.
//
// The rules of the Pilot Brain roadmap are built into the types on purpose:
//  - Confidence is LOW, MEDIUM or HIGH with reasons. It is never a percentage,
//    and parseConfidence() refuses anything else (Rule 04, "never fake it").
//  - Every figure says what kind of thing it is: KNOWN (from the dealership's
//    own records), INFERRED (worked out from them), PREDICTED (an assumption
//    about the future) or UNKNOWN (missing, and left missing) (Rule 14).
//  - A decision only ever moves forward: open -> decided -> reviewed. Boss
//    decides (Rule 20); Pilot recommends, challenges and simulates.
//  - Every change is written to an append-only event list, so "why did Pilot
//    recommend this?" can still be answered months later (Rule 06).
//  - Only owners and managers can see or change any of it.
//
// The web app has a mirror of the types and constants in src/lib/decisionTypes.ts
// (a test keeps the constants identical).

export type Confidence = "low" | "medium" | "high";
export const CONFIDENCE_LEVELS: readonly Confidence[] = ["low", "medium", "high"];

// Accepts only the three words, in any case. A number, "82%", "0.9" or anything
// else is refused: confidence must never be dressed up as a probability.
export function parseConfidence(value: unknown): Confidence | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (CONFIDENCE_LEVELS as readonly string[]).includes(v) ? (v as Confidence) : null;
}

export type FigureKind = "known" | "inferred" | "predicted" | "unknown";
export const FIGURE_KINDS: readonly FigureKind[] = ["known", "inferred", "predicted", "unknown"];
export type FigureUnit = "gbp" | "cars" | "days" | "months" | "percent" | "count";

// One number in a simulation or an expectation, with its label, kind and where it came from.
// value is null exactly when kind is "unknown": a missing figure stays missing.
export interface Figure {
  label: string;
  value: number | null;
  unit: FigureUnit;
  kind: FigureKind;
  basis: string;
}

export interface DecisionOption {
  key: string; // "a", "b", "c" ... assigned in order
  label: string;
  note?: string | undefined;
}

export interface Recommendation {
  optionKey: string;
  reasoning: string;
  confidence: Confidence;
  confidenceReasons: string[];
  unknowns: string[];
  askedAt: string;
}

export interface DevilsAdvocate {
  ranAt: string;
  caseFor: string[];
  caseAgainst: string[];
  assumptions: string[]; // what must be true for the plan to work
  unknowns: string[];
  downside: string; // what happens if we are wrong
  alternative: string; // similar upside with less risk
  pilotView: string;
  confidence: Confidence;
  confidenceReasons: string[];
}

export type SimulationKind = "stock_investment" | "price_cut_aged_stock";

export interface SimAssumption {
  key: string;
  label: string;
  value: number | string | null;
  unit: FigureUnit | "text";
  source: "history" | "boss" | "default"; // where the assumption came from
  kind: FigureKind;
}

export interface SimScenario {
  key: string; // "keep", "add", ...
  label: string;
  figures: Figure[];
}

// The saved result of one simulation. Always labelled as a simulation: it is an
// arithmetic what-if on the dealership's own history, never a forecast.
export interface SimulationSnapshot {
  id: string;
  ranAt: string;
  kind: SimulationKind;
  title: string;
  assumptions: SimAssumption[];
  scenarios: SimScenario[];
  confidence: Confidence;
  confidenceReasons: string[];
  note: string;
}

export interface Expectation {
  id: string;
  metric: string;
  unit: FigureUnit;
  expected: number;
  horizonDays: number;
  basis: string;
}

export interface BossDecision {
  optionKey: string; // one of the option keys, or "other"
  otherText?: string | undefined;
  reasoning: string;
  decidedAt: string;
  decidedByUserId: string;
  decidedByName: string;
}

export interface ActualResult {
  expectationId: string;
  actual: number | null; // null = not known
  note?: string | undefined;
}

export interface Outcome {
  recordedAt: string;
  recordedByUserId: string;
  recordedByName: string;
  actuals: ActualResult[];
  notes: string;
  lessons: { pilotRight: string; pilotWrong: string; bossRight: string; unexpected: string; lesson: string };
}

export type DecisionAction = "created" | "edited" | "recommendation" | "challenge" | "simulation" | "decided" | "outcome";

export interface DecisionEvent {
  at: string;
  byUserId: string;
  byName: string;
  action: DecisionAction;
  note?: string | undefined;
}

export interface Decision {
  id: string;
  question: string;
  context: string;
  options: DecisionOption[];
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
  updatedAt: string;
  pilotRecommendation?: Recommendation | undefined;
  devilsAdvocate?: DevilsAdvocate | undefined;
  simulations: SimulationSnapshot[];
  bossDecision?: BossDecision | undefined;
  expectations: Expectation[];
  reviewDueAt?: string | undefined;
  outcome?: Outcome | undefined;
  events: DecisionEvent[];
}

export type DecisionState = "open" | "decided" | "review_due" | "reviewed";

export function decisionState(
  d: Pick<Decision, "bossDecision" | "outcome" | "reviewDueAt">,
  now: number
): DecisionState {
  if (d.outcome) return "reviewed";
  if (!d.bossDecision) return "open";
  return d.reviewDueAt && Date.parse(d.reviewDueAt) <= now ? "review_due" : "decided";
}

// ---- limits (one place, so the routes, the store and the web agree) ----
export const MAX_DECISIONS = 500;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const QUESTION_MAX = 160;
export const CONTEXT_MAX = 1500;
export const OPTION_LABEL_MAX = 80;
export const OPTION_NOTE_MAX = 300;
export const REASONING_MAX = 1000;
export const LESSON_MAX = 400;
export const MAX_EXPECTATIONS = 6;
export const MAX_SIMULATIONS = 3;
export const DEFAULT_REVIEW_DAYS = 90;
export const MAX_ANALYSES_PER_DAY = 20;
export const OPTION_KEYS = ["a", "b", "c", "d", "e", "f"] as const;
