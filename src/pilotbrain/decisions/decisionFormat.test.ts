import { describe, it, expect } from "vitest";
import {
  BLANK_DECIDE_FORM,
  BLANK_DECISION_FORM,
  BLANK_EXPECTATION_ROW,
  CLOSE_WITHIN_PERCENT,
  EVENT_LABEL,
  FOLLOW_TEXT,
  MIN_REVIEWED_FOR_RATES,
  REVIEW_CHOICES,
  STATE_LABEL,
  TOO_FEW_REVIEWED_MESSAGE,
  UNIT_OPTIONS,
  VERDICT_LABEL,
  blankOutcomeForm,
  buildDecideBody,
  buildDraft,
  buildOutcomeBody,
  canUseDecisions,
  chosenOptionText,
  differenceText,
  followText,
  followedPilot,
  formatDate,
  formatDateTime,
  formatDelta,
  formatDeltaPercent,
  formatFigure,
  hasLessons,
  parseNumberInput,
  parseWholeNumber,
  reviewText,
  type DecideFormValues,
  type ExpectationRowForm,
  type OutcomeFormValues,
} from "./decisionFormat";
import { LESSON_MAX, MAX_OPTIONS, OPTION_LABEL_MAX, QUESTION_MAX, type Decision } from "@/lib/decisionTypes";

// The words, numbers and checks behind the Decisions screens, without a browser.
// Numbers are worked out by hand.

describe("who may use Decisions: owners and managers only", () => {
  it("lets the owner and a manager in", () => {
    expect(canUseDecisions({ role: "owner" })).toBe(true);
    expect(canUseDecisions({ role: "staff", staffRole: "manager" })).toBe(true);
  });
  it("keeps everyone else out: general, sales, finance, no role at all, nobody logged in", () => {
    for (const staffRole of ["general", "sales", "finance", undefined]) {
      expect(canUseDecisions({ role: "staff", staffRole }), String(staffRole)).toBe(false);
    }
    expect(canUseDecisions(null)).toBe(false);
    expect(canUseDecisions(undefined)).toBe(false);
    expect(canUseDecisions({})).toBe(false);
  });
});

describe("formatFigure: a number with its unit, and Unknown for what is not known", () => {
  it("writes pounds, with the sign in front and thousands separated", () => {
    expect(formatFigure(5000, "gbp")).toBe("£5,000");
    expect(formatFigure(-1500, "gbp")).toBe("-£1,500");
    expect(formatFigure(1234.5, "gbp")).toBe("£1,234.5");
    expect(formatFigure(1234.567, "gbp")).toBe("£1,234.57");
  });

  it("says Unknown, never 0 and never blank, when the figure is missing", () => {
    for (const missing of [null, undefined, Number.NaN, Infinity]) {
      expect(formatFigure(missing, "gbp"), String(missing)).toBe("Unknown");
      expect(formatFigure(missing, "cars")).toBe("Unknown");
    }
  });

  it("keeps a real 0 apart from Unknown", () => {
    expect(formatFigure(0, "gbp")).toBe("£0");
    expect(formatFigure(0, "cars")).toBe("0 cars");
    expect(formatFigure(0, "gbp")).not.toBe(formatFigure(null, "gbp"));
  });

  it("uses the singular for exactly one", () => {
    expect(formatFigure(1, "cars")).toBe("1 car");
    expect(formatFigure(4, "cars")).toBe("4 cars");
    expect(formatFigure(1, "days")).toBe("1 day");
    expect(formatFigure(14, "days")).toBe("14 days");
    expect(formatFigure(1, "months")).toBe("1 month");
    expect(formatFigure(2.5, "months")).toBe("2.5 months");
  });

  it("writes percentages and plain counts", () => {
    expect(formatFigure(12.5, "percent")).toBe("12.5%");
    expect(formatFigure(-3, "percent")).toBe("-3%");
    expect(formatFigure(7, "count")).toBe("7");
  });
});

describe("formatDelta and differenceText: the difference, with its sign", () => {
  it("shows a plus or minus, and no difference when there is none", () => {
    expect(formatDelta(400, "gbp")).toBe("+£400");
    expect(formatDelta(-2, "cars")).toBe("-2 cars");
    expect(formatDelta(-1, "days")).toBe("-1 day");
    expect(formatDelta(0, "gbp")).toBe("No difference");
  });

  it("says a difference between two percentages is in percentage points", () => {
    expect(formatDelta(5, "percent")).toBe("+5 percentage points");
    expect(formatDelta(-2.5, "percent")).toBe("-2.5 percentage points");
  });

  it("says Unknown when there is no difference to give", () => {
    expect(formatDelta(null, "gbp")).toBe("Unknown");
    expect(formatDelta(undefined, "gbp")).toBe("Unknown");
  });

  it("formats a percentage with its sign", () => {
    expect(formatDeltaPercent(8)).toBe("+8%");
    expect(formatDeltaPercent(-50)).toBe("-50%");
    expect(formatDeltaPercent(20.1)).toBe("+20.1%");
    expect(formatDeltaPercent(0)).toBe("0%");
  });

  it("puts the difference and its percentage together, and is honest when there is no percentage or no result", () => {
    expect(differenceText({ delta: 400, deltaPercent: 8, unit: "gbp", verdict: "close" })).toBe("+£400 (+8%)");
    expect(differenceText({ delta: -2, deltaPercent: -50, unit: "cars", verdict: "below" })).toBe("-2 cars (-50%)");
    expect(differenceText({ delta: 5, deltaPercent: null, unit: "cars", verdict: "above" })).toBe("+5 cars (no percentage: 0 was expected)");
    expect(differenceText({ delta: null, deltaPercent: null, unit: "gbp", verdict: "unknown" })).toBe("Unknown");
  });
});

describe("dates", () => {
  it("writes a date the UK way, in UK time", () => {
    expect(formatDate("2030-06-13T12:00:00.000Z")).toBe("13 Jun 2030");
    expect(formatDate("2030-06-13T23:30:00.000Z")).toBe("14 Jun 2030"); // half past midnight in summer UK time
    expect(formatDateTime("2030-06-13T12:05:00.000Z")).toBe("13 Jun 2030, 13:05");
  });
  it("gives nothing for a missing or broken date", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("not a date")).toBe("");
    expect(formatDateTime("")).toBe("");
  });
});

describe("reviewText: when the review is due, in words", () => {
  const now = Date.parse("2030-06-01T12:00:00.000Z");
  const inDays = (n: number) => new Date(now + n * 86_400_000).toISOString();

  it("says nothing before a decision is made or after it has been reviewed", () => {
    expect(reviewText("open", inDays(5), now)).toBe("");
    expect(reviewText("reviewed", inDays(-5), now)).toBe("");
  });
  it("counts the days to go", () => {
    expect(reviewText("decided", inDays(12), now)).toBe("Review in 12 days, on 13 Jun 2030");
    expect(reviewText("decided", inDays(1), now)).toBe("Review in 1 day, on 2 Jun 2030");
  });
  it("says when it is overdue, and how long for", () => {
    expect(reviewText("review_due", inDays(-3), now)).toBe("Review was due 3 days ago");
    expect(reviewText("review_due", inDays(-1), now)).toBe("Review was due 1 day ago");
    expect(reviewText("review_due", new Date(now - 3_600_000).toISOString(), now)).toBe("Review is due now");
  });
  it("says nothing when there is no usable date", () => {
    expect(reviewText("decided", undefined, now)).toBe("");
    expect(reviewText("decided", "junk", now)).toBe("");
  });
});

describe("numbers typed into a box", () => {
  it("accepts plain numbers, thousands commas, decimals, negatives and a pound sign", () => {
    for (const [text, value] of [["5000", 5000], ["5,000", 5000], ["£5,000", 5000], ["-1500", -1500], ["-£500", -500], ["12.5", 12.5], [".5", 0.5], ["5.", 5], ["0", 0], ["  42  ", 42]] as const) {
      expect(parseNumberInput(text), text).toEqual({ ok: true, value });
    }
  });
  it("says empty for nothing at all", () => {
    for (const text of ["", "   ", "£"]) expect(parseNumberInput(text), text).toEqual({ ok: false, reason: "empty" });
  });
  it("refuses anything else rather than guessing", () => {
    for (const text of ["abc", "12abc", "1e3", "--5", "5 000", "1.2.3", "Infinity", "0x10", "1000000000001", "-1000000000001"]) {
      expect(parseNumberInput(text), text).toEqual({ ok: false, reason: "invalid" });
    }
  });
  it("takes only whole numbers where whole numbers are needed", () => {
    expect(parseWholeNumber("30")).toEqual({ ok: true, value: 30 });
    expect(parseWholeNumber("30.5")).toEqual({ ok: false, reason: "invalid" });
    expect(parseWholeNumber("")).toEqual({ ok: false, reason: "empty" });
  });
});

describe("buildDraft: the new-decision form, checked as the server checks it", () => {
  const form = (over: Partial<typeof BLANK_DECISION_FORM> = {}) => ({ question: "Buy another £50k of SUVs?", context: "Enquiries are up.", options: ["No change", "Add £50k"], ...over });

  it("tidies the question and the options and drops blank options", () => {
    const built = buildDraft(form({ question: "  Buy   more \n SUVs? ", options: ["No change", "  ", " Add  £50k ", ""] }));
    expect(built).toEqual({ ok: true, value: { question: "Buy more SUVs?", context: "Enquiries are up.", options: [{ label: "No change" }, { label: "Add £50k" }] } });
  });

  it("needs a question", () => {
    expect(buildDraft(form({ question: "   " }))).toEqual({ ok: false, error: "Please write the question you are deciding." });
  });

  it("needs two real options and allows at most six", () => {
    expect(buildDraft(form({ options: ["Only one", "  "] }))).toMatchObject({ ok: false, error: expect.stringMatching(/at least 2 options/) });
    expect(buildDraft(form({ options: Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => `Option ${i}`) }))).toMatchObject({ ok: false, error: expect.stringMatching(/at most 6 options/) });
    expect(buildDraft(form({ options: Array.from({ length: MAX_OPTIONS }, (_, i) => `Option ${i}`) })).ok).toBe(true);
  });

  it("needs each option to have its own name, ignoring case", () => {
    expect(buildDraft(form({ options: ["Same", "same"] }))).toEqual({ ok: false, error: "Each option needs its own name." });
  });

  it("refuses text that is too long, using the server's limits", () => {
    expect(buildDraft(form({ question: "q".repeat(QUESTION_MAX + 1) })).ok).toBe(false);
    expect(buildDraft(form({ question: "q".repeat(QUESTION_MAX) })).ok).toBe(true);
    expect(buildDraft(form({ options: ["a".repeat(OPTION_LABEL_MAX + 1), "b"] })).ok).toBe(false);
    expect(buildDraft(form({ context: "c".repeat(1501) })).ok).toBe(false);
  });

  it("starts with two blank options", () => {
    expect(BLANK_DECISION_FORM.options).toEqual(["", ""]);
  });
});

describe("buildDecideBody: Boss's decision form", () => {
  const keys = ["a", "b", "c"];
  const row = (over: Partial<ExpectationRowForm> = {}): ExpectationRowForm => ({ ...BLANK_EXPECTATION_ROW, metric: "Extra profit", expected: "5000", horizonDays: "90", ...over });
  const form = (over: Partial<DecideFormValues> = {}): DecideFormValues => ({ ...BLANK_DECIDE_FORM, optionKey: "b", ...over });
  const errorOf = (v: ReturnType<typeof buildDecideBody>) => (v.ok ? "" : v.error);

  it("builds the smallest valid decision: an option, and the default review in 90 days", () => {
    expect(buildDecideBody(form(), keys)).toEqual({ ok: true, value: { optionKey: "b", reasoning: "", expectations: [], reviewInDays: 90 } });
  });

  it("needs an option chosen, and one this decision has", () => {
    expect(errorOf(buildDecideBody(form({ optionKey: "" }), keys))).toBe("Please choose one of the options, or Other.");
    expect(errorOf(buildDecideBody(form({ optionKey: "d" }), keys))).toBe("Please choose one of the options, or Other.");
  });

  it("needs a few words for Other, and sends them only for Other", () => {
    expect(errorOf(buildDecideBody(form({ optionKey: "other" }), keys))).toMatch(/say in a few words/);
    expect(buildDecideBody(form({ optionKey: "other", otherText: "  Wait a month  " }), keys)).toMatchObject({ ok: true, value: { optionKey: "other", otherText: "Wait a month" } });
    const notOther = buildDecideBody(form({ optionKey: "a", otherText: "left over" }), keys);
    expect(notOther.ok && "otherText" in notOther.value).toBe(false);
  });

  it("takes a review date from 7 to 365 days", () => {
    expect(buildDecideBody(form({ reviewInDays: "7" }), keys).ok).toBe(true);
    expect(buildDecideBody(form({ reviewInDays: "365" }), keys).ok).toBe(true);
    for (const reviewInDays of ["6", "366", "abc", "", "30.5"]) {
      expect(errorOf(buildDecideBody(form({ reviewInDays }), keys)), reviewInDays).toMatch(/between 7 and 365 days/);
    }
  });

  it("turns each filled-in row into an expectation, reading pounds and negatives, and skips a row left blank", () => {
    const built = buildDecideBody(form({ expectations: [row(), row({ metric: "Loss", unit: "gbp", expected: "-£1,500", horizonDays: "30", basis: " last year " }), { ...BLANK_EXPECTATION_ROW }] }), keys);
    expect(built).toEqual({
      ok: true,
      value: {
        optionKey: "b",
        reasoning: "",
        reviewInDays: 90,
        expectations: [
          { metric: "Extra profit", unit: "gbp", expected: 5000, horizonDays: 90, basis: "" },
          { metric: "Loss", unit: "gbp", expected: -1500, horizonDays: 30, basis: "last year" },
        ],
      },
    });
  });

  it("names the row and the problem when a row is half done", () => {
    expect(errorOf(buildDecideBody(form({ expectations: [row({ expected: "" })] }), keys))).toBe("Expectation 1 (Extra profit): please give the number you expect.");
    expect(errorOf(buildDecideBody(form({ expectations: [row({ expected: "lots" })] }), keys))).toBe("Expectation 1 (Extra profit): please give the number you expect.");
    expect(errorOf(buildDecideBody(form({ expectations: [row(), row({ metric: "" })] }), keys))).toBe("Expectation 2: please say what you are measuring.");
    for (const horizonDays of ["0", "731", "abc", "", "1.5"]) {
      expect(errorOf(buildDecideBody(form({ expectations: [row({ horizonDays })] }), keys)), horizonDays).toMatch(/in how many days \(1 to 730\)/);
    }
  });

  it("allows at most six expectations", () => {
    const seven = Array.from({ length: 7 }, (_, i) => row({ metric: `M${i}` }));
    expect(errorOf(buildDecideBody(form({ expectations: seven }), keys))).toBe("Please give at most 6 expectations.");
    expect(buildDecideBody(form({ expectations: seven.slice(0, 6) }), keys).ok).toBe(true);
  });

  it("refuses reasons that are too long", () => {
    expect(errorOf(buildDecideBody(form({ reasoning: "r".repeat(1001) }), keys))).toMatch(/under 1000 characters/);
  });
});

describe("buildOutcomeBody: what actually happened", () => {
  const two: OutcomeFormValues = blankOutcomeForm(["e0", "e1"]);
  const filled = (a0: Partial<OutcomeFormValues["actuals"][number]>, a1: Partial<OutcomeFormValues["actuals"][number]> = { notKnown: true }): OutcomeFormValues => ({
    ...two,
    actuals: [{ ...two.actuals[0]!, ...a0 }, { ...two.actuals[1]!, ...a1 }],
  });
  const names = { e0: "Extra profit", e1: "Cars sold" };
  const errorOf = (v: ReturnType<typeof buildOutcomeBody>) => (v.ok ? "" : v.error);

  it("starts with one empty row per expectation", () => {
    expect(two.actuals).toEqual([
      { expectationId: "e0", actual: "", notKnown: false, note: "" },
      { expectationId: "e1", actual: "", notKnown: false, note: "" },
    ]);
    expect(blankOutcomeForm([]).actuals).toEqual([]);
  });

  it("reads a number, keeps a real 0, and records Not known as null (never 0)", () => {
    const built = buildOutcomeBody(filled({ actual: "£5,400", note: " one sold late " }, { actual: "0" }), names);
    expect(built).toMatchObject({ ok: true, value: { actuals: [{ expectationId: "e0", actual: 5400, note: "one sold late" }, { expectationId: "e1", actual: 0, note: "" }] } });
    const unknown = buildOutcomeBody(filled({ notKnown: true, actual: "999" }), names);
    expect(unknown).toMatchObject({ ok: true, value: { actuals: [{ actual: null }, { actual: null }] } }); // ticking Not known wins over a stray number
  });

  it("asks rather than quietly counting an empty box as unknown, and names the result", () => {
    expect(errorOf(buildOutcomeBody(filled({ actual: "   " }), names))).toBe("Please give the result for Extra profit, or tick Not known.");
    expect(errorOf(buildOutcomeBody(filled({ notKnown: true }, { actual: "" }), names))).toBe("Please give the result for Cars sold, or tick Not known.");
    expect(errorOf(buildOutcomeBody(filled({ actual: "about 5k" }), names))).toBe("The result for Extra profit needs to be a number, or tick Not known.");
  });

  it("carries the notes and the lessons, trimmed and within the limits", () => {
    const form = { ...filled({ actual: "1" }), notes: "  It went fine.  ", lessons: { pilotRight: "a", pilotWrong: "b", bossRight: "c", unexpected: "d", lesson: "e" } };
    expect(buildOutcomeBody(form, names)).toMatchObject({ ok: true, value: { notes: "It went fine.", lessons: { pilotRight: "a", lesson: "e" } } });
    expect(errorOf(buildOutcomeBody({ ...form, notes: "n".repeat(1001) }, names))).toMatch(/under 1000 characters/);
    expect(errorOf(buildOutcomeBody({ ...form, lessons: { ...form.lessons, lesson: "l".repeat(LESSON_MAX + 1) } }, names))).toMatch(/each lesson under 400/);
  });

  it("is fine with no expectations at all", () => {
    expect(buildOutcomeBody(blankOutcomeForm([]))).toMatchObject({ ok: true, value: { actuals: [], notes: "" } });
  });

  it("knows whether any lesson was written", () => {
    expect(hasLessons({ pilotRight: "", pilotWrong: " ", bossRight: "", unexpected: "", lesson: "" })).toBe(false);
    expect(hasLessons({ pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "Buy earlier" })).toBe(true);
  });
});

describe("followedPilot and chosenOptionText: the same rules as the server", () => {
  const rec = (optionKey: string, askedAt = "2030-01-01T00:00:00.000Z") => ({ optionKey, reasoning: "", confidence: "medium" as const, confidenceReasons: [], unknowns: [], askedAt });
  const boss = (optionKey: string, decidedAt = "2030-01-02T00:00:00.000Z", otherText?: string) => ({ optionKey, ...(otherText ? { otherText } : {}), reasoning: "", decidedAt, decidedByUserId: "u", decidedByName: "O" });

  it("is true for the recommended option, false for any other, and false for Other", () => {
    expect(followedPilot({ pilotRecommendation: rec("b"), bossDecision: boss("b") })).toBe(true);
    expect(followedPilot({ pilotRecommendation: rec("b"), bossDecision: boss("a") })).toBe(false);
    expect(followedPilot({ pilotRecommendation: rec("b"), bossDecision: boss("other", undefined, "Wait") })).toBe(false);
  });
  it("is null without both a recommendation and a decision, or when Pilot's view only came after the decision", () => {
    expect(followedPilot({ pilotRecommendation: undefined, bossDecision: boss("a") })).toBeNull();
    expect(followedPilot({ pilotRecommendation: rec("a"), bossDecision: undefined })).toBeNull();
    expect(followedPilot({ pilotRecommendation: rec("b", "2030-03-01T00:00:00.000Z"), bossDecision: boss("b", "2030-02-01T00:00:00.000Z") })).toBeNull();
    expect(followedPilot({ pilotRecommendation: rec("b", "2030-02-01T00:00:00.000Z"), bossDecision: boss("b", "2030-02-01T00:00:00.000Z") })).toBe(true);
  });
  it("says what Boss chose in words", () => {
    const options: Decision["options"] = [{ key: "a", label: "Hold" }, { key: "b", label: "Buy" }];
    expect(chosenOptionText({ options, bossDecision: boss("b") })).toBe("Option B: Buy");
    expect(chosenOptionText({ options, bossDecision: boss("other", undefined, "Wait a month") })).toBe("Other: Wait a month");
    expect(chosenOptionText({ options, bossDecision: boss("f") })).toBe("Option F");
    expect(chosenOptionText({ options, bossDecision: undefined })).toBe("");
  });
  it("words the follow-or-override plainly", () => {
    expect(followText(true)).toBe(FOLLOW_TEXT.followed);
    expect(followText(false)).toBe(FOLLOW_TEXT.overrode);
    expect(followText(null)).toBe("");
  });
});

describe("the labels", () => {
  it("names every state, verdict and kind of event in plain words", () => {
    expect(Object.values(STATE_LABEL)).toEqual(["Open", "Decided", "Review due", "Reviewed"]);
    expect(VERDICT_LABEL).toEqual({ close: "Close", above: "Above what you expected", below: "Below what you expected", unknown: "Unknown" });
    expect(Object.keys(EVENT_LABEL).sort()).toEqual(["challenge", "created", "decided", "edited", "outcome", "recommendation", "simulation"]);
  });
  it("offers the six units and review dates the server accepts", () => {
    expect(UNIT_OPTIONS.map(u => u.value)).toEqual(["gbp", "cars", "days", "months", "percent", "count"]);
    for (const c of REVIEW_CHOICES) expect(c.days >= 7 && c.days <= 365, c.label).toBe(true);
    expect(REVIEW_CHOICES.map(c => c.days)).toContain(90);
  });
  it("carries the two numbers the screens print", () => {
    expect(CLOSE_WITHIN_PERCENT).toBe(20);
    expect(MIN_REVIEWED_FOR_RATES).toBe(3);
    expect(TOO_FEW_REVIEWED_MESSAGE).toMatch(/too few reviewed decisions to say anything yet/i);
  });
});
