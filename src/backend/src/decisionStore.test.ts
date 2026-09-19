import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { writeTenantCollection } from "./db";
import {
  parseConfidence,
  decisionState,
  MAX_DECISIONS,
  MAX_OPTIONS,
  MAX_ANALYSES_PER_DAY,
  QUESTION_MAX,
  type Decision,
} from "./decisionTypes";
import {
  validateDraft,
  createDecision,
  listDecisions,
  getDecision,
  mutateDecision,
  takeAnalysisAllowance,
  returnAnalysisAllowance,
} from "./decisionStore";

const newDealer = () => `decisions-test-${crypto.randomUUID()}`;
const actor = { id: "u1", name: "Olivia Owner" };
const good = { question: "Buy another £50k of SUVs?", context: "Enquiries are up.", options: ["No change", "Add £50k", "Add £25k"] };

function draftOf(input: unknown) {
  const v = validateDraft(input);
  if (!v.ok) throw new Error("draft should be valid: " + v.error);
  return v.draft;
}

describe("confidence is low, medium or high: never a percentage (roadmap rule 04)", () => {
  it("accepts only the three words, in any case", () => {
    expect(parseConfidence("low")).toBe("low");
    expect(parseConfidence(" Medium ")).toBe("medium");
    expect(parseConfidence("HIGH")).toBe("high");
  });

  it("refuses anything that looks like a probability or a made-up level", () => {
    for (const v of ["82%", 82, 0.9, "0.9", "very high", "certain", "", null, undefined, {}, ["high"]]) {
      expect(parseConfidence(v), String(v)).toBeNull();
    }
  });
});

describe("a decision only moves forward: open, decided, then reviewed", () => {
  const now = Date.parse("2030-06-01T12:00:00Z");
  it("is open until Boss decides", () => {
    expect(decisionState({ bossDecision: undefined, outcome: undefined, reviewDueAt: undefined }, now)).toBe("open");
  });
  it("is decided, then review-due once the review date has passed", () => {
    const boss = { optionKey: "a", reasoning: "", decidedAt: "2030-01-01T00:00:00Z", decidedByUserId: "u1", decidedByName: "O" };
    expect(decisionState({ bossDecision: boss, outcome: undefined, reviewDueAt: "2030-07-01T00:00:00Z" }, now)).toBe("decided");
    expect(decisionState({ bossDecision: boss, outcome: undefined, reviewDueAt: "2030-05-01T00:00:00Z" }, now)).toBe("review_due");
  });
  it("is reviewed once an outcome is recorded, whatever else is true", () => {
    const outcome = { recordedAt: "x", recordedByUserId: "u", recordedByName: "n", actuals: [], notes: "", lessons: { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" } };
    expect(decisionState({ bossDecision: undefined, outcome, reviewDueAt: undefined }, now)).toBe("reviewed");
  });
});

describe("validating what Boss types", () => {
  it("accepts a question with two or more options and gives them keys a, b, c in order", () => {
    const v = validateDraft(good);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.draft.options.map(o => `${o.key}:${o.label}`)).toEqual(["a:No change", "b:Add £50k", "c:Add £25k"]);
  });

  it("needs a question", () => {
    expect(validateDraft({ ...good, question: "   " }).ok).toBe(false);
    expect(validateDraft({ ...good, question: undefined }).ok).toBe(false);
  });

  it("needs at least two real options, and drops blank ones rather than counting them", () => {
    expect(validateDraft({ ...good, options: ["Only one"] }).ok).toBe(false);
    expect(validateDraft({ ...good, options: ["One", "  ", ""] }).ok).toBe(false);
    expect(validateDraft({ ...good, options: ["One", "  ", "Two"] }).ok).toBe(true);
    expect(validateDraft({ ...good, options: "not a list" }).ok).toBe(false);
  });

  it("refuses more than six options and duplicate names", () => {
    expect(validateDraft({ ...good, options: Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => `Option ${i}`) }).ok).toBe(false);
    const dup = validateDraft({ ...good, options: ["Same", "same"] });
    expect(dup.ok).toBe(false);
  });

  it("accepts options given as {label, note} objects too", () => {
    const v = validateDraft({ ...good, options: [{ label: "Hold", note: "wait a month" }, { label: "Buy" }] });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.draft.options[0]).toEqual({ key: "a", label: "Hold", note: "wait a month" });
  });

  it("flattens the question to one line, caps it, and removes hidden characters", () => {
    const hidden = String.fromCodePoint(0xe0041); // a Unicode Tags character: invisible text
    const v = validateDraft({ ...good, question: `Line one\nline two${hidden} ` + "x".repeat(400) });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.draft.question).not.toMatch(/[\n\r]/);
      expect(v.draft.question).not.toContain(hidden);
      expect(Array.from(v.draft.question).length).toBeLessThanOrEqual(QUESTION_MAX);
    }
  });
});

describe("the journal store", () => {
  it("creates a decision with an id, a created event and no decision yet", () => {
    const dealer = newDealer();
    const made = createDecision(dealer, draftOf(good), actor, "2030-01-01T09:00:00.000Z");
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const d = made.decision;
    expect(d.id).toMatch(/[0-9a-f-]{36}/);
    expect(d.simulations).toEqual([]);
    expect(d.bossDecision).toBeUndefined();
    expect(d.events).toEqual([{ at: "2030-01-01T09:00:00.000Z", byUserId: "u1", byName: "Olivia Owner", action: "created" }]);
    expect(getDecision(dealer, d.id)?.question).toBe(good.question);
  });

  it("lists newest first, and only this dealership's decisions", () => {
    const a = newDealer();
    const b = newDealer();
    createDecision(a, draftOf({ ...good, question: "older" }), actor, "2030-01-01T00:00:00.000Z");
    createDecision(a, draftOf({ ...good, question: "newer" }), actor, "2030-02-01T00:00:00.000Z");
    createDecision(b, draftOf({ ...good, question: "somebody else's" }), actor, "2030-03-01T00:00:00.000Z");
    expect(listDecisions(a).map(d => d.question)).toEqual(["newer", "older"]);
    expect(listDecisions(b).map(d => d.question)).toEqual(["somebody else's"]);
  });

  it("refuses to grow past the limit", () => {
    const dealer = newDealer();
    writeTenantCollection(dealer, "pilotBrainDecisions", Array.from({ length: MAX_DECISIONS }, (_, i) => ({ id: `d${i}`, createdAt: "2030-01-01T00:00:00Z" })));
    const made = createDecision(dealer, draftOf(good), actor);
    expect(made.ok).toBe(false);
    expect(listDecisions(dealer)).toHaveLength(MAX_DECISIONS);
  });

  it("applies a change, stamps updatedAt and adds an event saying who did what", () => {
    const dealer = newDealer();
    const made = createDecision(dealer, draftOf(good), actor, "2030-01-01T09:00:00.000Z");
    if (!made.ok) throw new Error("setup");
    const other = { id: "u2", name: "Mo Manager" };
    const changed = mutateDecision(dealer, made.decision.id, other, "edited", d => { d.context = "New context."; }, "context edited", "2030-01-02T10:00:00.000Z");
    expect(changed.ok).toBe(true);
    const stored = getDecision(dealer, made.decision.id)!;
    expect(stored.context).toBe("New context.");
    expect(stored.updatedAt).toBe("2030-01-02T10:00:00.000Z");
    expect(stored.events.at(-1)).toEqual({ at: "2030-01-02T10:00:00.000Z", byUserId: "u2", byName: "Mo Manager", action: "edited", note: "context edited" });
    expect(stored.events).toHaveLength(2);
  });

  it("writes NOTHING when the change refuses, and says why", () => {
    const dealer = newDealer();
    const made = createDecision(dealer, draftOf(good), actor);
    if (!made.ok) throw new Error("setup");
    const before = JSON.stringify(getDecision(dealer, made.decision.id));
    const refused = mutateDecision(dealer, made.decision.id, actor, "decided", d => { d.context = "should not be kept"; return "Not allowed just now."; });
    expect(refused).toEqual({ ok: false, error: "Not allowed just now." });
    expect(JSON.stringify(getDecision(dealer, made.decision.id))).toBe(before);
  });

  it("says a missing decision was not found, and does not touch other dealerships' decisions", () => {
    const a = newDealer();
    const b = newDealer();
    const made = createDecision(a, draftOf(good), actor);
    if (!made.ok) throw new Error("setup");
    const r = mutateDecision(b, made.decision.id, actor, "edited", d => { d.context = "hijacked"; });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.notFound).toBe(true);
    expect(getDecision(a, made.decision.id)!.context).toBe(good.context);
  });

  it("keeps two changes made one after the other (nothing is lost between them)", () => {
    const dealer = newDealer();
    const made = createDecision(dealer, draftOf(good), actor);
    if (!made.ok) throw new Error("setup");
    mutateDecision(dealer, made.decision.id, actor, "edited", d => { d.context = "first"; });
    mutateDecision(dealer, made.decision.id, actor, "edited", d => { d.question = "second"; });
    const d = getDecision(dealer, made.decision.id)!;
    expect(d.context).toBe("first");
    expect(d.question).toBe("second");
    expect(d.events.filter(e => e.action === "edited")).toHaveLength(2);
  });
});

describe("the daily cap on calls that cost money", () => {
  const noon = Date.parse("2030-06-01T12:00:00Z");

  it("allows the daily number of calls and then says no", () => {
    const dealer = newDealer();
    for (let i = 0; i < MAX_ANALYSES_PER_DAY; i++) expect(takeAnalysisAllowance(dealer, noon).ok).toBe(true);
    expect(takeAnalysisAllowance(dealer, noon)).toEqual({ ok: false, remaining: 0 });
  });

  it("starts again the next day", () => {
    const dealer = newDealer();
    for (let i = 0; i < MAX_ANALYSES_PER_DAY; i++) takeAnalysisAllowance(dealer, noon);
    expect(takeAnalysisAllowance(dealer, noon + 24 * 3600 * 1000).ok).toBe(true);
  });

  it("gives an allowance back when a call failed before it cost anything", () => {
    const dealer = newDealer();
    for (let i = 0; i < MAX_ANALYSES_PER_DAY; i++) takeAnalysisAllowance(dealer, noon);
    returnAnalysisAllowance(dealer, noon);
    expect(takeAnalysisAllowance(dealer, noon).ok).toBe(true);
    expect(takeAnalysisAllowance(dealer, noon).ok).toBe(false);
  });

  it("counts each dealership separately", () => {
    const a = newDealer();
    for (let i = 0; i < MAX_ANALYSES_PER_DAY; i++) takeAnalysisAllowance(a, noon);
    expect(takeAnalysisAllowance(newDealer(), noon).ok).toBe(true);
  });
});

describe("the web app's copy of the types stays in step with this one", () => {
  const backend = fs.readFileSync(path.resolve(__dirname, "decisionTypes.ts"), "utf8");
  const web = fs.readFileSync(path.resolve(__dirname, "..", "..", "lib", "decisionTypes.ts"), "utf8");
  const consts = (src: string) => Object.fromEntries([...src.matchAll(/^export const ([A-Z_]+) = (\d+);/gm)].map(m => [m[1]!, m[2]!]));
  const line = (src: string, start: string) => src.split(/\r?\n/).find(l => l.startsWith(start));

  it("has the same limits", () => {
    expect(Object.keys(consts(backend)).length).toBeGreaterThan(8);
    expect(consts(web)).toEqual(consts(backend));
  });

  it("has the same confidence levels, figure kinds and option keys", () => {
    for (const start of [
      'export type Confidence =',
      'export const CONFIDENCE_LEVELS',
      'export type FigureKind =',
      'export const FIGURE_KINDS',
      'export type FigureUnit =',
      'export type SimulationKind =',
      'export type DecisionAction =',
      'export const OPTION_KEYS',
    ]) {
      expect(line(web, start), start).toBeDefined();
      expect(line(web, start), start).toBe(line(backend, start));
    }
  });

  it("has the same fields on the Decision record itself", () => {
    const fields = (src: string) => (src.match(/export interface Decision \{([\s\S]*?)\n\}/)?.[1] ?? "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    expect(fields(web).length).toBeGreaterThan(10);
    expect(fields(web)).toEqual(fields(backend));
  });
});
