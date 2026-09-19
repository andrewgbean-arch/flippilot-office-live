// The Decision Journal's arithmetic (Pilot Brain V8). Pure functions only: no
// database, no clock (the caller passes "now"), nothing here changes a decision.
//
// Two jobs:
//  - compareOutcome: once Boss has recorded what actually happened, set each
//    expectation beside its actual result and say whether it came out close.
//  - journalStats: how the learning loop is going, honestly. It never turns a
//    handful of decisions into a rate: below MIN_REVIEWED_FOR_RATES reviewed
//    decisions it says so in plain words instead (roadmap rule 04, "never fake
//    it"). It also never uses a percentage as a headline: it counts.
//
// What each figure is (roadmap rule 14): an expectation is PREDICTED (Boss's
// assumption about the future), an actual result is KNOWN (Boss recorded it) or
// UNKNOWN (null, never 0), and the difference and its percentage are INFERRED
// (worked out from those two).

import {
  decisionState,
  type Decision,
  type DecisionState,
  type FigureUnit,
} from "../decisionTypes";

// "Close" means the actual result is within this share of what Boss expected.
// ONE number, used by every comparison and printed on the screens.
export const CLOSE_WITHIN_PERCENT = 20;

// The fewest REVIEWED decisions before the journal will say anything about how
// well expectations are holding up. Below this it says "too few" instead.
export const MIN_REVIEWED_FOR_RATES = 3;

export const TOO_FEW_REVIEWED_MESSAGE = "Too few reviewed decisions to say anything yet.";

export type Verdict = "close" | "above" | "below" | "unknown";

// One expectation set beside what happened.
export interface ExpectationResult {
  expectationId: string;
  metric: string;
  unit: FigureUnit;
  horizonDays: number;
  basis: string;
  expected: number; // predicted
  actual: number | null; // known, or null = not known
  delta: number | null; // actual - expected (inferred); null when actual is not known
  deltaPercent: number | null; // delta as a % of the size of expected (inferred); null when expected is 0 or actual is not known
  verdict: Verdict;
  note: string; // what Boss said about this result
}

const round = (n: number, places: number): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f + 0; // + 0 turns a negative zero into a plain zero
};

const isKnownNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

// The whole of "how did it come out?" for one pair of numbers.
//
// The percentage is measured against the SIZE of what was expected, so its sign
// always means "higher or lower than expected" even for a negative expectation
// (expected -1,000, actual -800 is +20%: 200 higher). It is rounded to one
// decimal place BEFORE it is compared with the threshold, so the verdict always
// agrees with the number Boss can see (and floating-point dust cannot tip a
// result that is exactly 20% out over the line). Exactly 20% counts as close.
//
// Expected 0 has no percentage. Then only an exact match is close: anything else
// is above or below, because "within 20% of nothing" is nothing.
export function judge(
  expected: number,
  actual: number | null
): { delta: number | null; deltaPercent: number | null; verdict: Verdict } {
  if (!isKnownNumber(expected) || !isKnownNumber(actual)) {
    return { delta: null, deltaPercent: null, verdict: "unknown" };
  }
  const delta = round(actual - expected, 6);
  if (expected === 0) {
    return { delta, deltaPercent: null, verdict: delta === 0 ? "close" : delta > 0 ? "above" : "below" };
  }
  const deltaPercent = round((delta / Math.abs(expected)) * 100, 1);
  const verdict: Verdict =
    Math.abs(deltaPercent) <= CLOSE_WITHIN_PERCENT ? "close" : deltaPercent > 0 ? "above" : "below";
  return { delta, deltaPercent, verdict };
}

// One row per expectation, in the order Boss wrote them. A result that was not
// recorded counts as not known (it is never treated as 0). A decision with no
// outcome at all has every result not known.
export function compareOutcome(decision: Pick<Decision, "expectations" | "outcome">): ExpectationResult[] {
  const actuals = new Map((decision.outcome?.actuals ?? []).map(a => [a.expectationId, a]));
  return decision.expectations.map(e => {
    const recorded = actuals.get(e.id);
    const actual = isKnownNumber(recorded?.actual) ? recorded.actual : null;
    return {
      expectationId: e.id,
      metric: e.metric,
      unit: e.unit,
      horizonDays: e.horizonDays,
      basis: e.basis,
      expected: e.expected,
      actual,
      ...judge(e.expected, actual),
      note: recorded?.note ?? "",
    };
  });
}

// ---- Boss and Pilot ----

// Did Boss go with Pilot's recommendation? true / false, or null when there is
// nothing to compare: no recommendation, no decision yet, or a recommendation
// that was only asked for AFTER Boss had already decided (so it was not part of
// the decision, and must not count as followed or overridden). Choosing "Other"
// is always an override: Pilot recommended one of the listed options.
export function followedPilot(d: Pick<Decision, "pilotRecommendation" | "bossDecision">): boolean | null {
  const rec = d.pilotRecommendation;
  const boss = d.bossDecision;
  if (!rec || !boss) return null;
  const asked = Date.parse(rec.askedAt);
  const decided = Date.parse(boss.decidedAt);
  if (Number.isFinite(asked) && Number.isFinite(decided) && asked > decided) return null;
  return rec.optionKey === boss.optionKey;
}

// What Boss chose, in words: the option's name, or what he typed for "Other".
export function chosenLabel(d: Pick<Decision, "options" | "bossDecision">): string | null {
  const boss = d.bossDecision;
  if (!boss) return null;
  if (boss.optionKey === "other") return `Other: ${boss.otherText ?? ""}`.trimEnd();
  return d.options.find(o => o.key === boss.optionKey)?.label ?? `Option ${boss.optionKey.toUpperCase()}`;
}

// ---- the list ----

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

export function summariseDecision(d: Decision, now: number): DecisionSummary {
  return {
    id: d.id,
    question: d.question,
    state: decisionState(d, now),
    createdAt: d.createdAt,
    decidedAt: d.bossDecision?.decidedAt ?? null,
    chosenOption: chosenLabel(d),
    followedPilot: followedPilot(d),
    reviewDueAt: d.reviewDueAt ?? null,
    hasRecommendation: d.pilotRecommendation !== undefined,
    hasChallenge: d.devilsAdvocate !== undefined,
    simulationCount: d.simulations.length,
  };
}

// ---- the learning loop ----

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
  // A sentence about how this group's expectations came out, or the plain
  // "too few" message when the group has fewer than MIN_REVIEWED_FOR_RATES
  // reviewed decisions.
  sentence: string;
}

export interface JournalStats {
  total: number;
  counts: Record<DecisionState, number>;
  // Only decisions that have BOTH a recommendation from Pilot and Boss's choice.
  followedPilot: number;
  overrodePilot: number;
  reviewedDecisions: number;
  enoughReviewed: boolean;
  closeWithinPercent: number;
  minReviewedForRates: number;
  // Over the REVIEWED decisions: how each expectation came out. These are plain
  // counts; no sentence is built from them until there are enough of them.
  tally: VerdictTally;
  followedGroup: GroupStats;
  overrodeGroup: GroupStats;
  // The accuracy sentence, or the plain "too few" message. Never a percentage.
  summary: string;
}

const emptyTally = (): VerdictTally => ({ close: 0, above: 0, below: 0, unknown: 0, total: 0 });

function addResults(tally: VerdictTally, results: ExpectationResult[]): void {
  for (const r of results) {
    tally[r.verdict] += 1;
    tally.total += 1;
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "7 of 11 results came out close to what you expected (within 20%), 3 above and
// 1 below. 1 result was not known, so it is not counted."
function tallySentence(t: VerdictTally): string {
  const checked = t.close + t.above + t.below;
  if (checked === 0) {
    return "none of the results could be checked (they were not known, or no expectations were set).";
  }
  const unknown =
    t.unknown > 0 ? ` ${plural(t.unknown, "result was", "results were")} not known, so not counted.` : "";
  return (
    `${t.close} of ${plural(checked, "result", "results")} came out close to what you expected ` +
    `(within ${CLOSE_WITHIN_PERCENT}%), ${t.above} above and ${t.below} below.${unknown}`
  );
}

function groupStats(reviewed: Decision[], label: string): GroupStats {
  const tally = emptyTally();
  for (const d of reviewed) addResults(tally, compareOutcome(d));
  const sentence =
    reviewed.length >= MIN_REVIEWED_FOR_RATES
      ? `${label} (${plural(reviewed.length, "reviewed decision", "reviewed decisions")}): ${tallySentence(tally)}`
      : TOO_FEW_REVIEWED_MESSAGE;
  return { reviewedDecisions: reviewed.length, tally, sentence };
}

export function journalStats(decisions: Decision[], now: number): JournalStats {
  const counts: Record<DecisionState, number> = { open: 0, decided: 0, review_due: 0, reviewed: 0 };
  let followed = 0;
  let overrode = 0;
  const reviewed: Decision[] = [];
  const reviewedFollowed: Decision[] = [];
  const reviewedOverrode: Decision[] = [];

  for (const d of decisions) {
    const state = decisionState(d, now);
    counts[state] += 1;
    const follow = followedPilot(d);
    if (follow === true) followed += 1;
    if (follow === false) overrode += 1;
    if (state === "reviewed") {
      reviewed.push(d);
      if (follow === true) reviewedFollowed.push(d);
      if (follow === false) reviewedOverrode.push(d);
    }
  }

  const tally = emptyTally();
  for (const d of reviewed) addResults(tally, compareOutcome(d));
  const enough = reviewed.length >= MIN_REVIEWED_FOR_RATES;

  return {
    total: decisions.length,
    counts,
    followedPilot: followed,
    overrodePilot: overrode,
    reviewedDecisions: reviewed.length,
    enoughReviewed: enough,
    closeWithinPercent: CLOSE_WITHIN_PERCENT,
    minReviewedForRates: MIN_REVIEWED_FOR_RATES,
    tally,
    followedGroup: groupStats(reviewedFollowed, "When you followed Pilot"),
    overrodeGroup: groupStats(reviewedOverrode, "When you overrode Pilot"),
    summary: enough
      ? `Across ${plural(reviewed.length, "reviewed decision", "reviewed decisions")}: ${tallySentence(tally)}`
      : TOO_FEW_REVIEWED_MESSAGE,
  };
}
