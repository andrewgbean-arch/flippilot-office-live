import {
  CONTEXT_MAX,
  DEFAULT_REVIEW_DAYS,
  LESSON_MAX,
  MAX_EXPECTATIONS,
  MAX_OPTIONS,
  MIN_OPTIONS,
  OPTION_LABEL_MAX,
  OPTION_NOTE_MAX,
  QUESTION_MAX,
  REASONING_MAX,
  parseConfidence,
  type Decision,
  type DecisionAction,
  type DecisionState,
  type FigureUnit,
  type Outcome,
} from "@/lib/decisionTypes";
import type { DecideBody, DecisionDraftInput, ExpectationInput, ExpectationResult, OutcomeBody, Verdict } from "@/lib/decisionsApi";

// The words, numbers and checks behind the Decisions screens: pure, so they can be
// tested without a browser. Nothing here talks to the server.
//
// The limits marked "copy" repeat what the server enforces
// (src/backend/src/engines/decisionJournal.ts and decisionJournalInput.ts). A
// backend test keeps them identical, so a form can never promise something the
// server will turn away.

export const HORIZON_DAYS_MIN = 1; // copy
export const HORIZON_DAYS_MAX = 730; // copy
export const REVIEW_DAYS_MIN = 7; // copy
export const REVIEW_DAYS_MAX = 365; // copy
export const MAX_FIGURE_SIZE = 1000000000000; // copy
export const CLOSE_WITHIN_PERCENT = 20; // copy
export const MIN_REVIEWED_FOR_RATES = 3; // copy
export const TOO_FEW_REVIEWED_MESSAGE = "Too few reviewed decisions to say anything yet."; // copy

// ---- who ----

// Owners and managers only, the same rule the server applies (it answers 403 to
// everyone else). The screen uses this so a non-manager is told plainly, rather
// than being shown a page that will only fail.
export function canUseDecisions(user: { role?: string | undefined; staffRole?: string | undefined } | null | undefined): boolean {
  return user?.role === "owner" || user?.staffRole === "manager";
}

// ---- states, verdicts and kinds of number ----

export const STATE_LABEL: Record<DecisionState, string> = {
  open: "Open",
  decided: "Decided",
  review_due: "Review due",
  reviewed: "Reviewed",
};

export const STATE_HELP: Record<DecisionState, string> = {
  open: "Still to decide.",
  decided: "Decided. Waiting to see how it goes.",
  review_due: "Time to record what actually happened.",
  reviewed: "Done. What happened is recorded.",
};

// Above and below say which way the number went, not whether that is good: more
// days to sell is worse, more profit is better.
export const VERDICT_LABEL: Record<Verdict, string> = {
  close: "Close",
  above: "Above what you expected",
  below: "Below what you expected",
  unknown: "Unknown",
};

export const VERDICT_MARK: Record<Verdict, string> = { close: "=", above: "▲", below: "▼", unknown: "?" };

export const EVENT_LABEL: Record<DecisionAction, string> = {
  created: "Decision written down",
  edited: "Edited",
  recommendation: "Pilot gave a recommendation",
  challenge: "Pilot challenged the plan",
  simulation: "A simulation was run",
  decided: "Boss decided",
  outcome: "What happened was recorded",
};

// Pilot's confidence is one of three words, with reasons: never a percentage
// (roadmap rule 04). Anything else that reaches the screen is not shown as it came.
export function confidenceText(confidence: unknown): string {
  return `confidence: ${parseConfidence(confidence) ?? "not stated"}`;
}

export const FOLLOW_TEXT = { followed: "You followed Pilot", overrode: "You went against Pilot" } as const;
export function followText(followedPilot: boolean | null | undefined): string {
  if (followedPilot === true) return FOLLOW_TEXT.followed;
  if (followedPilot === false) return FOLLOW_TEXT.overrode;
  return "";
}

// Every number on these screens says what kind it is (roadmap rule 14).
export const KIND_HELP = {
  known: "Known: from your own records or what you recorded",
  inferred: "Inferred: worked out from known figures",
  predicted: "Predicted: an assumption about the future",
  unknown: "Unknown: not known, and not guessed",
} as const;

// ---- figures ----

export const UNIT_OPTIONS: ReadonlyArray<{ value: FigureUnit; label: string }> = [
  { value: "gbp", label: "£ (pounds)" },
  { value: "cars", label: "cars" },
  { value: "days", label: "days" },
  { value: "months", label: "months" },
  { value: "percent", label: "% (percent)" },
  { value: "count", label: "a plain count" },
];

const withUnit = (abs: number, unit: FigureUnit): string => {
  const n = abs.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  const one = abs === 1;
  switch (unit) {
    case "gbp":
      return `£${n}`;
    case "percent":
      return `${n}%`;
    case "cars":
      return `${n} ${one ? "car" : "cars"}`;
    case "days":
      return `${n} ${one ? "day" : "days"}`;
    case "months":
      return `${n} ${one ? "month" : "months"}`;
    case "count":
      return n;
  }
};

// A number with its unit. Not known is "Unknown": never 0, never blank.
export function formatFigure(value: number | null | undefined, unit: FigureUnit): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unknown";
  return `${value < 0 ? "-" : ""}${withUnit(Math.abs(value), unit)}`;
}

// The difference between what happened and what was expected, with its sign. A
// difference between two percentages is in percentage points.
export function formatDelta(delta: number | null | undefined, unit: FigureUnit): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "Unknown";
  if (delta === 0) return "No difference";
  const abs = Math.abs(delta);
  const body =
    unit === "percent" ? `${abs.toLocaleString("en-GB", { maximumFractionDigits: 2 })} percentage points` : withUnit(abs, unit);
  return `${delta < 0 ? "-" : "+"}${body}`;
}

export function formatDeltaPercent(percent: number): string {
  if (percent === 0) return "0%";
  return `${percent < 0 ? "-" : "+"}${Math.abs(percent).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
}

// "+£400 (+8%)", "-2 cars (-50%)", or Unknown when the result is not known.
export function differenceText(row: Pick<ExpectationResult, "delta" | "deltaPercent" | "unit" | "verdict">): string {
  if (row.verdict === "unknown" || row.delta === null) return "Unknown";
  if (row.deltaPercent === null) return `${formatDelta(row.delta, row.unit)} (no percentage: 0 was expected)`;
  return `${formatDelta(row.delta, row.unit)} (${formatDeltaPercent(row.deltaPercent)})`;
}

// ---- dates ----

const LONDON = "Europe/London";

export function formatDate(iso: string | null | undefined): string {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: LONDON });
}

export function formatDateTime(iso: string | null | undefined): string {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(ms)) return "";
  const time = new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: LONDON });
  return `${formatDate(iso)}, ${time}`;
}

const DAY_MS = 86_400_000;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// When the review is due, in words. Nothing to say once it has been reviewed, or
// before it has been decided.
export function reviewText(state: DecisionState, reviewDueAt: string | null | undefined, nowMs: number): string {
  if (state === "open" || state === "reviewed") return "";
  const due = reviewDueAt ? Date.parse(reviewDueAt) : Number.NaN;
  if (!Number.isFinite(due)) return "";
  const diff = due - nowMs;
  if (diff > 0) return `Review in ${plural(Math.ceil(diff / DAY_MS), "day", "days")}, on ${formatDate(reviewDueAt)}`;
  const overdue = Math.floor(-diff / DAY_MS);
  return overdue === 0 ? "Review is due now" : `Review was due ${plural(overdue, "day", "days")} ago`;
}

// ---- numbers typed into a box ----

export type NumberParse = { ok: true; value: number } | { ok: false; reason: "empty" | "invalid" };

// Accepts 5000, 5,000, -1500, 12.5 and £5,000 (and -£500). Anything else is
// invalid rather than being guessed at.
export function parseNumberInput(text: string): NumberParse {
  const cleaned = text.trim().replace(/^(-?)£/, "$1").replace(/,/g, "");
  if (cleaned === "") return { ok: false, reason: "empty" };
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return { ok: false, reason: "invalid" };
  const value = Number(cleaned);
  if (!Number.isFinite(value) || Math.abs(value) > MAX_FIGURE_SIZE) return { ok: false, reason: "invalid" };
  return { ok: true, value };
}

export function parseWholeNumber(text: string): NumberParse {
  const parsed = parseNumberInput(text);
  if (!parsed.ok) return parsed;
  return Number.isInteger(parsed.value) ? parsed : { ok: false, reason: "invalid" };
}

// ---- the new-decision form ----

export interface DecisionFormValues {
  question: string;
  context: string;
  options: string[]; // labels; blank ones are ignored
}

export const BLANK_DECISION_FORM: DecisionFormValues = { question: "", context: "", options: ["", ""] };

export type Built<T> = { ok: true; value: T } | { ok: false; error: string };

// The same checks the server makes, so a mistake is caught before it is sent.
export function buildDraft(form: DecisionFormValues): Built<DecisionDraftInput> {
  const question = form.question.replace(/\s+/g, " ").trim();
  if (!question) return { ok: false, error: "Please write the question you are deciding." };
  if (Array.from(question).length > QUESTION_MAX) return { ok: false, error: `Please keep the question under ${QUESTION_MAX} characters.` };
  if (Array.from(form.context).length > CONTEXT_MAX) return { ok: false, error: `Please keep the background under ${CONTEXT_MAX} characters.` };

  const labels = form.options.map(o => o.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (labels.length < MIN_OPTIONS) {
    return { ok: false, error: `Please give at least ${MIN_OPTIONS} options: a decision needs something to choose between.` };
  }
  if (labels.length > MAX_OPTIONS) return { ok: false, error: `Please give at most ${MAX_OPTIONS} options.` };
  if (labels.some(l => Array.from(l).length > OPTION_LABEL_MAX)) {
    return { ok: false, error: `Please keep each option under ${OPTION_LABEL_MAX} characters.` };
  }
  if (new Set(labels.map(l => l.toLowerCase())).size !== labels.length) return { ok: false, error: "Each option needs its own name." };

  return { ok: true, value: { question, context: form.context.trim(), options: labels.map(label => ({ label })) } };
}

// ---- Boss's decision form ----

export interface ExpectationRowForm {
  metric: string;
  unit: FigureUnit;
  expected: string;
  horizonDays: string;
  basis: string;
}

export const BLANK_EXPECTATION_ROW: ExpectationRowForm = { metric: "", unit: "gbp", expected: "", horizonDays: "90", basis: "" };

export interface DecideFormValues {
  optionKey: string; // "" until chosen, then "a".."f" or "other"
  otherText: string;
  reasoning: string;
  expectations: ExpectationRowForm[];
  reviewInDays: string;
}

export const REVIEW_CHOICES: ReadonlyArray<{ days: number; label: string }> = [
  { days: 30, label: "in 30 days" },
  { days: 60, label: "in 60 days" },
  { days: DEFAULT_REVIEW_DAYS, label: "in 90 days" },
  { days: 180, label: "in 6 months" },
  { days: 365, label: "in a year" },
];

export const BLANK_DECIDE_FORM: DecideFormValues = {
  optionKey: "",
  otherText: "",
  reasoning: "",
  expectations: [],
  reviewInDays: String(DEFAULT_REVIEW_DAYS),
};

const isBlankRow = (r: ExpectationRowForm) => !r.metric.trim() && !r.expected.trim() && !r.basis.trim();

export function buildDecideBody(form: DecideFormValues, validKeys: readonly string[]): Built<DecideBody> {
  if (!form.optionKey) return { ok: false, error: "Please choose one of the options, or Other." };
  if (form.optionKey !== "other" && !validKeys.includes(form.optionKey)) {
    return { ok: false, error: "Please choose one of the options, or Other." };
  }
  const otherText = form.otherText.replace(/\s+/g, " ").trim();
  if (form.optionKey === "other" && !otherText) {
    return { ok: false, error: "You chose Other, so please say in a few words what you are doing instead." };
  }
  if (Array.from(form.reasoning).length > REASONING_MAX) {
    return { ok: false, error: `Please keep your reasons under ${REASONING_MAX} characters.` };
  }

  const days = parseWholeNumber(form.reviewInDays);
  if (!days.ok || days.value < REVIEW_DAYS_MIN || days.value > REVIEW_DAYS_MAX) {
    return { ok: false, error: `Please choose a review date between ${REVIEW_DAYS_MIN} and ${REVIEW_DAYS_MAX} days away.` };
  }

  const rows = form.expectations.filter(r => !isBlankRow(r));
  if (rows.length > MAX_EXPECTATIONS) return { ok: false, error: `Please give at most ${MAX_EXPECTATIONS} expectations.` };
  const expectations: ExpectationInput[] = [];
  for (const [i, r] of rows.entries()) {
    const n = i + 1;
    const metric = r.metric.replace(/\s+/g, " ").trim();
    if (!metric) return { ok: false, error: `Expectation ${n}: please say what you are measuring.` };
    if (Array.from(metric).length > OPTION_LABEL_MAX) return { ok: false, error: `Expectation ${n}: please keep the name under ${OPTION_LABEL_MAX} characters.` };
    const expected = parseNumberInput(r.expected);
    if (!expected.ok) return { ok: false, error: `Expectation ${n} (${metric}): please give the number you expect.` };
    const horizon = parseWholeNumber(r.horizonDays);
    if (!horizon.ok || horizon.value < HORIZON_DAYS_MIN || horizon.value > HORIZON_DAYS_MAX) {
      return { ok: false, error: `Expectation ${n} (${metric}): please say in how many days (${HORIZON_DAYS_MIN} to ${HORIZON_DAYS_MAX}) you expect it.` };
    }
    if (Array.from(r.basis).length > OPTION_NOTE_MAX) return { ok: false, error: `Expectation ${n} (${metric}): please keep the basis under ${OPTION_NOTE_MAX} characters.` };
    expectations.push({ metric, unit: r.unit, expected: expected.value, horizonDays: horizon.value, basis: r.basis.replace(/\s+/g, " ").trim() });
  }

  return {
    ok: true,
    value: {
      optionKey: form.optionKey,
      ...(form.optionKey === "other" ? { otherText } : {}),
      reasoning: form.reasoning.trim(),
      expectations,
      reviewInDays: days.value,
    },
  };
}

// ---- "what actually happened" ----

export interface ActualRowForm {
  expectationId: string;
  actual: string;
  notKnown: boolean; // the result really is not known: recorded as unknown, never as 0
  note: string;
}

export interface OutcomeFormValues {
  actuals: ActualRowForm[];
  notes: string;
  lessons: Outcome["lessons"];
}

export const BLANK_LESSONS: Outcome["lessons"] = { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" };

export function blankOutcomeForm(expectationIds: readonly string[]): OutcomeFormValues {
  return {
    actuals: expectationIds.map(expectationId => ({ expectationId, actual: "", notKnown: false, note: "" })),
    notes: "",
    lessons: { ...BLANK_LESSONS },
  };
}

// Each result is either a number or explicitly "not known". Leaving the box empty
// without ticking "not known" is asked about rather than quietly counted as
// unknown, so that "unknown" is always something Boss said.
export function buildOutcomeBody(form: OutcomeFormValues, metrics: Readonly<Record<string, string>> = {}): Built<OutcomeBody> {
  const actuals: OutcomeBody["actuals"] = [];
  for (const row of form.actuals) {
    const name = metrics[row.expectationId] ?? "this result";
    if (Array.from(row.note).length > LESSON_MAX) return { ok: false, error: `Please keep the note about ${name} under ${LESSON_MAX} characters.` };
    if (row.notKnown) {
      actuals.push({ expectationId: row.expectationId, actual: null, note: row.note.trim() });
      continue;
    }
    const parsed = parseNumberInput(row.actual);
    if (!parsed.ok) {
      return {
        ok: false,
        error:
          parsed.reason === "empty"
            ? `Please give the result for ${name}, or tick Not known.`
            : `The result for ${name} needs to be a number, or tick Not known.`,
      };
    }
    actuals.push({ expectationId: row.expectationId, actual: parsed.value, note: row.note.trim() });
  }
  if (Array.from(form.notes).length > REASONING_MAX) return { ok: false, error: `Please keep the notes under ${REASONING_MAX} characters.` };
  for (const text of Object.values(form.lessons)) {
    if (Array.from(text).length > LESSON_MAX) return { ok: false, error: `Please keep each lesson under ${LESSON_MAX} characters.` };
  }
  return { ok: true, value: { actuals, notes: form.notes.trim(), lessons: form.lessons } };
}

export const LESSON_FIELDS: ReadonlyArray<{ key: keyof Outcome["lessons"]; label: string }> = [
  { key: "pilotRight", label: "What Pilot got right" },
  { key: "pilotWrong", label: "What Pilot got wrong" },
  { key: "bossRight", label: "What you got right" },
  { key: "unexpected", label: "What surprised you" },
  { key: "lesson", label: "The lesson for next time" },
];

// Is anything in the lessons at all? (Used to show a filled-in review, and skip empty boxes.)
export const hasLessons = (lessons: Outcome["lessons"]): boolean => Object.values(lessons).some(t => t.trim() !== "");

// ---- Boss and Pilot (the same rules as the server's followedPilot and chosenLabel) ----

// Did Boss go with Pilot's recommendation? true or false, or null when there is
// nothing to compare: no recommendation, no decision yet, or a recommendation that
// was only asked for AFTER Boss had decided (it was not part of the decision).
// Choosing "Other" always counts as going against it.
export function followedPilot(d: Pick<Decision, "pilotRecommendation" | "bossDecision">): boolean | null {
  const rec = d.pilotRecommendation;
  const boss = d.bossDecision;
  if (!rec || !boss) return null;
  const asked = Date.parse(rec.askedAt);
  const decided = Date.parse(boss.decidedAt);
  if (Number.isFinite(asked) && Number.isFinite(decided) && asked > decided) return null;
  return rec.optionKey === boss.optionKey;
}

// What Boss chose, in words: "Option B: Add £50k", or what he typed for Other.
export function chosenOptionText(d: Pick<Decision, "options" | "bossDecision">): string {
  const boss = d.bossDecision;
  if (!boss) return "";
  if (boss.optionKey === "other") return `Other: ${boss.otherText ?? ""}`.trimEnd();
  const option = d.options.find(o => o.key === boss.optionKey);
  return option ? `Option ${option.key.toUpperCase()}: ${option.label}` : `Option ${boss.optionKey.toUpperCase()}`;
}
