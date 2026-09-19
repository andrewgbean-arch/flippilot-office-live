// What Boss types into the Decision Journal, checked and turned into changes
// (Pilot Brain V8). No database and no clock in here: the routes read a
// decision, ask these functions "may this change be made, and what is it?", and
// then make it through mutateDecision.
//
// The rules that live here (and are proven by the tests):
//  - A decision only moves forward: open -> decided -> reviewed. A decided
//    decision is never rewritten; what happened is recorded ALONGSIDE it.
//  - The question and options can only be edited while the decision is still
//    open AND Pilot has given no recommendation (a recommendation points at an
//    option by its letter, so changing the options would change what it means).
//  - Boss can go against Pilot's recommendation: that is recorded plainly in the
//    audit trail as an override, not argued with (roadmap rules 12 and 13).
//  - Text typed by people is DATA: every piece of it is cleaned and capped with
//    the same cleaners the store uses (untrustedText).

import { randomUUID } from "crypto";
import { validateDraft, type Actor } from "../decisionStore";
import { toMultiLine, toSingleLine } from "../untrustedText";
import {
  DEFAULT_REVIEW_DAYS,
  LESSON_MAX,
  MAX_EXPECTATIONS,
  OPTION_KEYS,
  OPTION_LABEL_MAX,
  OPTION_NOTE_MAX,
  REASONING_MAX,
  type ActualResult,
  type Decision,
  type Expectation,
  type FigureUnit,
  type Outcome,
} from "../decisionTypes";

// The limits below are repeated in the web app (src/pilotbrain/decisions/decisionFormat.ts,
// which a test here keeps in step), so the form can say what the server will accept.
export const HORIZON_DAYS_MIN = 1;
export const HORIZON_DAYS_MAX = 730;
export const REVIEW_DAYS_MIN = 7;
export const REVIEW_DAYS_MAX = 365;
// A sanity ceiling on any figure Boss types, so nonsense cannot be stored.
export const MAX_FIGURE_SIZE = 1000000000000;

// Written as a table so that adding a unit to FigureUnit fails to compile until
// it is added here too.
const UNIT_TABLE: Record<FigureUnit, true> = { gbp: true, cars: true, days: true, months: true, percent: true, count: true };
export const FIGURE_UNITS = Object.keys(UNIT_TABLE) as FigureUnit[];

const DAY_MS = 86_400_000;

type Bad = { ok: false; error: string };
export type Parsed<T> = { ok: true; value: T } | Bad;
const bad = (error: string): Bad => ({ ok: false, error });
const good = <T>(value: T): Parsed<T> => ({ ok: true, value });

const asObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// ---- deciding ----

export interface DecideInput {
  optionKey: string; // "a".."f", or "other"
  otherText: string; // what Boss is doing instead; "" unless optionKey is "other"
  reasoning: string;
  expectations: Array<Omit<Expectation, "id">>;
  reviewInDays: number;
}

export function parseDecideInput(input: unknown): Parsed<DecideInput> {
  const body = asObject(input) ?? {};

  const optionKey = typeof body.optionKey === "string" ? body.optionKey.trim().toLowerCase() : "";
  if (optionKey !== "other" && !(OPTION_KEYS as readonly string[]).includes(optionKey)) {
    return bad("Please choose one of the options, or Other.");
  }
  let otherText = "";
  if (optionKey === "other") {
    otherText = toSingleLine(body.otherText, OPTION_NOTE_MAX);
    if (!otherText) return bad("You chose Other, so please say in a few words what you are doing instead.");
  }

  const reasoning = toMultiLine(body.reasoning, REASONING_MAX);

  let reviewInDays = DEFAULT_REVIEW_DAYS;
  if (body.reviewInDays !== undefined && body.reviewInDays !== null) {
    const days = body.reviewInDays;
    if (!isNumber(days) || !Number.isInteger(days) || days < REVIEW_DAYS_MIN || days > REVIEW_DAYS_MAX) {
      return bad(`Please choose a review date between ${REVIEW_DAYS_MIN} and ${REVIEW_DAYS_MAX} days away.`);
    }
    reviewInDays = days;
  }

  const rawExpectations = body.expectations === undefined || body.expectations === null ? [] : body.expectations;
  if (!Array.isArray(rawExpectations)) return bad("Expectations must be a list.");
  if (rawExpectations.length > MAX_EXPECTATIONS) return bad(`Please give at most ${MAX_EXPECTATIONS} expectations.`);
  const expectations: DecideInput["expectations"] = [];
  for (let i = 0; i < rawExpectations.length; i++) {
    const row = parseExpectation(rawExpectations[i], i + 1);
    if (!row.ok) return row;
    expectations.push(row.value);
  }

  return good({ optionKey, otherText, reasoning, expectations, reviewInDays });
}

function parseExpectation(raw: unknown, n: number): Parsed<Omit<Expectation, "id">> {
  const r = asObject(raw);
  if (!r) return bad(`Expectation ${n}: please fill it in.`);
  const metric = toSingleLine(r.metric, OPTION_LABEL_MAX);
  if (!metric) return bad(`Expectation ${n}: please say what you are measuring.`);
  if (typeof r.unit !== "string" || !(FIGURE_UNITS as readonly string[]).includes(r.unit)) {
    return bad(`Expectation ${n} (${metric}): please choose what it is measured in.`);
  }
  if (!isNumber(r.expected) || Math.abs(r.expected) > MAX_FIGURE_SIZE) {
    return bad(`Expectation ${n} (${metric}): please give the number you expect.`);
  }
  const days = r.horizonDays;
  if (!isNumber(days) || !Number.isInteger(days) || days < HORIZON_DAYS_MIN || days > HORIZON_DAYS_MAX) {
    return bad(`Expectation ${n} (${metric}): please say in how many days (${HORIZON_DAYS_MIN} to ${HORIZON_DAYS_MAX}) you expect it.`);
  }
  return good({
    metric,
    unit: r.unit as FigureUnit,
    expected: r.expected,
    horizonDays: days,
    basis: toSingleLine(r.basis, OPTION_NOTE_MAX),
  });
}

// ---- recording what happened ----

export interface OutcomeInput {
  actuals: Array<{ expectationId: string; actual: number | null; note: string }>;
  notes: string;
  lessons: Outcome["lessons"];
}

export function parseOutcomeInput(input: unknown): Parsed<OutcomeInput> {
  const body = asObject(input) ?? {};

  const rawActuals = body.actuals === undefined || body.actuals === null ? [] : body.actuals;
  if (!Array.isArray(rawActuals)) return bad("Results must be a list.");
  if (rawActuals.length > MAX_EXPECTATIONS) return bad(`There can be at most ${MAX_EXPECTATIONS} results.`);
  const actuals: OutcomeInput["actuals"] = [];
  for (let i = 0; i < rawActuals.length; i++) {
    const r = asObject(rawActuals[i]);
    if (!r || typeof r.expectationId !== "string" || !r.expectationId) {
      return bad(`Result ${i + 1}: it needs to say which expectation it is for.`);
    }
    // A missing or null actual is "not known". It is never treated as 0.
    if (r.actual !== undefined && r.actual !== null && (!isNumber(r.actual) || Math.abs(r.actual) > MAX_FIGURE_SIZE)) {
      return bad(`Result ${i + 1}: please give a number, or leave it as not known.`);
    }
    actuals.push({
      expectationId: r.expectationId,
      actual: isNumber(r.actual) ? r.actual : null,
      note: toSingleLine(r.note, LESSON_MAX),
    });
  }

  const l = asObject(body.lessons) ?? {};
  const lessons: Outcome["lessons"] = {
    pilotRight: toMultiLine(l.pilotRight, LESSON_MAX),
    pilotWrong: toMultiLine(l.pilotWrong, LESSON_MAX),
    bossRight: toMultiLine(l.bossRight, LESSON_MAX),
    unexpected: toMultiLine(l.unexpected, LESSON_MAX),
    lesson: toMultiLine(l.lesson, LESSON_MAX),
  };

  return good({ actuals, notes: toMultiLine(body.notes, REASONING_MAX), lessons });
}

// Every expectation gets a result. One Boss left out counts as not known; a
// result that names something that was never expected, or names one twice, is
// refused (it would otherwise be silently dropped or double-counted).
export function matchActuals(expectations: Expectation[], given: OutcomeInput["actuals"]): Parsed<ActualResult[]> {
  const byId = new Map<string, OutcomeInput["actuals"][number]>();
  for (const g of given) {
    if (!expectations.some(e => e.id === g.expectationId)) {
      return bad("One of the results doesn't match anything you expected when you decided.");
    }
    if (byId.has(g.expectationId)) return bad("Each expectation can only have one result.");
    byId.set(g.expectationId, g);
  }
  return good(
    expectations.map(e => {
      const g = byId.get(e.id);
      return { expectationId: e.id, actual: g?.actual ?? null, ...(g?.note ? { note: g.note } : {}) };
    })
  );
}

// ---- plans: may this change be made, and what is it? ----

// A refusal says why in plain English and which kind it is: 400 (what was sent is
// wrong) or 409 (it is right, but the decision is not in a state to accept it).
// A plan that is ok is either a change to make (apply, with the note that goes
// in the audit trail) or noChange, when there is nothing to do.
export type Plan =
  | { ok: true; noChange: boolean; note?: string; apply: (draft: Decision) => void }
  | { ok: false; status: 400 | 409; error: string };

const refuse = (status: 400 | 409, error: string): Plan => ({ ok: false, status, error });

const NO_CHANGE: Plan = { ok: true, noChange: true, apply: () => undefined };

const joinWords = (words: string[]): string =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

const sameOptions = (a: Decision["options"], b: Decision["options"]): boolean =>
  a.length === b.length && a.every((o, i) => o.key === b[i]?.key && o.label === b[i]?.label && (o.note ?? "") === (b[i]?.note ?? ""));

export function planEdit(d: Decision, input: unknown): Plan {
  if (d.bossDecision) {
    return refuse(409, "This decision has already been made, so its question and options can't be changed.");
  }
  if (d.pilotRecommendation) {
    return refuse(
      409,
      "Pilot has already given a view on these options. Changing them now would change what that view refers to, so they are locked. Start a new decision if you want different options."
    );
  }
  const body = asObject(input) ?? {};
  if (body.question === undefined && body.context === undefined && body.options === undefined) {
    return refuse(400, "There is nothing to change: send a new question, context or options.");
  }

  // Whatever was not sent stays as it is.
  const v = validateDraft({
    question: body.question !== undefined ? body.question : d.question,
    context: body.context !== undefined ? body.context : d.context,
    options: body.options !== undefined ? body.options : d.options,
  });
  if (!v.ok) return refuse(400, v.error);

  const changed: string[] = [];
  if (v.draft.question !== d.question) changed.push("question");
  if (v.draft.context !== d.context) changed.push("context");
  if (!sameOptions(v.draft.options, d.options)) changed.push("options");
  if (changed.length === 0) return NO_CHANGE;

  return {
    ok: true,
    noChange: false,
    note: `Edited the ${joinWords(changed)}.`,
    apply: draft => {
      draft.question = v.draft.question;
      draft.context = v.draft.context;
      draft.options = v.draft.options;
    },
  };
}

const optionText = (d: Pick<Decision, "options">, key: string): string => {
  const label = d.options.find(o => o.key === key)?.label;
  return label ? `option ${key.toUpperCase()}, "${label}"` : `option ${key.toUpperCase()}`;
};

// The sentence that goes in the audit trail when Boss decides. It says plainly
// whether Boss followed Pilot or went against Pilot, or that there was no
// recommendation to follow.
export function decidedNote(d: Pick<Decision, "options" | "pilotRecommendation">, input: Pick<DecideInput, "optionKey">): string {
  const chose = input.optionKey === "other" ? "something else (written in the decision)" : optionText(d, input.optionKey);
  const rec = d.pilotRecommendation;
  if (!rec) return `Boss decided without a recommendation from Pilot: chose ${chose}.`;
  if (rec.optionKey === input.optionKey) return `Boss followed Pilot's recommendation: ${chose}.`;
  return `Boss overrode Pilot's recommendation. Pilot recommended ${optionText(d, rec.optionKey)}; Boss chose ${chose}.`;
}

export function planDecide(d: Decision, input: DecideInput, ctx: { actor: Actor; nowMs: number }): Plan {
  if (d.bossDecision) {
    return refuse(
      409,
      "This decision has already been made and can't be changed. Once there has been time to see how it went, record what actually happened instead."
    );
  }
  if (input.optionKey !== "other" && !d.options.some(o => o.key === input.optionKey)) {
    return refuse(400, "That isn't one of this decision's options.");
  }
  const decidedAt = new Date(ctx.nowMs).toISOString();
  const reviewDueAt = new Date(ctx.nowMs + input.reviewInDays * DAY_MS).toISOString();
  return {
    ok: true,
    noChange: false,
    note: decidedNote(d, input),
    apply: draft => {
      draft.bossDecision = {
        optionKey: input.optionKey,
        ...(input.optionKey === "other" ? { otherText: input.otherText } : {}),
        reasoning: input.reasoning,
        decidedAt,
        decidedByUserId: ctx.actor.id,
        decidedByName: ctx.actor.name,
      };
      draft.expectations = input.expectations.map(e => ({ id: randomUUID(), ...e }));
      draft.reviewDueAt = reviewDueAt;
    },
  };
}

export function planOutcome(d: Decision, input: OutcomeInput, ctx: { actor: Actor; nowMs: number }): Plan {
  if (!d.bossDecision) {
    return refuse(409, "This decision hasn't been made yet, so there is nothing to review. Record your decision first.");
  }
  if (d.outcome) {
    return refuse(409, "What happened has already been recorded for this decision, and it can't be changed.");
  }
  const matched = matchActuals(d.expectations, input.actuals);
  if (!matched.ok) return refuse(400, matched.error);

  const known = matched.value.filter(a => a.actual !== null).length;
  const note =
    d.expectations.length === 0
      ? "Recorded what happened. No expectations had been set."
      : `Recorded what happened: ${known} of ${d.expectations.length} results known.`;
  const recordedAt = new Date(ctx.nowMs).toISOString();
  return {
    ok: true,
    noChange: false,
    note,
    apply: draft => {
      draft.outcome = {
        recordedAt,
        recordedByUserId: ctx.actor.id,
        recordedByName: ctx.actor.name,
        actuals: matched.value,
        notes: input.notes,
        lessons: input.lessons,
      };
    },
  };
}
