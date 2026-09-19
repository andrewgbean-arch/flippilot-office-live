// Where decisions are kept: one tenant collection, read and rewritten whole.
//
// Every write here is read -> change -> write with NO await in between (the
// database calls are synchronous), so two people saving at the same moment can
// never overwrite each other's change, the trap the account routes fell into.
// Keep it that way: do any slow work (a model call, a simulation) BEFORE calling
// createDecision or mutateDecision, never inside the function you pass in.

import { randomUUID } from "crypto";
import { readTenantCollection, writeTenantCollection, readTenantDoc, writeTenantDoc } from "./db";
import { toSingleLine, toMultiLine } from "./untrustedText";
import {
  CONTEXT_MAX,
  MAX_ANALYSES_PER_DAY,
  MAX_DECISIONS,
  MAX_OPTIONS,
  MIN_OPTIONS,
  OPTION_KEYS,
  OPTION_LABEL_MAX,
  OPTION_NOTE_MAX,
  QUESTION_MAX,
  type Decision,
  type DecisionAction,
  type DecisionOption,
} from "./decisionTypes";

const COLLECTION = "pilotBrainDecisions";
const USAGE_DOC = "pilotBrainDecisionUsage";

export interface Actor {
  id: string;
  name: string;
}

const isDecisionLike = (v: unknown): v is Decision =>
  typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string";

// Newest first.
export function listDecisions(dealershipId: string): Decision[] {
  return readTenantCollection<Decision>(dealershipId, COLLECTION)
    .filter(isDecisionLike)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getDecision(dealershipId: string, id: string): Decision | undefined {
  return listDecisions(dealershipId).find(d => d.id === id);
}

export interface DecisionDraft {
  question: string;
  context: string;
  options: DecisionOption[];
}

// Cleans and checks what Boss typed. Text is stored as typed apart from being
// flattened, capped and stripped of hidden characters (untrustedText).
export function validateDraft(input: unknown): { ok: true; draft: DecisionDraft } | { ok: false; error: string } {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

  const question = toSingleLine(body.question, QUESTION_MAX);
  if (!question) return { ok: false, error: "Please write the question you are deciding." };

  const context = toMultiLine(body.context, CONTEXT_MAX);

  if (!Array.isArray(body.options)) {
    return { ok: false, error: `Please give between ${MIN_OPTIONS} and ${MAX_OPTIONS} options.` };
  }
  const options: DecisionOption[] = [];
  for (const raw of body.options) {
    const r = (typeof raw === "string" ? { label: raw } : raw) as Record<string, unknown> | null;
    const label = toSingleLine(r?.label, OPTION_LABEL_MAX);
    if (!label) continue; // a blank option is just dropped
    const note = toSingleLine(r?.note, OPTION_NOTE_MAX);
    if (options.length >= MAX_OPTIONS) {
      return { ok: false, error: `Please give at most ${MAX_OPTIONS} options.` };
    }
    options.push({ key: OPTION_KEYS[options.length]!, label, ...(note ? { note } : {}) });
  }
  if (options.length < MIN_OPTIONS) {
    return { ok: false, error: `Please give at least ${MIN_OPTIONS} options: a decision needs something to choose between.` };
  }
  const labels = options.map(o => o.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return { ok: false, error: "Each option needs its own name." };
  }
  return { ok: true, draft: { question, context, options } };
}

export type StoreResult =
  | { ok: true; decision: Decision }
  | { ok: false; error: string; notFound?: boolean };

export function createDecision(
  dealershipId: string,
  draft: DecisionDraft,
  actor: Actor,
  nowIso: string = new Date().toISOString()
): StoreResult {
  const all = readTenantCollection<Decision>(dealershipId, COLLECTION).filter(isDecisionLike);
  if (all.length >= MAX_DECISIONS) {
    return { ok: false, error: `The journal is full (${MAX_DECISIONS} decisions). Ask support if you need more room.` };
  }
  const decision: Decision = {
    id: randomUUID(),
    question: draft.question,
    context: draft.context,
    options: draft.options,
    createdAt: nowIso,
    createdByUserId: actor.id,
    createdByName: actor.name,
    updatedAt: nowIso,
    simulations: [],
    expectations: [],
    events: [{ at: nowIso, byUserId: actor.id, byName: actor.name, action: "created" }],
  };
  writeTenantCollection(dealershipId, COLLECTION, [...all, decision]);
  return { ok: true, decision };
}

// Change one decision. `change` edits a COPY and returns nothing to accept, or a
// plain-English string to refuse (nothing is written then). Every accepted
// change stamps updatedAt and appends an event, so the record explains itself.
export function mutateDecision(
  dealershipId: string,
  id: string,
  actor: Actor,
  action: DecisionAction,
  change: (draft: Decision) => string | void,
  note?: string,
  nowIso: string = new Date().toISOString()
): StoreResult {
  const all = readTenantCollection<Decision>(dealershipId, COLLECTION).filter(isDecisionLike);
  const at = all.findIndex(d => d.id === id);
  if (at < 0) return { ok: false, error: "That decision wasn't found.", notFound: true };

  const draft: Decision = structuredClone(all[at]!);
  const problem = change(draft);
  if (typeof problem === "string") return { ok: false, error: problem };

  draft.updatedAt = nowIso;
  draft.events = [
    ...draft.events,
    { at: nowIso, byUserId: actor.id, byName: actor.name, action, ...(note ? { note } : {}) },
  ];
  const next = [...all];
  next[at] = draft;
  writeTenantCollection(dealershipId, COLLECTION, next);
  return { ok: true, decision: draft };
}

// ---- a daily cap on the calls that cost money (Pilot's view, Devil's Advocate) ----

interface UsageDoc {
  day: string;
  count: number;
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function takeAnalysisAllowance(
  dealershipId: string,
  nowMs: number,
  cap: number = MAX_ANALYSES_PER_DAY
): { ok: boolean; remaining: number } {
  const day = dayOf(nowMs);
  const doc = readTenantDoc<UsageDoc>(dealershipId, USAGE_DOC, { day, count: 0 });
  const used = doc.day === day ? doc.count : 0;
  if (used >= cap) return { ok: false, remaining: 0 };
  writeTenantDoc(dealershipId, USAGE_DOC, { day, count: used + 1 });
  return { ok: true, remaining: cap - used - 1 };
}

// For a call that failed before it cost anything: hand the allowance back.
export function returnAnalysisAllowance(dealershipId: string, nowMs: number): void {
  const day = dayOf(nowMs);
  const doc = readTenantDoc<UsageDoc>(dealershipId, USAGE_DOC, { day, count: 0 });
  if (doc.day === day && doc.count > 0) writeTenantDoc(dealershipId, USAGE_DOC, { day, count: doc.count - 1 });
}
