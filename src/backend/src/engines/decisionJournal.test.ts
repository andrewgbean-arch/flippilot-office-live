import { describe, it, expect } from "vitest";
import {
  CLOSE_WITHIN_PERCENT,
  MIN_REVIEWED_FOR_RATES,
  TOO_FEW_REVIEWED_MESSAGE,
  chosenLabel,
  compareOutcome,
  followedPilot,
  journalStats,
  judge,
  summariseDecision,
} from "./decisionJournal";
import type { Decision, Expectation } from "../decisionTypes";

// The Decision Journal sets what Boss EXPECTED beside what HAPPENED. These pin the
// arithmetic with numbers worked out by hand, so a change to how "close" is
// decided, or to when the journal starts talking about accuracy, is caught.

const NOW = Date.parse("2030-06-01T12:00:00.000Z");

const expectation = (id: string, expected: number, over: Partial<Expectation> = {}): Expectation => ({
  id,
  metric: `Metric ${id}`,
  unit: "gbp",
  expected,
  horizonDays: 90,
  basis: "",
  ...over,
});

let counter = 0;
function decision(over: Partial<Decision> = {}): Decision {
  counter += 1;
  return {
    id: `d${counter}`,
    question: "Buy more SUVs?",
    context: "",
    options: [
      { key: "a", label: "Hold" },
      { key: "b", label: "Buy" },
    ],
    createdAt: "2030-01-01T00:00:00.000Z",
    createdByUserId: "u1",
    createdByName: "Olivia Owner",
    updatedAt: "2030-01-01T00:00:00.000Z",
    simulations: [],
    expectations: [],
    events: [],
    ...over,
  };
}

const rec = (optionKey: string, askedAt = "2030-01-01T00:00:00.000Z") => ({
  optionKey,
  reasoning: "",
  confidence: "medium" as const,
  confidenceReasons: [],
  unknowns: [],
  askedAt,
});
const boss = (optionKey: string, decidedAt = "2030-01-02T00:00:00.000Z", otherText?: string) => ({
  optionKey,
  ...(otherText ? { otherText } : {}),
  reasoning: "",
  decidedAt,
  decidedByUserId: "u1",
  decidedByName: "Olivia Owner",
});
const outcomeOf = (actuals: Array<[string, number | null]>) => ({
  recordedAt: "2030-05-01T00:00:00.000Z",
  recordedByUserId: "u1",
  recordedByName: "Olivia Owner",
  actuals: actuals.map(([expectationId, actual]) => ({ expectationId, actual })),
  notes: "",
  lessons: { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" },
});

// A decision that has been decided and reviewed, with the given [expected, actual] pairs.
function reviewed(pairs: Array<[number, number | null]>, over: Partial<Decision> = {}): Decision {
  const expectations = pairs.map(([expected], i) => expectation(`e${i}`, expected));
  return decision({
    bossDecision: boss("b"),
    reviewDueAt: "2030-04-01T00:00:00.000Z",
    expectations,
    outcome: outcomeOf(pairs.map(([, actual], i) => [`e${i}`, actual])),
    ...over,
  });
}

describe("the two numbers the journal is built on", () => {
  it("counts a result as close when it is within 20% of what was expected", () => {
    expect(CLOSE_WITHIN_PERCENT).toBe(20);
  });
  it("says nothing about accuracy until three decisions have been reviewed", () => {
    expect(MIN_REVIEWED_FOR_RATES).toBe(3);
  });
});

describe("judge: how one result came out against what was expected", () => {
  it("is close, with no difference, when the result is exactly what was expected", () => {
    expect(judge(1000, 1000)).toEqual({ delta: 0, deltaPercent: 0, verdict: "close" });
  });

  it("is close just inside 20% and at exactly 20%, either side of what was expected", () => {
    expect(judge(1000, 1199)).toEqual({ delta: 199, deltaPercent: 19.9, verdict: "close" });
    expect(judge(1000, 1200)).toEqual({ delta: 200, deltaPercent: 20, verdict: "close" }); // the line itself is still close
    expect(judge(1000, 801)).toEqual({ delta: -199, deltaPercent: -19.9, verdict: "close" });
    expect(judge(1000, 800)).toEqual({ delta: -200, deltaPercent: -20, verdict: "close" });
  });

  it("is above or below the moment it is past 20%", () => {
    expect(judge(1000, 1201)).toEqual({ delta: 201, deltaPercent: 20.1, verdict: "above" });
    expect(judge(1000, 799)).toEqual({ delta: -201, deltaPercent: -20.1, verdict: "below" });
    expect(judge(100, 250)).toEqual({ delta: 150, deltaPercent: 150, verdict: "above" });
    expect(judge(100, 0)).toEqual({ delta: -100, deltaPercent: -100, verdict: "below" }); // a real 0 is a result, not "unknown"
  });

  it("is not thrown by decimal dust: 12 against 10 and 0.6 against 0.5 are exactly 20% out, so close", () => {
    expect(judge(10, 12).verdict).toBe("close");
    expect(judge(0.5, 0.6)).toMatchObject({ deltaPercent: 20, verdict: "close" });
    expect(judge(1.1, 1.32).verdict).toBe("close");
    expect(judge(0.3, 0.1 + 0.2).delta).toBe(0); // 0.30000000000000004 - 0.3 is not "a difference"
  });

  it("has no verdict when the result is not known: no difference, no percentage, and never zero", () => {
    expect(judge(1000, null)).toEqual({ delta: null, deltaPercent: null, verdict: "unknown" });
    expect(judge(0, null)).toEqual({ delta: null, deltaPercent: null, verdict: "unknown" });
    expect(judge(1000, Number.NaN).verdict).toBe("unknown");
    expect(judge(1000, Infinity).verdict).toBe("unknown");
  });

  it("has no percentage when 0 was expected: only an exact 0 is close, anything else is above or below", () => {
    expect(judge(0, 0)).toEqual({ delta: 0, deltaPercent: null, verdict: "close" });
    expect(judge(0, 5)).toEqual({ delta: 5, deltaPercent: null, verdict: "above" });
    expect(judge(0, -5)).toEqual({ delta: -5, deltaPercent: null, verdict: "below" });
    expect(judge(0, 0.01).verdict).toBe("above"); // "within 20% of nothing" is nothing
  });

  it("measures a negative expectation against its size, so the sign still means higher or lower", () => {
    // expected a loss of 1,000
    expect(judge(-1000, -800)).toEqual({ delta: 200, deltaPercent: 20, verdict: "close" }); // 200 higher: a smaller loss
    expect(judge(-1000, -799)).toEqual({ delta: 201, deltaPercent: 20.1, verdict: "above" });
    expect(judge(-1000, -1200)).toEqual({ delta: -200, deltaPercent: -20, verdict: "close" });
    expect(judge(-1000, -1300)).toEqual({ delta: -300, deltaPercent: -30, verdict: "below" });
    expect(judge(-1000, 100)).toEqual({ delta: 1100, deltaPercent: 110, verdict: "above" }); // a profit instead of a loss
  });
});

describe("compareOutcome: every expectation beside what happened", () => {
  it("gives one row per expectation, in the order they were written, with the figures worked out", () => {
    const d = reviewed([
      [2000, 2100], // +100, +5%
      [10, 15], // +5, +50%
      [40, 20], // -20, -50%
    ]);
    const rows = compareOutcome(d);
    expect(rows.map(r => [r.expectationId, r.expected, r.actual, r.delta, r.deltaPercent, r.verdict])).toEqual([
      ["e0", 2000, 2100, 100, 5, "close"],
      ["e1", 10, 15, 5, 50, "above"],
      ["e2", 40, 20, -20, -50, "below"],
    ]);
  });

  it("carries the metric, unit, horizon, basis and the note Boss wrote about the result", () => {
    const d = decision({
      bossDecision: boss("b"),
      expectations: [expectation("x", 500, { metric: "Extra profit", unit: "gbp", horizonDays: 60, basis: "Last spring" })],
      outcome: { ...outcomeOf([]), actuals: [{ expectationId: "x", actual: 480, note: "Two sold late" }] },
    });
    expect(compareOutcome(d)).toEqual([
      {
        expectationId: "x",
        metric: "Extra profit",
        unit: "gbp",
        horizonDays: 60,
        basis: "Last spring",
        expected: 500,
        actual: 480,
        delta: -20,
        deltaPercent: -4,
        verdict: "close",
        note: "Two sold late",
      },
    ]);
  });

  it("counts a result nobody recorded as not known, never as zero", () => {
    const d = decision({
      bossDecision: boss("b"),
      expectations: [expectation("e0", 100), expectation("e1", 100)],
      outcome: outcomeOf([["e0", 100]]), // e1 was left out
    });
    const [first, second] = compareOutcome(d);
    expect(first).toMatchObject({ actual: 100, verdict: "close" });
    expect(second).toMatchObject({ actual: null, delta: null, deltaPercent: null, verdict: "unknown" });
  });

  it("keeps a real result of 0 apart from one that is not known", () => {
    const d = reviewed([
      [100, 0],
      [100, null],
    ]);
    const [zero, unknown] = compareOutcome(d);
    expect(zero).toMatchObject({ actual: 0, delta: -100, verdict: "below" });
    expect(unknown).toMatchObject({ actual: null, verdict: "unknown" });
  });

  it("treats a decision with no outcome as having every result not known", () => {
    const d = decision({ bossDecision: boss("b"), expectations: [expectation("e0", 100)] });
    expect(compareOutcome(d)[0]).toMatchObject({ actual: null, verdict: "unknown" });
  });

  it("gives nothing for a decision with no expectations, and ignores a result for one that was never expected", () => {
    expect(compareOutcome(reviewed([]))).toEqual([]);
    const d = decision({
      bossDecision: boss("b"),
      expectations: [expectation("e0", 100)],
      outcome: outcomeOf([["ghost", 5], ["e0", 100]]),
    });
    expect(compareOutcome(d).map(r => r.expectationId)).toEqual(["e0"]);
  });
});

describe("followedPilot: did Boss go with Pilot's recommendation?", () => {
  it("is true when the choice is the recommended option, false when it is any other", () => {
    expect(followedPilot({ pilotRecommendation: rec("b"), bossDecision: boss("b") })).toBe(true);
    expect(followedPilot({ pilotRecommendation: rec("b"), bossDecision: boss("a") })).toBe(false);
  });

  it("counts choosing Other as going against the recommendation", () => {
    expect(followedPilot({ pilotRecommendation: rec("b"), bossDecision: boss("other", undefined, "Wait a month") })).toBe(false);
  });

  it("is null unless there is both a recommendation and a decision", () => {
    expect(followedPilot({ pilotRecommendation: undefined, bossDecision: boss("a") })).toBeNull();
    expect(followedPilot({ pilotRecommendation: rec("a"), bossDecision: undefined })).toBeNull();
    expect(followedPilot({ pilotRecommendation: undefined, bossDecision: undefined })).toBeNull();
  });

  it("is null when Pilot's view was asked for only AFTER Boss had decided: it was not part of the decision", () => {
    expect(
      followedPilot({
        pilotRecommendation: rec("b", "2030-03-01T00:00:00.000Z"),
        bossDecision: boss("b", "2030-02-01T00:00:00.000Z"),
      })
    ).toBeNull();
    // asked at the same moment, or before, does count
    expect(followedPilot({ pilotRecommendation: rec("b", "2030-02-01T00:00:00.000Z"), bossDecision: boss("b", "2030-02-01T00:00:00.000Z") })).toBe(true);
  });
});

describe("summariseDecision and chosenLabel", () => {
  it("summarises an open decision", () => {
    const d = decision({ question: "Add a second forecourt?", pilotRecommendation: rec("a"), devilsAdvocate: undefined });
    expect(summariseDecision(d, NOW)).toEqual({
      id: d.id,
      question: "Add a second forecourt?",
      state: "open",
      createdAt: "2030-01-01T00:00:00.000Z",
      decidedAt: null,
      chosenOption: null,
      followedPilot: null,
      reviewDueAt: null,
      hasRecommendation: true,
      hasChallenge: false,
      simulationCount: 0,
    });
  });

  it("names the chosen option, or the words Boss typed for Other", () => {
    expect(chosenLabel(decision({ bossDecision: boss("b") }))).toBe("Buy");
    expect(chosenLabel(decision({ bossDecision: boss("other", undefined, "Wait a month") }))).toBe("Other: Wait a month");
    expect(chosenLabel(decision())).toBeNull();
  });

  it("summarises a decided decision with its follow-or-override, review date and state", () => {
    const d = decision({ pilotRecommendation: rec("a"), bossDecision: boss("b", "2030-02-01T00:00:00.000Z"), reviewDueAt: "2030-09-01T00:00:00.000Z" });
    expect(summariseDecision(d, NOW)).toMatchObject({
      state: "decided",
      decidedAt: "2030-02-01T00:00:00.000Z",
      chosenOption: "Buy",
      followedPilot: false,
      reviewDueAt: "2030-09-01T00:00:00.000Z",
    });
    expect(summariseDecision(d, Date.parse("2030-09-02T00:00:00.000Z")).state).toBe("review_due");
  });
});

describe("journalStats: counts by state", () => {
  it("is all zeros and says there is too little to go on when the journal is empty", () => {
    const s = journalStats([], NOW);
    expect(s.total).toBe(0);
    expect(s.counts).toEqual({ open: 0, decided: 0, review_due: 0, reviewed: 0 });
    expect(s.followedPilot).toBe(0);
    expect(s.overrodePilot).toBe(0);
    expect(s.enoughReviewed).toBe(false);
    expect(s.summary).toBe(TOO_FEW_REVIEWED_MESSAGE);
  });

  it("counts open, decided, review due and reviewed decisions", () => {
    const list = [
      decision(), // open
      decision(), // open
      decision({ bossDecision: boss("a"), reviewDueAt: "2030-09-01T00:00:00.000Z" }), // decided, not due
      decision({ bossDecision: boss("a"), reviewDueAt: "2030-05-01T00:00:00.000Z" }), // decided, due
      decision({ bossDecision: boss("a"), reviewDueAt: "2030-05-15T00:00:00.000Z" }), // decided, due
      decision({ bossDecision: boss("a"), reviewDueAt: "2030-05-01T00:00:00.000Z" }), // decided, due
      reviewed([[1, 1]]),
    ];
    const s = journalStats(list, NOW);
    expect(s.total).toBe(7);
    expect(s.counts).toEqual({ open: 2, decided: 1, review_due: 3, reviewed: 1 });
    expect(s.reviewedDecisions).toBe(1);
  });
});

describe("journalStats: followed and overrode Pilot", () => {
  it("counts only decisions that have both a recommendation and Boss's choice", () => {
    const list = [
      decision({ pilotRecommendation: rec("b"), bossDecision: boss("b") }), // followed
      decision({ pilotRecommendation: rec("b"), bossDecision: boss("b") }), // followed
      decision({ pilotRecommendation: rec("b"), bossDecision: boss("a") }), // overrode
      decision({ pilotRecommendation: rec("b"), bossDecision: boss("other", undefined, "Wait") }), // overrode
      decision({ pilotRecommendation: rec("b") }), // Pilot has spoken, Boss has not decided: not counted
      decision({ bossDecision: boss("a") }), // Boss decided with no recommendation: not counted
      decision(), // nothing yet: not counted
    ];
    const s = journalStats(list, NOW);
    expect(s.followedPilot).toBe(2);
    expect(s.overrodePilot).toBe(2);
  });

  it("does not count a recommendation that only came after the decision", () => {
    const late = decision({ pilotRecommendation: rec("b", "2030-03-01T00:00:00.000Z"), bossDecision: boss("b", "2030-02-01T00:00:00.000Z") });
    const s = journalStats([late], NOW);
    expect(s.followedPilot).toBe(0);
    expect(s.overrodePilot).toBe(0);
  });
});

describe("journalStats: how expectations came out, and when the journal will say so", () => {
  // Three reviewed decisions, worked by hand:
  //   d1: 100 -> 110 (+10%, close)   50 -> 80 (+60%, above)
  //   d2: 200 -> 100 (-50%, below)   10 -> not known
  //   d3: 1000 -> 1000 (close)
  // Five expectations: 2 close, 1 above, 1 below, 1 not known. Four could be checked.
  const three = () => [
    reviewed([[100, 110], [50, 80]], { pilotRecommendation: rec("b"), bossDecision: boss("b") }),
    reviewed([[200, 100], [10, null]], { pilotRecommendation: rec("b"), bossDecision: boss("b") }),
    reviewed([[1000, 1000]], { pilotRecommendation: rec("b"), bossDecision: boss("a") }),
  ];

  it("says plainly that there are too few reviewed decisions with none, one or two of them", () => {
    for (const n of [0, 1, 2]) {
      const s = journalStats(three().slice(0, n), NOW);
      expect(s.reviewedDecisions).toBe(n);
      expect(s.enoughReviewed, `${n} reviewed`).toBe(false);
      expect(s.summary, `${n} reviewed`).toBe(TOO_FEW_REVIEWED_MESSAGE);
      expect(s.summary).toMatch(/too few reviewed decisions to say anything yet/i);
      expect(s.followedGroup.sentence).toBe(TOO_FEW_REVIEWED_MESSAGE);
      expect(s.overrodeGroup.sentence).toBe(TOO_FEW_REVIEWED_MESSAGE);
    }
  });

  it("never puts a rate or a percentage in the message it gives below three", () => {
    const s = journalStats(three().slice(0, 2), NOW);
    expect(s.summary).not.toMatch(/\d/);
    expect(s.summary).not.toContain("%");
  });

  it("gives the accuracy sentence at exactly three reviewed decisions, worked out from the counts", () => {
    const s = journalStats(three(), NOW);
    expect(s.reviewedDecisions).toBe(3);
    expect(s.enoughReviewed).toBe(true);
    expect(s.tally).toEqual({ close: 2, above: 1, below: 1, unknown: 1, total: 5 });
    expect(s.summary).toBe(
      "Across 3 reviewed decisions: 2 of 4 results came out close to what you expected (within 20%), 1 above and 1 below. 1 result was not known, so not counted."
    );
  });

  it("never turns the counts into a percentage, apart from the 20% that defines close", () => {
    const s = journalStats(three(), NOW);
    expect(s.summary.replace("(within 20%)", "")).not.toContain("%");
  });

  it("keeps the counts (they are facts) below three, but builds no sentence from them", () => {
    const s = journalStats(three().slice(0, 1), NOW);
    expect(s.tally).toEqual({ close: 1, above: 1, below: 0, unknown: 0, total: 2 });
    expect(s.summary).toBe(TOO_FEW_REVIEWED_MESSAGE);
  });

  it("only counts REVIEWED decisions: expectations on a decision still waiting for its outcome are left out", () => {
    const waiting = decision({ bossDecision: boss("b"), reviewDueAt: "2030-05-01T00:00:00.000Z", expectations: [expectation("w", 100)] });
    const s = journalStats([...three(), waiting], NOW);
    expect(s.tally.total).toBe(5);
    expect(s.counts.review_due).toBe(1);
  });

  it("says so when there are enough reviewed decisions but none of them has a result to check", () => {
    const s = journalStats([reviewed([]), reviewed([[5, null]]), reviewed([])], NOW);
    expect(s.enoughReviewed).toBe(true);
    expect(s.summary).toBe("Across 3 reviewed decisions: none of the results could be checked (they were not known, or no expectations were set).");
  });

  it("writes a singular where there is one", () => {
    const s = journalStats([reviewed([[100, 100]]), reviewed([]), reviewed([])], NOW);
    expect(s.summary).toBe("Across 3 reviewed decisions: 1 of 1 result came out close to what you expected (within 20%), 0 above and 0 below.");
  });

  it("splits the counts into the decisions where Boss followed Pilot and where Boss overrode it", () => {
    const s = journalStats(three(), NOW);
    // followed: d1 and d2 (2 reviewed decisions); overrode: d3 (1)
    expect(s.followedGroup.reviewedDecisions).toBe(2);
    expect(s.followedGroup.tally).toEqual({ close: 1, above: 1, below: 1, unknown: 1, total: 4 });
    expect(s.overrodeGroup.reviewedDecisions).toBe(1);
    expect(s.overrodeGroup.tally).toEqual({ close: 1, above: 0, below: 0, unknown: 0, total: 1 });
    // ...and neither group has three yet, so neither says anything even though the whole journal does
    expect(s.followedGroup.sentence).toBe(TOO_FEW_REVIEWED_MESSAGE);
    expect(s.overrodeGroup.sentence).toBe(TOO_FEW_REVIEWED_MESSAGE);
    expect(s.summary).not.toBe(TOO_FEW_REVIEWED_MESSAGE);
  });

  it("gives each group its own sentence once it has three reviewed decisions of its own", () => {
    const followed = (p: Array<[number, number | null]>) => reviewed(p, { pilotRecommendation: rec("b"), bossDecision: boss("b") });
    const overrode = (p: Array<[number, number | null]>) => reviewed(p, { pilotRecommendation: rec("b"), bossDecision: boss("a") });
    const list = [
      followed([[100, 100]]),
      followed([[100, 150]]),
      followed([[100, 60]]),
      overrode([[100, 90]]),
      overrode([[100, 300]]),
      overrode([[100, 100], [100, null]]),
    ];
    const s = journalStats(list, NOW);
    expect(s.followedGroup.sentence).toBe(
      "When you followed Pilot (3 reviewed decisions): 1 of 3 results came out close to what you expected (within 20%), 1 above and 1 below."
    );
    expect(s.overrodeGroup.sentence).toBe(
      "When you overrode Pilot (3 reviewed decisions): 2 of 3 results came out close to what you expected (within 20%), 1 above and 0 below. 1 result was not known, so not counted."
    );
  });

  it("leaves a reviewed decision with no recommendation out of both groups, but in the whole", () => {
    const s = journalStats([reviewed([[100, 100]]), reviewed([[100, 100]]), reviewed([[100, 100]])], NOW);
    expect(s.followedGroup.reviewedDecisions).toBe(0);
    expect(s.overrodeGroup.reviewedDecisions).toBe(0);
    expect(s.tally.total).toBe(3);
    expect(s.enoughReviewed).toBe(true);
  });

  it("reports the numbers the screens print, so they never say a different 20 or 3", () => {
    const s = journalStats([], NOW);
    expect(s.closeWithinPercent).toBe(CLOSE_WITHIN_PERCENT);
    expect(s.minReviewedForRates).toBe(MIN_REVIEWED_FOR_RATES);
  });
});
