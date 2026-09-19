import { describe, it, expect } from "vitest";
import {
  FIGURE_UNITS,
  HORIZON_DAYS_MAX,
  HORIZON_DAYS_MIN,
  MAX_FIGURE_SIZE,
  REVIEW_DAYS_MAX,
  REVIEW_DAYS_MIN,
  decidedNote,
  matchActuals,
  parseDecideInput,
  parseOutcomeInput,
  planDecide,
  planEdit,
  planOutcome,
  type DecideInput,
  type Plan,
} from "./decisionJournalInput";
import { LESSON_MAX, MAX_EXPECTATIONS, OPTION_NOTE_MAX, REASONING_MAX, type Decision, type Expectation } from "../decisionTypes";

// What Boss types is checked here before it can become a change to a decision,
// and the state rules (open -> decided -> reviewed, never backwards) are decided
// here. The routes only carry these answers out, so this is where most of the
// journal's promises are pinned.

const hidden = String.fromCodePoint(0xe0041); // a Unicode Tags character: invisible text
const actor = { id: "u1", name: "Olivia Owner" };
const NOW = Date.parse("2030-06-01T12:00:00.000Z");
const ctx = { actor, nowMs: NOW };

const baseDecision = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  question: "Buy another £50k of SUVs?",
  context: "Enquiries are up.",
  options: [
    { key: "a", label: "No change" },
    { key: "b", label: "Add £50k" },
    { key: "c", label: "Add £25k", note: "half" },
  ],
  createdAt: "2030-01-01T00:00:00.000Z",
  createdByUserId: "u1",
  createdByName: "Olivia Owner",
  updatedAt: "2030-01-01T00:00:00.000Z",
  simulations: [],
  expectations: [],
  events: [],
  ...over,
});

const rec = (optionKey: string) => ({
  optionKey,
  reasoning: "",
  confidence: "medium" as const,
  confidenceReasons: [],
  unknowns: [],
  askedAt: "2030-01-05T00:00:00.000Z",
});
const decidedBoss = { optionKey: "b", reasoning: "", decidedAt: "2030-02-01T00:00:00.000Z", decidedByUserId: "u1", decidedByName: "Olivia Owner" };
const exp = (id: string, expected = 100): Expectation => ({ id, metric: `M ${id}`, unit: "gbp", expected, horizonDays: 60, basis: "" });
const lessons = { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" };

const decide = (body: unknown): DecideInput => {
  const p = parseDecideInput(body);
  if (!p.ok) throw new Error("should parse: " + p.error);
  return p.value;
};
const failure = (p: { ok: boolean; error?: string }) => {
  expect(p.ok).toBe(false);
  return p.ok ? "" : (p.error ?? "");
};
function applied(plan: Plan, d: Decision): Decision {
  if (!plan.ok) throw new Error("plan refused: " + plan.error);
  const copy = structuredClone(d);
  plan.apply(copy);
  return copy;
}

describe("parseDecideInput: Boss's choice", () => {
  it("accepts just an option, and fills in the rest: no reasoning, no expectations, a review in 90 days", () => {
    expect(decide({ optionKey: "b" })).toEqual({ optionKey: "b", otherText: "", reasoning: "", expectations: [], reviewInDays: 90 });
  });

  it("reads the option letter in any case with stray spaces", () => {
    expect(decide({ optionKey: "  B " }).optionKey).toBe("b");
    expect(decide({ optionKey: "OTHER", otherText: "Wait" }).optionKey).toBe("other");
  });

  it("refuses anything that is not a letter a to f or Other", () => {
    for (const optionKey of ["", "g", "ab", "1", 1, null, undefined, {}, ["a"]]) {
      expect(failure(parseDecideInput({ optionKey })), String(optionKey)).toMatch(/choose one of the options/i);
    }
    expect(failure(parseDecideInput(undefined))).toMatch(/choose one of the options/i);
    expect(failure(parseDecideInput("b"))).toMatch(/choose one of the options/i);
  });

  it("needs a few words when the choice is Other, and drops those words when it is not", () => {
    expect(failure(parseDecideInput({ optionKey: "other" }))).toMatch(/say in a few words/i);
    expect(failure(parseDecideInput({ optionKey: "other", otherText: "   " }))).toMatch(/say in a few words/i);
    expect(decide({ optionKey: "a", otherText: "ignored" }).otherText).toBe("");
    const long = decide({ optionKey: "other", otherText: `Wait\nand see${hidden} ` + "x".repeat(500) });
    expect(long.otherText).not.toMatch(/[\n\r]/);
    expect(long.otherText).not.toContain(hidden);
    expect(Array.from(long.otherText).length).toBeLessThanOrEqual(OPTION_NOTE_MAX);
  });

  it("keeps the reasoning as written, apart from capping it and stripping hidden characters", () => {
    expect(decide({ optionKey: "a", reasoning: "Line one\nLine two" }).reasoning).toBe("Line one\nLine two");
    const r = decide({ optionKey: "a", reasoning: `secret${hidden} ` + "y".repeat(3000) }).reasoning;
    expect(r).not.toContain(hidden);
    expect(Array.from(r).length).toBeLessThanOrEqual(REASONING_MAX);
    expect(decide({ optionKey: "a", reasoning: 42 }).reasoning).toBe("");
  });

  it("takes a review date from 7 to 365 days away, and 90 when none is given", () => {
    expect(REVIEW_DAYS_MIN).toBe(7);
    expect(REVIEW_DAYS_MAX).toBe(365);
    expect(decide({ optionKey: "a", reviewInDays: 7 }).reviewInDays).toBe(7);
    expect(decide({ optionKey: "a", reviewInDays: 365 }).reviewInDays).toBe(365);
    expect(decide({ optionKey: "a", reviewInDays: null }).reviewInDays).toBe(90);
    expect(decide({ optionKey: "a" }).reviewInDays).toBe(90);
    for (const reviewInDays of [6, 366, 0, -30, 30.5, "30", Number.NaN, {}]) {
      expect(failure(parseDecideInput({ optionKey: "a", reviewInDays })), String(reviewInDays)).toMatch(/between 7 and 365 days/);
    }
  });
});

describe("parseDecideInput: expectations", () => {
  const good = { metric: "Extra profit", unit: "gbp", expected: 5000, horizonDays: 90, basis: "Last spring" };

  it("takes up to six, each with a metric, a unit, a number, a number of days and a basis", () => {
    expect(decide({ optionKey: "a", expectations: [good] }).expectations).toEqual([good]);
    const six = Array.from({ length: MAX_EXPECTATIONS }, (_, i) => ({ ...good, metric: `M${i}` }));
    expect(decide({ optionKey: "a", expectations: six }).expectations).toHaveLength(6);
    expect(failure(parseDecideInput({ optionKey: "a", expectations: [...six, good] }))).toMatch(/at most 6 expectations/);
    expect(failure(parseDecideInput({ optionKey: "a", expectations: "lots" }))).toMatch(/must be a list/);
  });

  it("allows a basis to be left out, and a zero or negative expectation (a loss is a number too)", () => {
    const e = decide({ optionKey: "a", expectations: [{ metric: "Loss", unit: "gbp", expected: -1500, horizonDays: 30 }, { metric: "Cars", unit: "cars", expected: 0, horizonDays: 30 }] }).expectations;
    expect(e).toEqual([
      { metric: "Loss", unit: "gbp", expected: -1500, horizonDays: 30, basis: "" },
      { metric: "Cars", unit: "cars", expected: 0, horizonDays: 30, basis: "" },
    ]);
  });

  it("knows the six units", () => {
    expect([...FIGURE_UNITS].sort()).toEqual(["cars", "count", "days", "gbp", "months", "percent"]);
    for (const unit of FIGURE_UNITS) expect(parseDecideInput({ optionKey: "a", expectations: [{ ...good, unit }] }).ok).toBe(true);
  });

  it("refuses a row with no metric, an unknown unit, or something that is not a number, naming the row", () => {
    const rows = (over: object) => parseDecideInput({ optionKey: "a", expectations: [good, { ...good, ...over }] });
    expect(failure(rows({ metric: "  " }))).toMatch(/^Expectation 2: please say what you are measuring/);
    expect(failure(rows({ metric: `${hidden}` }))).toMatch(/^Expectation 2: please say what you are measuring/);
    expect(failure(rows({ unit: "pounds" }))).toMatch(/^Expectation 2 \(Extra profit\): please choose what it is measured in/);
    expect(failure(rows({ unit: undefined }))).toMatch(/what it is measured in/);
    for (const expected of ["5000", null, undefined, Number.NaN, {}, [] as unknown, MAX_FIGURE_SIZE + 1, -MAX_FIGURE_SIZE - 1]) {
      expect(failure(rows({ expected })), String(expected)).toMatch(/^Expectation 2 \(Extra profit\): please give the number you expect/);
    }
    expect(failure(parseDecideInput({ optionKey: "a", expectations: [null] }))).toMatch(/^Expectation 1: please fill it in/);
    expect(failure(parseDecideInput({ optionKey: "a", expectations: ["x"] }))).toMatch(/^Expectation 1: please fill it in/);
  });

  it("takes a horizon of 1 to 730 whole days", () => {
    expect(HORIZON_DAYS_MIN).toBe(1);
    expect(HORIZON_DAYS_MAX).toBe(730);
    for (const horizonDays of [1, 730]) expect(parseDecideInput({ optionKey: "a", expectations: [{ ...good, horizonDays }] }).ok).toBe(true);
    for (const horizonDays of [0, 731, -1, 1.5, "90", null, undefined, Number.NaN]) {
      expect(failure(parseDecideInput({ optionKey: "a", expectations: [{ ...good, horizonDays }] })), String(horizonDays)).toMatch(/in how many days \(1 to 730\)/);
    }
  });

  it("cleans and caps the metric and basis like every other piece of typed text", () => {
    const e = decide({ optionKey: "a", expectations: [{ ...good, metric: `Profit${hidden}\nper car`, basis: "b".repeat(1000) }] }).expectations[0]!;
    expect(e.metric).toBe("Profit per car");
    expect(Array.from(e.basis).length).toBeLessThanOrEqual(OPTION_NOTE_MAX);
  });
});

describe("parseOutcomeInput: what actually happened", () => {
  it("accepts nothing at all: no results, no notes, empty lessons", () => {
    expect(parseOutcomeInput({})).toEqual({ ok: true, value: { actuals: [], notes: "", lessons } });
    expect(parseOutcomeInput(undefined)).toEqual({ ok: true, value: { actuals: [], notes: "", lessons } });
  });

  it("keeps a number, keeps a real 0, and turns a missing or null result into not known", () => {
    const p = parseOutcomeInput({ actuals: [{ expectationId: "a", actual: 12.5 }, { expectationId: "b", actual: 0 }, { expectationId: "c", actual: null }, { expectationId: "d" }] });
    expect(p.ok && p.value.actuals.map(a => [a.expectationId, a.actual])).toEqual([["a", 12.5], ["b", 0], ["c", null], ["d", null]]);
  });

  it("refuses a result that is text, or that says nothing about which expectation it is for", () => {
    for (const actual of ["12", "", Number.NaN, {}, MAX_FIGURE_SIZE + 1]) {
      expect(failure(parseOutcomeInput({ actuals: [{ expectationId: "a", actual }] })), String(actual)).toMatch(/^Result 1: please give a number, or leave it as not known/);
    }
    for (const row of [{ actual: 5 }, { expectationId: "", actual: 5 }, { expectationId: 7, actual: 5 }, null, "x"]) {
      expect(failure(parseOutcomeInput({ actuals: [row] })), JSON.stringify(row)).toMatch(/^Result 1: it needs to say which expectation it is for/);
    }
    expect(failure(parseOutcomeInput({ actuals: "none" }))).toMatch(/must be a list/);
    expect(failure(parseOutcomeInput({ actuals: Array.from({ length: 7 }, (_, i) => ({ expectationId: `e${i}`, actual: 1 })) }))).toMatch(/at most 6 results/);
  });

  it("cleans and caps every piece of text with the limits the store uses", () => {
    const p = parseOutcomeInput({
      actuals: [{ expectationId: "a", actual: 1, note: `Note${hidden}\nline ` + "n".repeat(900) }],
      notes: `Notes${hidden} ` + "m".repeat(3000),
      lessons: { pilotRight: "r".repeat(900), pilotWrong: "w".repeat(900), bossRight: "b".repeat(900), unexpected: "u".repeat(900), lesson: `l${hidden}`.repeat(900) },
    });
    if (!p.ok) throw new Error(p.error);
    const chars = (s: string) => Array.from(s).length;
    expect(p.value.actuals[0]!.note).not.toMatch(/[\n\r]/);
    expect(chars(p.value.actuals[0]!.note)).toBeLessThanOrEqual(LESSON_MAX);
    expect(chars(p.value.notes)).toBeLessThanOrEqual(REASONING_MAX);
    for (const text of Object.values(p.value.lessons)) expect(chars(text)).toBeLessThanOrEqual(LESSON_MAX);
    for (const text of [p.value.actuals[0]!.note, p.value.notes, ...Object.values(p.value.lessons)]) expect(text).not.toContain(hidden);
  });

  it("treats lessons that are not an object as empty", () => {
    for (const bad of ["a lesson", 5, null, ["x"]]) {
      expect(parseOutcomeInput({ lessons: bad })).toMatchObject({ ok: true, value: { lessons } });
    }
  });
});

describe("matchActuals: every expectation gets a result", () => {
  const e = [exp("e0"), exp("e1"), exp("e2")];

  it("gives one result per expectation, in order, and counts one left out as not known", () => {
    const m = matchActuals(e, [{ expectationId: "e2", actual: 9, note: "" }, { expectationId: "e0", actual: 0, note: "kept" }]);
    expect(m).toEqual({
      ok: true,
      value: [
        { expectationId: "e0", actual: 0, note: "kept" }, // a real 0 stays 0
        { expectationId: "e1", actual: null },
        { expectationId: "e2", actual: 9 },
      ],
    });
  });

  it("refuses a result for something that was never expected, and two results for the same expectation", () => {
    expect(failure(matchActuals(e, [{ expectationId: "ghost", actual: 1, note: "" }]))).toMatch(/doesn't match anything you expected/);
    expect(failure(matchActuals(e, [{ expectationId: "e0", actual: 1, note: "" }, { expectationId: "e0", actual: 2, note: "" }]))).toMatch(/only have one result/);
  });

  it("is fine with no expectations and no results", () => {
    expect(matchActuals([], [])).toEqual({ ok: true, value: [] });
  });
});

describe("decidedNote: the audit trail says plainly whether Boss followed or overrode Pilot", () => {
  const d = baseDecision();
  it("says followed when the choice is the recommended option", () => {
    expect(decidedNote({ ...d, pilotRecommendation: rec("b") }, { optionKey: "b" })).toBe(`Boss followed Pilot's recommendation: option B, "Add £50k".`);
  });
  it("says overrode, and what each was, when the choice is another option", () => {
    expect(decidedNote({ ...d, pilotRecommendation: rec("b") }, { optionKey: "a" })).toBe(
      `Boss overrode Pilot's recommendation. Pilot recommended option B, "Add £50k"; Boss chose option A, "No change".`
    );
  });
  it("says overrode when the choice is Other", () => {
    expect(decidedNote({ ...d, pilotRecommendation: rec("c") }, { optionKey: "other" })).toBe(
      `Boss overrode Pilot's recommendation. Pilot recommended option C, "Add £25k"; Boss chose something else (written in the decision).`
    );
  });
  it("says there was no recommendation to follow when there was none", () => {
    expect(decidedNote(d, { optionKey: "a" })).toBe(`Boss decided without a recommendation from Pilot: chose option A, "No change".`);
    expect(decidedNote(d, { optionKey: "other" })).toBe("Boss decided without a recommendation from Pilot: chose something else (written in the decision).");
  });
  it("never calls a decision that was not against the recommendation an override, or the other way round", () => {
    expect(decidedNote({ ...d, pilotRecommendation: rec("b") }, { optionKey: "b" })).not.toMatch(/overrode/);
    expect(decidedNote({ ...d, pilotRecommendation: rec("b") }, { optionKey: "a" })).not.toMatch(/followed/);
  });
});

describe("planEdit: the question and options can be changed only while open with no recommendation", () => {
  it("changes what was sent and leaves the rest, lettering the options again in order", () => {
    const d = baseDecision();
    const plan = planEdit(d, { question: "Buy £40k of SUVs?", options: ["Hold", "Buy £40k"] });
    expect(plan).toMatchObject({ ok: true, noChange: false, note: "Edited the question and options." });
    const after = applied(plan, d);
    expect(after.question).toBe("Buy £40k of SUVs?");
    expect(after.context).toBe("Enquiries are up."); // not sent, so kept
    expect(after.options).toEqual([{ key: "a", label: "Hold" }, { key: "b", label: "Buy £40k" }]);
  });

  it("names exactly the parts that changed", () => {
    const d = baseDecision();
    expect(planEdit(d, { context: "New context." })).toMatchObject({ note: "Edited the context." });
    expect(planEdit(d, { question: "Q?", context: "C." })).toMatchObject({ note: "Edited the question and context." });
    expect(planEdit(d, { question: "Q?", context: "C.", options: ["x", "y"] })).toMatchObject({ note: "Edited the question, context and options." });
  });

  it("can clear the context, which is allowed to be empty", () => {
    const d = baseDecision();
    expect(applied(planEdit(d, { context: "" }), d).context).toBe("");
  });

  it("does nothing, and writes no event, when what was sent is what is already there", () => {
    const d = baseDecision();
    expect(planEdit(d, { question: d.question })).toMatchObject({ ok: true, noChange: true });
    expect(planEdit(d, { options: d.options })).toMatchObject({ ok: true, noChange: true });
    expect(planEdit(d, { question: `  ${d.question}  `, context: d.context })).toMatchObject({ ok: true, noChange: true }); // only the spacing differs
  });

  it("refuses with 400 when nothing is sent, or what is sent is not valid", () => {
    const d = baseDecision();
    expect(planEdit(d, {})).toMatchObject({ ok: false, status: 400 });
    expect(planEdit(d, undefined)).toMatchObject({ ok: false, status: 400 });
    expect(planEdit(d, { question: "   " })).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/write the question/) });
    expect(planEdit(d, { question: null })).toMatchObject({ ok: false, status: 400 });
    expect(planEdit(d, { options: ["only one"] })).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/at least 2 options/) });
    expect(planEdit(d, { options: ["same", "Same"] })).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses with 409 once Pilot has given a recommendation, and says the options the view refers to would change", () => {
    const plan = planEdit(baseDecision({ pilotRecommendation: rec("b") }), { question: "New question?" });
    expect(plan).toMatchObject({ ok: false, status: 409 });
    expect(plan.ok ? "" : plan.error).toMatch(/changes? what that view refers to/i);
  });

  it("refuses with 409 once Boss has decided, and once it has been reviewed", () => {
    expect(planEdit(baseDecision({ bossDecision: decidedBoss }), { question: "New?" })).toMatchObject({ ok: false, status: 409 });
    expect(planEdit(baseDecision({ bossDecision: decidedBoss, outcome: { recordedAt: "x", recordedByUserId: "u", recordedByName: "n", actuals: [], notes: "", lessons } }), { question: "New?" })).toMatchObject({ ok: false, status: 409 });
  });

  it("checks the state before it looks at what was sent", () => {
    expect(planEdit(baseDecision({ bossDecision: decidedBoss }), {})).toMatchObject({ ok: false, status: 409 });
  });
});

describe("planDecide: Boss decides, once", () => {
  const input = decide({
    optionKey: "b",
    reasoning: "Enquiries are up.",
    expectations: [
      { metric: "Extra profit", unit: "gbp", expected: 5000, horizonDays: 90, basis: "Last spring" },
      { metric: "Cars sold", unit: "cars", expected: 4, horizonDays: 60 },
    ],
    reviewInDays: 30,
  });

  it("records the choice, who made it and when, gives each expectation its own id, and sets the review date", () => {
    const d = baseDecision();
    const plan = planDecide(d, input, ctx);
    const after = applied(plan, d);
    expect(after.bossDecision).toEqual({
      optionKey: "b",
      reasoning: "Enquiries are up.",
      decidedAt: "2030-06-01T12:00:00.000Z",
      decidedByUserId: "u1",
      decidedByName: "Olivia Owner",
    });
    expect(after.reviewDueAt).toBe("2030-07-01T12:00:00.000Z"); // 30 days on
    expect(after.expectations.map(e => e.metric)).toEqual(["Extra profit", "Cars sold"]);
    const ids = after.expectations.map(e => e.id);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("stores what Boss typed for Other, and only for Other", () => {
    const d = baseDecision();
    const other = applied(planDecide(d, decide({ optionKey: "other", otherText: "Wait a month" }), ctx), d);
    expect(other.bossDecision).toMatchObject({ optionKey: "other", otherText: "Wait a month" });
    expect(applied(planDecide(d, decide({ optionKey: "a", otherText: "ignored" }), ctx), d).bossDecision).not.toHaveProperty("otherText");
  });

  it("reviews in 90 days when Boss did not choose", () => {
    const d = baseDecision();
    expect(applied(planDecide(d, decide({ optionKey: "a" }), ctx), d).reviewDueAt).toBe("2030-08-30T12:00:00.000Z");
  });

  it("puts a plain followed or overrode in the note", () => {
    expect(planDecide(baseDecision({ pilotRecommendation: rec("b") }), input, ctx)).toMatchObject({ note: expect.stringContaining("followed Pilot's recommendation") });
    expect(planDecide(baseDecision({ pilotRecommendation: rec("a") }), input, ctx)).toMatchObject({ note: expect.stringContaining("overrode Pilot's recommendation") });
    expect(planDecide(baseDecision(), input, ctx)).toMatchObject({ note: expect.stringContaining("without a recommendation from Pilot") });
  });

  it("refuses with 409 when the decision has already been made, and points to recording what happened", () => {
    const plan = planDecide(baseDecision({ bossDecision: decidedBoss }), input, ctx);
    expect(plan).toMatchObject({ ok: false, status: 409 });
    expect(plan.ok ? "" : plan.error).toMatch(/already been made and can't be changed/);
    expect(plan.ok ? "" : plan.error).toMatch(/record what actually happened/);
  });

  it("refuses with 400 an option that this decision does not have, but always allows Other", () => {
    const twoOptions = baseDecision({ options: [{ key: "a", label: "x" }, { key: "b", label: "y" }] });
    expect(planDecide(twoOptions, decide({ optionKey: "c" }), ctx)).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/isn't one of this decision's options/) });
    expect(planDecide(twoOptions, decide({ optionKey: "other", otherText: "z" }), ctx)).toMatchObject({ ok: true });
  });
});

describe("planOutcome: what happened is recorded once, alongside the decision", () => {
  const decided = (over: Partial<Decision> = {}) => baseDecision({ bossDecision: decidedBoss, reviewDueAt: "2030-05-01T00:00:00.000Z", expectations: [exp("e0"), exp("e1")], ...over });
  const outcome = (body: unknown) => {
    const p = parseOutcomeInput(body);
    if (!p.ok) throw new Error(p.error);
    return p.value;
  };

  it("records every expectation's result, who recorded it and when, with the notes and lessons", () => {
    const d = decided();
    const plan = planOutcome(d, outcome({ actuals: [{ expectationId: "e0", actual: 110, note: "Close" }], notes: "Went fine", lessons: { lesson: "Buy earlier" } }), ctx);
    expect(plan).toMatchObject({ ok: true, noChange: false, note: "Recorded what happened: 1 of 2 results known." });
    const after = applied(plan, d);
    expect(after.outcome).toEqual({
      recordedAt: "2030-06-01T12:00:00.000Z",
      recordedByUserId: "u1",
      recordedByName: "Olivia Owner",
      actuals: [{ expectationId: "e0", actual: 110, note: "Close" }, { expectationId: "e1", actual: null }],
      notes: "Went fine",
      lessons: { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "Buy earlier" },
    });
    expect(after.bossDecision).toEqual(d.bossDecision); // the decision itself is untouched
  });

  it("says so in the note when no expectations were set", () => {
    expect(planOutcome(decided({ expectations: [] }), outcome({}), ctx)).toMatchObject({ note: "Recorded what happened. No expectations had been set." });
  });

  it("refuses with 409 before Boss has decided", () => {
    const plan = planOutcome(baseDecision(), outcome({}), ctx);
    expect(plan).toMatchObject({ ok: false, status: 409 });
    expect(plan.ok ? "" : plan.error).toMatch(/hasn't been made yet/);
  });

  it("refuses with 409 once what happened has been recorded: a review is final", () => {
    const done = decided({ outcome: { recordedAt: "x", recordedByUserId: "u", recordedByName: "n", actuals: [], notes: "", lessons } });
    const plan = planOutcome(done, outcome({}), ctx);
    expect(plan).toMatchObject({ ok: false, status: 409 });
    expect(plan.ok ? "" : plan.error).toMatch(/already been recorded/);
  });

  it("refuses with 400 a result that does not belong to an expectation on this decision", () => {
    expect(planOutcome(decided(), outcome({ actuals: [{ expectationId: "ghost", actual: 1 }] }), ctx)).toMatchObject({ ok: false, status: 400 });
    expect(planOutcome(decided(), outcome({ actuals: [{ expectationId: "e0", actual: 1 }, { expectationId: "e0", actual: 2 }] }), ctx)).toMatchObject({ ok: false, status: 400 });
  });
});
