// The web app's copy of the Decision Journal types (Pilot Brain V8). The source
// of truth is src/backend/src/decisionTypes.ts: read the rules at the top of
// that file. A backend test fails if the limits or the confidence and figure
// words here drift from it, so change both together.

export type Confidence = "low" | "medium" | "high";
export const CONFIDENCE_LEVELS: readonly Confidence[] = ["low", "medium", "high"];

export function parseConfidence(value: unknown): Confidence | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (CONFIDENCE_LEVELS as readonly string[]).includes(v) ? (v as Confidence) : null;
}

export type FigureKind = "known" | "inferred" | "predicted" | "unknown";
export const FIGURE_KINDS: readonly FigureKind[] = ["known", "inferred", "predicted", "unknown"];
export type FigureUnit = "gbp" | "cars" | "days" | "months" | "percent" | "count";

export interface Figure {
  label: string;
  value: number | null;
  unit: FigureUnit;
  kind: FigureKind;
  basis: string;
}

export interface DecisionOption {
  key: string;
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
  assumptions: string[];
  unknowns: string[];
  downside: string;
  alternative: string;
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
  source: "history" | "boss" | "default";
  kind: FigureKind;
}

export interface SimScenario {
  key: string;
  label: string;
  figures: Figure[];
}

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
  optionKey: string;
  otherText?: string | undefined;
  reasoning: string;
  decidedAt: string;
  decidedByUserId: string;
  decidedByName: string;
}

export interface ActualResult {
  expectationId: string;
  actual: number | null;
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
