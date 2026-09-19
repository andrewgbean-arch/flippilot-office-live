import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Decision, DecisionState } from "@/lib/decisionTypes";
import type { DecisionDetail, DecisionSummary, ExpectationResult, JournalStats } from "@/lib/decisionsApi";
import AuditTrail from "./AuditTrail";
import BossDecisionForm from "./BossDecisionForm";
import ComparisonTable from "./ComparisonTable";
import DecisionDetailView from "./DecisionDetailView";
import DecisionForm from "./DecisionForm";
import DecisionList from "./DecisionList";
import OutcomeForm from "./OutcomeForm";
import StatsStrip from "./StatsStrip";
import { NotAllowed, StateChip, VerdictChip, KindTag } from "./decisionUi";

// The Decisions screens, drawn to static HTML (no browser, no DOM library) and
// read as text: what is on the page, what is not, and what it says about each
// number. The two panels other builders own (Pilot's view, the simulator) are
// replaced by markers, so this only checks that the page mounts them with the
// decision.
vi.mock("./AnalysisCard", async () => {
  const { createElement } = await import("react");
  return { default: (p: { decision: { id: string; question: string } }) => createElement("div", { "data-panel": "analysis" }, `analysis-panel:${p.decision.id}`) };
});
vi.mock("./SimulatorPanel", async () => {
  const { createElement } = await import("react");
  return { default: (p: { decision: { id: string; question: string } }) => createElement("div", { "data-panel": "simulator" }, `simulator-panel:${p.decision.id}`) };
});

const NOW = Date.parse("2030-06-01T12:00:00.000Z");
const iso = (daysFromNow: number) => new Date(NOW + daysFromNow * 86_400_000).toISOString();
const noop = () => undefined;

const lessons = { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" };
const recommendation = (optionKey = "b") => ({ optionKey, reasoning: "The numbers support it.", confidence: "medium" as const, confidenceReasons: ["Six months of sales"], unknowns: [], askedAt: iso(-20) });
const bossDecision = (optionKey = "b") => ({ optionKey, reasoning: "Enquiries are up.", decidedAt: iso(-10), decidedByUserId: "u1", decidedByName: "Olivia Owner" });

function decision(over: Partial<Decision> = {}): Decision {
  return {
    id: "d-1",
    question: "Buy another £50k of SUVs?",
    context: "Enquiries are up.",
    options: [{ key: "a", label: "No change" }, { key: "b", label: "Add £50k" }, { key: "c", label: "Add £25k" }],
    createdAt: iso(-30),
    createdByUserId: "u1",
    createdByName: "Olivia Owner",
    updatedAt: iso(-30),
    simulations: [],
    expectations: [],
    events: [{ at: iso(-30), byUserId: "u1", byName: "Olivia Owner", action: "created" }],
    ...over,
  };
}

const expectations = [
  { id: "e0", metric: "Extra profit", unit: "gbp" as const, expected: 5000, horizonDays: 90, basis: "Last spring" },
  { id: "e1", metric: "Cars sold", unit: "cars" as const, expected: 4, horizonDays: 60, basis: "" },
];

const row = (over: Partial<ExpectationResult> = {}): ExpectationResult => ({
  expectationId: "e0", metric: "Extra profit", unit: "gbp", horizonDays: 90, basis: "", expected: 5000, actual: 5400, delta: 400, deltaPercent: 8, verdict: "close", note: "", ...over,
});

const stats = (over: Partial<JournalStats> = {}): JournalStats => ({
  total: 4,
  counts: { open: 2, decided: 1, review_due: 1, reviewed: 0 },
  followedPilot: 1,
  overrodePilot: 1,
  reviewedDecisions: 0,
  enoughReviewed: false,
  closeWithinPercent: 20,
  minReviewedForRates: 3,
  tally: { close: 0, above: 0, below: 0, unknown: 0, total: 0 },
  followedGroup: { reviewedDecisions: 0, tally: { close: 0, above: 0, below: 0, unknown: 0, total: 0 }, sentence: "Too few reviewed decisions to say anything yet." },
  overrodeGroup: { reviewedDecisions: 0, tally: { close: 0, above: 0, below: 0, unknown: 0, total: 0 }, sentence: "Too few reviewed decisions to say anything yet." },
  summary: "Too few reviewed decisions to say anything yet.",
  ...over,
});

const count = (html: string, needle: string | RegExp) => (html.match(typeof needle === "string" ? new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g") : needle) ?? []).length;

describe("who sees what", () => {
  it("tells anyone who is not an owner or manager so, plainly", () => {
    const html = renderToStaticMarkup(<NotAllowed />);
    expect(html).toContain("Decisions are for owners and managers");
  });
});

describe("the chips say the state and the verdict in words", () => {
  it("names each state", () => {
    for (const [state, word] of [["open", "Open"], ["decided", "Decided"], ["review_due", "Review due"], ["reviewed", "Reviewed"]] as Array<[DecisionState, string]>) {
      const html = renderToStaticMarkup(<StateChip state={state} />);
      expect(html).toContain(word);
      expect(html).toContain(`dj-chip--${state}`);
    }
  });
  it("names each verdict, and says which way above and below went", () => {
    expect(renderToStaticMarkup(<VerdictChip verdict="close" />)).toContain("Close");
    expect(renderToStaticMarkup(<VerdictChip verdict="above" />)).toContain("Above what you expected");
    expect(renderToStaticMarkup(<VerdictChip verdict="below" />)).toContain("Below what you expected");
    expect(renderToStaticMarkup(<VerdictChip verdict="unknown" />)).toContain("Unknown");
  });
  it("labels a number with its kind and explains it", () => {
    const html = renderToStaticMarkup(<KindTag kind="predicted" />);
    expect(html).toContain("predicted");
    expect(html).toContain("an assumption about the future");
  });
});

describe("the stats strip", () => {
  it("shows the four counts, each labelled as known", () => {
    const html = renderToStaticMarkup(<StatsStrip stats={stats()} />);
    for (const label of ["Open", "Review due", "Followed Pilot", "Overrode Pilot"]) expect(html).toContain(label);
    expect(count(html, ">known<")).toBe(4);
  });

  it("says plainly there are too few reviewed decisions, with no rate and no percentage, until enough are reviewed", () => {
    const html = renderToStaticMarkup(<StatsStrip stats={stats({ reviewedDecisions: 2 })} />);
    expect(html).toContain("Too few reviewed decisions to say anything yet.");
    expect(html).toContain("once 3 decisions have been reviewed");
    // the only percentage on screen is the definition of "close"
    expect(html.replace("within 20% of what you expected", "")).not.toContain("%");
  });

  it("gives the sentence the server worked out once there are enough, and each group's own line", () => {
    const html = renderToStaticMarkup(
      <StatsStrip
        stats={stats({
          enoughReviewed: true,
          reviewedDecisions: 6,
          summary: "Across 6 reviewed decisions: 7 of 11 results came out close to what you expected (within 20%), 3 above and 1 below.",
          followedGroup: { reviewedDecisions: 3, tally: { close: 3, above: 0, below: 0, unknown: 0, total: 3 }, sentence: "When you followed Pilot (3 reviewed decisions): 3 of 3 results came out close to what you expected (within 20%), 0 above and 0 below." },
          overrodeGroup: { reviewedDecisions: 1, tally: { close: 0, above: 1, below: 0, unknown: 0, total: 1 }, sentence: "Too few reviewed decisions to say anything yet." },
        })}
      />
    );
    expect(html).toContain("Across 6 reviewed decisions: 7 of 11 results came out close");
    expect(html).toContain("When you followed Pilot (3 reviewed decisions): 3 of 3 results");
    // the group with too few says so, under its own label, rather than giving a rate
    expect(html).toContain("When you overrode Pilot:");
    expect(html).toContain("Too few reviewed decisions to say anything yet.");
    expect(html).toContain("inferred");
  });

  it("says what close means, and that this is not a forecast", () => {
    const html = renderToStaticMarkup(<StatsStrip stats={stats({ closeWithinPercent: 20 })} />);
    expect(html).toContain("Close means within 20% of what you expected");
    expect(html).toContain("not a forecast");
  });
});

describe("the list of decisions", () => {
  const summary = (over: Partial<DecisionSummary> = {}): DecisionSummary => ({
    id: "d-1", question: "Buy another £50k of SUVs?", state: "open", createdAt: iso(-3), decidedAt: null, chosenOption: null, followedPilot: null, reviewDueAt: null, hasRecommendation: false, hasChallenge: false, simulationCount: 0, ...over,
  });

  it("invites a first decision when there are none", () => {
    const html = renderToStaticMarkup(<DecisionList decisions={[]} nowMs={NOW} onOpen={noop} />);
    expect(html).toContain("Nothing written down yet");
    expect(html).not.toContain("<button");
  });

  it("shows each decision as one tap target with its state and the facts that matter", () => {
    const html = renderToStaticMarkup(
      <DecisionList
        nowMs={NOW}
        onOpen={noop}
        decisions={[
          summary({ id: "a", question: "First question?" }),
          summary({ id: "b", question: "Second question?", state: "decided", decidedAt: iso(-5), chosenOption: "Add £50k", followedPilot: true, reviewDueAt: iso(20), hasRecommendation: true, hasChallenge: true, simulationCount: 2 }),
          summary({ id: "c", question: "Third question?", state: "review_due", decidedAt: iso(-100), chosenOption: "No change", followedPilot: false, reviewDueAt: iso(-3), hasRecommendation: true }),
          summary({ id: "d", question: "Fourth question?", state: "reviewed", decidedAt: iso(-200), chosenOption: "Other: Wait", reviewDueAt: iso(-110) }),
        ]}
      />
    );
    expect(count(html, "<button")).toBe(4);
    for (const q of ["First question?", "Second question?", "Third question?", "Fourth question?"]) expect(html).toContain(q);
    for (const state of ["Open", "Decided", "Review due", "Reviewed"]) expect(html).toContain(`>${state}<`);
    expect(html).toContain("Pilot advised");
    expect(html).toContain("Challenged");
    expect(html).toContain("2 simulations");
    expect(html).toContain("You followed Pilot");
    expect(html).toContain("You went against Pilot");
    expect(html).toContain("You chose: Add £50k.");
    expect(html).toContain("Review in 20 days");
    expect(html).toContain("Review was due 3 days ago");
    expect(html).not.toContain("Review was due 110"); // a reviewed decision has nothing left to review
  });

  it("uses the singular for one simulation, and draws the words people typed as text, never as markup", () => {
    const html = renderToStaticMarkup(<DecisionList nowMs={NOW} onOpen={noop} decisions={[summary({ question: "<script>alert(1)</script> or <b>bold</b>?", simulationCount: 1 })]} />);
    expect(html).toContain("1 simulation<");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>bold");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("the new-decision form", () => {
  it("asks for the question, some background and two options, with the server's limits on the boxes", () => {
    const html = renderToStaticMarkup(<DecisionForm heading="New decision" submitLabel="Write it down" busy={false} error={null} onSubmit={noop} onCancel={noop} />);
    expect(html).toContain("What are you deciding?");
    expect(html).toContain('maxLength="160"');
    expect(html).toContain('maxLength="1500"');
    expect(count(html, 'aria-label="Option ')).toBe(2);
    expect(html).toContain("Add another option");
    expect(html).not.toContain("Remove option"); // never fewer than two
    expect(html).toContain("Write it down");
    expect(html).toContain("Cancel");
  });

  it("stops offering more options at six, and lets a third and later be removed", () => {
    const six = renderToStaticMarkup(<DecisionForm heading="Edit" submitLabel="Save" busy={false} error={null} onSubmit={noop} initial={{ question: "Q?", context: "", options: ["a", "b", "c", "d", "e", "f"] }} />);
    expect(six).not.toContain("Add another option");
    expect(count(six, "Remove option")).toBe(6);
    expect(six).toContain('value="Q?"');
  });

  it("shows an error it was given, and a busy button while saving", () => {
    const html = renderToStaticMarkup(<DecisionForm heading="New" submitLabel="Write it down" busy error="The journal is full." onSubmit={noop} />);
    expect(html).toContain("The journal is full.");
    expect(html).toContain("Saving…");
    expect(html).toContain("disabled");
  });
});

describe("Boss's decision form", () => {
  const render = (d: Decision) => renderToStaticMarkup(<BossDecisionForm decision={d} busy={false} error={null} onSubmit={noop} />);

  it("says Boss decides, and offers each option and Other", () => {
    const html = render(decision());
    expect(html).toContain("You decide. Pilot only advises.");
    expect(count(html, 'type="radio"')).toBe(4); // three options and Other
    for (const label of ["No change", "Add £50k", "Add £25k", "Other: something else"]) expect(html).toContain(label);
  });

  it("says what Pilot recommended, with a level and never a percentage, and marks that option", () => {
    const html = render(decision({ pilotRecommendation: recommendation("b") }));
    expect(html).toContain('Pilot recommended option B, &quot;Add £50k&quot; (confidence: medium)');
    expect(count(html, "Pilot recommended</span>")).toBe(1);
    expect(html).toContain("If you go a different way from Pilot, that is fine: it is written down, not argued with.");
    expect(html).not.toMatch(/\d\s*%/);
  });

  it("says so when Pilot has given no recommendation, and still lets Boss decide", () => {
    const html = render(decision());
    expect(html).toContain("Pilot has not given a recommendation on this one");
    expect(html).toContain("Record my decision");
  });

  it("labels the expectations as predictions, and offers a review date, before deciding is confirmed", () => {
    const html = render(decision());
    expect(html).toContain("What do you expect to happen?");
    expect(html).toContain("predicted");
    expect(html).toContain("Look back at how it went");
    expect(html).toContain("in 90 days");
    expect(html).toContain("Add an expectation");
    expect(html).not.toContain("Yes, record my decision"); // the confirmation only appears after the first tap
  });
});

describe("what actually happened: the form", () => {
  const render = (d: Decision) => renderToStaticMarkup(<OutcomeForm decision={d} busy={false} error={null} onSubmit={noop} />);

  it("has a box and a Not known tick for each expectation, showing what was expected", () => {
    const html = render(decision({ bossDecision: bossDecision(), expectations }));
    expect(html).toContain("Extra profit");
    expect(html).toContain("Cars sold");
    expect(html).toContain("You expected £5,000");
    expect(html).toContain("You expected 4 cars");
    expect(html).toContain("predicted");
    expect(count(html, 'type="checkbox"')).toBe(2);
    expect(count(html, "Not known")).toBeGreaterThanOrEqual(2);
    expect(html).toContain("kept as unknown, never as zero");
  });

  it("has the notes box, five lesson boxes and the record button", () => {
    const html = render(decision({ bossDecision: bossDecision(), expectations }));
    for (const label of ["What Pilot got right", "What Pilot got wrong", "What you got right", "What surprised you", "The lesson for next time"]) expect(html).toContain(label);
    expect(html).toContain("What happened, in your own words");
    expect(html).toContain("Record what happened");
    expect(html).not.toContain("Yes, record what happened");
  });

  it("says there is nothing to compare when no expectations were set, but still lets Boss write it down", () => {
    const html = render(decision({ bossDecision: bossDecision(), expectations: [] }));
    expect(html).toContain("You did not set any expectations");
    expect(count(html, 'type="checkbox"')).toBe(0);
    expect(html).toContain("Record what happened");
  });
});

describe("the comparison table", () => {
  it("shows what was expected as predicted, what happened as known, the difference as inferred, and a verdict chip", () => {
    const html = renderToStaticMarkup(<ComparisonTable closeWithinPercent={20} rows={[row()]} />);
    expect(html).toContain("£5,000");
    expect(html).toContain("£5,400");
    expect(html).toContain("+£400 (+8%)");
    expect(html).toContain(">predicted<");
    expect(html).toContain(">known<");
    expect(html).toContain(">inferred<");
    expect(html).toContain("Close");
    expect(html).toContain("Close means within 20% of what you expected");
  });

  it("says Unknown, tagged unknown, when a result was not known: never £0, never blank", () => {
    const html = renderToStaticMarkup(<ComparisonTable closeWithinPercent={20} rows={[row({ actual: null, delta: null, deltaPercent: null, verdict: "unknown" })]} />);
    expect(count(html, ">Unknown<")).toBeGreaterThanOrEqual(2); // the result and the verdict chip's word sits beside its mark
    expect(html).not.toContain("£0");
    expect(html).toContain(">unknown<");
    expect(html).not.toContain(">known<");
  });

  it("keeps a real result of zero apart from one that is not known", () => {
    const html = renderToStaticMarkup(<ComparisonTable closeWithinPercent={20} rows={[row({ expected: 4, unit: "cars", actual: 0, delta: -4, deltaPercent: -100, verdict: "below" })]} />);
    expect(html).toContain("0 cars");
    expect(html).toContain(">known<");
    expect(html).toContain("-4 cars (-100%)");
    expect(html).toContain("Below what you expected");
  });

  it("shows every verdict chip", () => {
    const html = renderToStaticMarkup(
      <ComparisonTable
        closeWithinPercent={20}
        rows={[
          row({ expectationId: "1", verdict: "close" }),
          row({ expectationId: "2", actual: 9000, delta: 4000, deltaPercent: 80, verdict: "above" }),
          row({ expectationId: "3", actual: 100, delta: -4900, deltaPercent: -98, verdict: "below" }),
          row({ expectationId: "4", actual: null, delta: null, deltaPercent: null, verdict: "unknown" }),
        ]}
      />
    );
    for (const word of ["Close", "Above what you expected", "Below what you expected", "Unknown"]) expect(html).toContain(word);
    expect(count(html, "<tr")).toBe(5); // the header and four rows
  });

  it("says when 0 was expected there is no percentage, rather than dividing by zero", () => {
    const html = renderToStaticMarkup(<ComparisonTable closeWithinPercent={20} rows={[row({ expected: 0, unit: "cars", actual: 3, delta: 3, deltaPercent: null, verdict: "above" })]} />);
    expect(html).toContain("+3 cars (no percentage: 0 was expected)");
  });

  it("says there is nothing to compare when no expectations were set", () => {
    const html = renderToStaticMarkup(<ComparisonTable closeWithinPercent={20} rows={[]} />);
    expect(html).toContain("nothing to compare");
    expect(html).not.toContain("<table");
  });

  it("labels each cell, so a phone can show a row as a card", () => {
    const html = renderToStaticMarkup(<ComparisonTable closeWithinPercent={20} rows={[row()]} />);
    for (const label of ["What you measured", "You expected", "What happened", "Difference", "How it came out"]) expect(html).toContain(`data-label="${label}"`);
  });
});

describe("the audit trail", () => {
  const events: Decision["events"] = [
    { at: "2030-05-01T09:00:00.000Z", byUserId: "u1", byName: "Olivia Owner", action: "created" },
    { at: "2030-05-02T09:00:00.000Z", byUserId: "pilot", byName: "Pilot", action: "recommendation", note: "Pilot gave a recommendation" },
    { at: "2030-05-03T09:00:00.000Z", byUserId: "u1", byName: "Olivia Owner", action: "decided", note: "Boss overrode Pilot's recommendation. Pilot recommended option B; Boss chose option A." },
  ];

  it("is folded away until asked for, and says how many events it holds", () => {
    const html = renderToStaticMarkup(<AuditTrail events={events} />);
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain("Audit trail (3 events)");
    expect(renderToStaticMarkup(<AuditTrail events={events.slice(0, 1)} />)).toContain("Audit trail (1 event)");
  });

  it("lists the events oldest first, saying who did what and when, with the override in words", () => {
    const html = renderToStaticMarkup(<AuditTrail events={events} />);
    const at = (text: string) => html.indexOf(text);
    expect(at("Decision written down")).toBeGreaterThan(-1);
    expect(at("Decision written down")).toBeLessThan(at("Pilot gave a recommendation</strong>"));
    expect(at("Pilot gave a recommendation</strong>")).toBeLessThan(at("Boss decided"));
    expect(html).toContain("1 May 2030, 10:00 by Olivia Owner"); // 09:00 UTC is 10:00 in UK summer time
    expect(html).toContain("Boss overrode Pilot&#x27;s recommendation.");
  });

  it("draws names and notes as plain text, never as markup", () => {
    const html = renderToStaticMarkup(<AuditTrail events={[{ at: "2030-05-01T09:00:00.000Z", byUserId: "u", byName: "<img src=x onerror=alert(1)>", action: "edited", note: "<script>x</script>" }]} />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
  });
});

describe("one decision, start to finish", () => {
  const detailFor = (d: Decision, state: DecisionState, comparison: ExpectationResult[] | null = null): DecisionDetail => ({ decision: d, state, comparison, closeWithinPercent: 20 });
  const render = (detail: DecisionDetail) =>
    renderToStaticMarkup(<DecisionDetailView detail={detail} nowMs={NOW} onDetail={noop} onPanelChange={noop} onRefresh={noop} onBack={noop} />);

  it("shows the question, its background and its options, and always mounts Pilot's view and the simulator with the decision", () => {
    const d = decision();
    const html = render(detailFor(d, "open"));
    expect(html).toContain("Buy another £50k of SUVs?");
    expect(html).toContain("Enquiries are up.");
    expect(html).toContain("All decisions");
    expect(html).toContain("analysis-panel:d-1");
    expect(html).toContain("simulator-panel:d-1");
    expect(html).toContain("Audit trail (1 event)");
  });

  it("while open: Boss's decision form, and the question and options can be edited when Pilot has not given a view", () => {
    const html = render(detailFor(decision(), "open"));
    expect(html).toContain("Which way are you going?");
    expect(html).toContain("Record my decision");
    expect(html).toContain("Edit the question and options");
    expect(html).not.toContain("What actually happened");
    expect(html).not.toContain("locked");
  });

  it("while open with a recommendation: says the options are locked and offers no edit", () => {
    const html = render(detailFor(decision({ pilotRecommendation: recommendation("b") }), "open"));
    expect(html).toContain("locked, because Pilot has given a recommendation");
    expect(html).not.toContain("Edit the question and options");
    expect(html).toContain("Pilot recommended"); // the option is marked
  });

  it("once decided: records Boss's choice and whether it followed Pilot, and asks what actually happened", () => {
    const d = decision({ pilotRecommendation: recommendation("b"), bossDecision: bossDecision("b"), reviewDueAt: iso(20), expectations });
    const html = render(detailFor(d, "decided"));
    expect(html).toContain("Option B: Add £50k");
    expect(html).toContain("Olivia Owner decided on");
    expect(html).toContain("You followed Pilot.");
    expect(html).toContain("Enquiries are up.");
    expect(html).toContain("Review in 20 days");
    expect(html).toContain("What you expected");
    expect(html).toContain("Extra profit: £5,000");
    expect(html).toContain("Record what happened");
    expect(html).not.toContain("Which way are you going?"); // it can no longer be decided
    expect(html).not.toContain("Record my decision");
    expect(html).not.toContain("Edit the question and options");
    expect(count(html, "Your choice</span>")).toBe(1);
  });

  it("says plainly when Boss went against Pilot, and that it is recorded not argued with", () => {
    const d = decision({ pilotRecommendation: recommendation("b"), bossDecision: bossDecision("a"), reviewDueAt: iso(20) });
    const html = render(detailFor(d, "decided"));
    expect(html).toContain("You went against Pilot. That is recorded, not argued with.");
    expect(html).not.toContain("You followed Pilot");
  });

  it("when the review is due: says how overdue it is and still asks what happened", () => {
    const d = decision({ bossDecision: bossDecision("b"), reviewDueAt: iso(-3), expectations });
    const html = render(detailFor(d, "review_due"));
    expect(html).toContain("Review was due 3 days ago");
    expect(html).toContain("Record what happened");
  });

  it("once reviewed: the comparison, the notes and the lessons, and no form left to fill in", () => {
    const d = decision({
      bossDecision: bossDecision("b"),
      reviewDueAt: iso(-10),
      expectations,
      outcome: { recordedAt: iso(-2), recordedByUserId: "u1", recordedByName: "Olivia Owner", actuals: [], notes: "Slower than hoped.", lessons: { ...lessons, lesson: "Buy in March" } },
    });
    const html = render(detailFor(d, "reviewed", [row(), row({ expectationId: "e1", metric: "Cars sold", unit: "cars", expected: 4, actual: null, delta: null, deltaPercent: null, verdict: "unknown" })]));
    expect(html).toContain("What actually happened");
    expect(html).toContain("Recorded by Olivia Owner");
    expect(html).toContain("Slower than hoped.");
    expect(html).toContain("The lesson for next time:");
    expect(html).toContain("Buy in March");
    expect(html).not.toContain("What Pilot got right:"); // lessons left empty are not shown
    expect(html).toContain("Close");
    expect(html).toContain("Unknown");
    expect(html).not.toContain("Record what happened");
    expect(html).not.toContain("Record my decision");
    expect(html).not.toContain("Review in");
  });

  it("shows what Boss chose for Other in Boss's own words", () => {
    const d = decision({ bossDecision: { ...bossDecision("other"), otherText: "Wait a month and look again" }, reviewDueAt: iso(20) });
    const html = render(detailFor(d, "decided"));
    expect(html).toContain("Other: Wait a month and look again");
  });
});
