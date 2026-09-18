// Pilot Brain V7 (The Co-Founder) — pure functions, no I/O, no LLM
// deciding any number. Per the user's own spec's Core Principle:
// "Pilot Brain must never become the decision maker. Pilot Brain
// becomes the decision partner. The owner always remains the final
// authority."
//
// Real scope decision, made explicit before building: this is a
// brand-new, unlaunched product — even the best-populated test account
// has days/weeks of real history, not the "last 18 months" the spec's
// own Strategy Engine example references. Lessons Learned (Module 6)
// and Pattern Engine (Module 7, seasonal/multi-cycle detection) both
// need real historical depth across months or years that genuinely
// doesn't exist yet — building them now would mean either returning
// nothing useful forever, or worse, pattern-matching on noise and
// presenting it as business wisdom. Both are left unbuilt rather than
// faked. Expansion Engine (Module 5, new locations/markets) has zero
// real evidence to draw from — this app only ever sees one
// dealership's own stock, never market/location data beyond it — so
// it's not built either. Future Timeline (Module 12) is honestly
// scoped to 30/90 days (the same real trend-projection basis as V5's
// revenue forecast), not the 6/12-month view the spec shows, for the
// same real-data-depth reason.

export type Confidence = "high" | "medium" | "low" | "unknown";

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
  percent: number; // 0-100+, real, can exceed 100 if the goal's been beaten
  onTrack: boolean; // real: is currentValue's pace, given how far into the period we are, enough to hit target
}

export interface StrategicHealth {
  overall: number;
  businessHealth: number;
  marketHealth: number | null;
  goalProgressAverage: number | null; // null when no real goals are set yet
}

export interface ScenarioResult {
  metric: GoalMetric;
  assumedChangePercent: number;
  currentValue: number;
  projectedValue: number;
  basis: string;
  confidence: Confidence;
}

export interface BusinessSimulation {
  conservative: ScenarioResult;
  expected: ScenarioResult;
  aggressive: ScenarioResult;
}

const PERIOD_DAYS: Record<BusinessGoal["period"], number> = { monthly: 30, quarterly: 90 };

// Goal Engine (Module 2) — real progress against a real, owner-set
// target, using whatever real current value the caller supplies (the
// route reads it from the same real engines V3/V5 already compute
// from — this function just does the honest comparison).
export function computeGoalProgress(goal: BusinessGoal, currentValue: number, now: number): GoalProgress {
  const percent = goal.targetValue !== 0 ? Math.round((currentValue / goal.targetValue) * 1000) / 10 : 0;
  const periodDays = PERIOD_DAYS[goal.period];
  const daysElapsed = Math.max(1, (now - new Date(goal.createdAt).getTime()) / 86400000);
  const expectedPaceValue = goal.targetValue * Math.min(1, daysElapsed / periodDays);
  const onTrack = currentValue >= expectedPaceValue;
  return { goal, currentValue, percent, onTrack };
}

// Strategic Health Score (Module 14) — a real aggregate of Business
// Health (V2), Market Health (V4, honestly null if never checked),
// and real average goal progress (V7, honestly null if no goals set).
export function computeStrategicHealth(
  businessHealth: number,
  marketHealth: number | null,
  goalProgressAverage: number | null
): StrategicHealth {
  const parts = [businessHealth, marketHealth, goalProgressAverage != null ? Math.min(100, goalProgressAverage) : null]
    .filter((v): v is number => v != null);
  const overall = parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : businessHealth;
  return { overall, businessHealth, marketHealth, goalProgressAverage };
}

// Scenario Engine / Business Simulator (Modules 3/4) — transparent,
// real-ratio math applied to a real current value under a stated
// assumption. Never a hidden model, never historical pattern-mining
// (see file header for why that's not built) — just "here's what the
// real number becomes if this real number changes by X%", clearly
// labelled as exactly that.
export function runScenario(metric: GoalMetric, currentValue: number, assumedChangePercent: number): ScenarioResult {
  const projectedValue = Math.round(currentValue * (1 + assumedChangePercent / 100));
  return {
    metric,
    assumedChangePercent,
    currentValue,
    projectedValue,
    basis: `Real current ${metric} (${currentValue.toLocaleString()}) scaled by the stated ${assumedChangePercent >= 0 ? "+" : ""}${assumedChangePercent}% — a transparent projection, not a historical pattern or a guarantee.`,
    confidence: "low", // a single-variable linear scale-up is never more than a rough steer — never overstate this
  };
}

export function buildBusinessSimulation(metric: GoalMetric, currentValue: number): BusinessSimulation {
  return {
    conservative: runScenario(metric, currentValue, 5),
    expected: runScenario(metric, currentValue, 15),
    aggressive: runScenario(metric, currentValue, 30),
  };
}
