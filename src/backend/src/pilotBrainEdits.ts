// Editing, the safe way: Pilot Brain (Wendy) can PREPARE a small change; it
// never makes one. A prepared change sits in Operations until an owner or
// manager approves it (and can reject or undo it). The model only ever names
// a record, a field and a new value; everything else is decided here.
//
// What keeps this safe:
//  - Only owners and managers are offered the tool, the same people who can
//    approve. Approving stays with the existing owner/manager-only route.
//  - A fixed, tiny list of things that can be edited (below), each validated:
//    a car's asking price, a lead's status, a job's status, priority and due
//    date. Nothing else can be named, whatever the model says.
//  - The current value is captured HERE, from the stored record, not taken
//    from the model. Approving or undoing refuses to overwrite a value that
//    someone has changed since, rather than clobbering their work.
//  - Caps: a few per message, and a ceiling on how many can sit waiting, so a
//    confused or manipulated model can't bury Operations in proposals.
//  - What goes back to the model never includes a customer's name.

import type { AuthUser } from "./auth";
import { oneLine } from "./engines/promptText";
import { formatMoney } from "./engines/vehicleMargins";

export type EditKind = "vehicle" | "lead" | "job";
export type EditValue = string | number | null;

type Rec = Record<string, unknown>;

interface FieldRule {
  label: string;
  // Turns the model's value into the stored form, or says why it can't.
  parse: (raw: unknown) => { ok: true; value: string | number } | { ok: false; error: string };
  show: (v: EditValue) => string;
}

const oneOf = (allowed: string[]): FieldRule["parse"] => raw => {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return allowed.includes(v) ? { ok: true, value: v } : { ok: false, error: `Must be one of: ${allowed.join(", ")}.` };
};

const plain = (v: EditValue) => (v === null ? "not set" : String(v));

export const MAX_PRICE = 1_000_000;

const PRICE: FieldRule = {
  label: "asking price",
  parse: raw => {
    const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw.replace(/[£,\s]/g, "")) : NaN;
    if (!Number.isFinite(n) || n <= 0 || n > MAX_PRICE) return { ok: false, error: `Must be a price above £0 and up to £${MAX_PRICE.toLocaleString("en-GB")}.` };
    return { ok: true, value: Math.round(n * 100) / 100 };
  },
  show: v => (typeof v === "number" ? formatMoney(v) : plain(v)),
};

const validDay = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

interface KindRule {
  collection: string;
  fields: Record<string, FieldRule>;
}

export const EDITABLE: Record<EditKind, KindRule> = {
  vehicle: { collection: "vehicles", fields: { priceRetail: PRICE } },
  lead: {
    collection: "leads",
    fields: { status: { label: "status", parse: oneOf(["new", "contacted", "viewing_booked", "test_drive", "negotiating", "won", "lost"]), show: plain } },
  },
  job: {
    collection: "jobs",
    fields: {
      status: { label: "status", parse: oneOf(["todo", "in_progress", "done"]), show: plain },
      priority: { label: "priority", parse: oneOf(["low", "medium", "high"]), show: plain },
      dueDate: {
        label: "due date",
        parse: raw => (typeof raw === "string" && validDay(raw.trim()) ? { ok: true, value: raw.trim() } : { ok: false, error: "Must be a real date written YYYY-MM-DD." }),
        show: plain,
      },
    },
  },
};

export const MAX_EDITS_PER_MESSAGE = 3;
export const MAX_PENDING_EDITS = 20;
export const EDIT_ACTION_TYPE = "record_update";

export interface RecordUpdatePayload {
  kind: EditKind;
  recordId: string;
  recordLabel: string;
  field: string;
  fieldLabel: string;
  previousValue: EditValue;
  newValue: EditValue;
}

export interface NewPreparedAction {
  id: string;
  type: typeof EDIT_ACTION_TYPE;
  status: "prepared";
  title: string;
  description: string;
  reason: string;
  payload: RecordUpdatePayload;
  preparedAt: string;
}

// The same rule the approve route applies: owners and managers.
export function canPrepareEdits(user: AuthUser): boolean {
  return user.role === "owner" || user.staffRole === "manager";
}

// ---- preparing ----

export interface EditDeps {
  find(kind: EditKind, id: string): Rec | undefined;
  actions(): { type?: unknown; status?: unknown; payload?: unknown }[];
  addAction(action: NewPreparedAction): void;
  now(): number;
  newId(): string;
}

const asRec = (v: unknown): Rec | undefined => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : undefined);
const norm = (v: unknown): EditValue => (typeof v === "string" || typeof v === "number" ? v : null);

function labels(kind: EditKind, rec: Rec, id: string): { human: string; forModel: string } {
  if (kind === "vehicle") {
    const year = typeof rec.year === "number" ? String(rec.year) : "";
    const name = [year, oneLine(rec.make, 30), oneLine(rec.model, 30)].filter(Boolean).join(" ");
    const reg = oneLine(rec.reg, 12);
    const label = `${name || "Vehicle"}${reg ? ` (${reg})` : ""}`;
    return { human: label, forModel: label };
  }
  if (kind === "lead") {
    // A lead's name is a customer's name: it goes on the Operations screen for
    // the manager, never back to the model.
    return { human: oneLine(rec.name, 40) || `Lead ${id.slice(0, 8)}`, forModel: `lead ${id.slice(0, 8)}` };
  }
  const title = oneLine(rec.title, 60) || `Job ${id.slice(0, 8)}`;
  return { human: title, forModel: `job "${title}"` };
}

export type PrepareResult = { ok: true; actionId: string; summary: string } | { ok: false; error: string };

export function prepareEdit(user: AuthUser, deps: EditDeps, input: Rec, alreadyPreparedThisMessage: number): PrepareResult {
  if (!canPrepareEdits(user)) {
    return { ok: false, error: "Only an owner or manager can have changes prepared. Tell them so; don't guess." };
  }
  if (alreadyPreparedThisMessage >= MAX_EDITS_PER_MESSAGE) {
    return { ok: false, error: `Already prepared ${MAX_EDITS_PER_MESSAGE} changes in this message. Tell them what's prepared and stop there.` };
  }

  const kind = typeof input.kind === "string" ? (input.kind as EditKind) : undefined;
  const rule = kind && Object.prototype.hasOwnProperty.call(EDITABLE, kind) ? EDITABLE[kind] : undefined;
  if (!kind || !rule) return { ok: false, error: `kind must be one of: ${Object.keys(EDITABLE).join(", ")}.` };

  const field = typeof input.field === "string" ? input.field : "";
  const fieldRule = Object.prototype.hasOwnProperty.call(rule.fields, field) ? rule.fields[field] : undefined;
  if (!fieldRule) return { ok: false, error: `For a ${kind}, you can only change: ${Object.keys(rule.fields).join(", ")}.` };

  const id = typeof input.id === "string" ? input.id.trim().slice(0, 100) : "";
  const record = id ? deps.find(kind, id) : undefined;
  if (!record) return { ok: false, error: `No ${kind} with that id. Use look_inside to get the real id first.` };

  const parsed = fieldRule.parse(input.value);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const reason = oneLine(input.reason, 200);
  if (reason.length < 8) return { ok: false, error: "Give a short, specific reason (what in the records supports this change)." };

  const previous = norm(record[field]);
  if (previous === parsed.value) return { ok: false, error: `That ${fieldRule.label} is already ${fieldRule.show(previous)}; nothing to change.` };

  const waiting = deps.actions().filter(a => a.type === EDIT_ACTION_TYPE && a.status === "prepared");
  const dup = waiting.find(a => {
    const p = asRec(a.payload);
    return p?.kind === kind && p?.recordId === id && p?.field === field;
  });
  if (dup) return { ok: false, error: `There's already a ${fieldRule.label} change for that ${kind} waiting for approval. It has to be approved or rejected first.` };
  if (waiting.length >= MAX_PENDING_EDITS) {
    return { ok: false, error: `There are already ${MAX_PENDING_EDITS} changes waiting for approval. Ask them to clear some in Operations first.` };
  }

  const { human, forModel } = labels(kind, record, id);
  const change = `${fieldRule.label} from ${fieldRule.show(previous)} to ${fieldRule.show(parsed.value)}`;
  const action: NewPreparedAction = {
    id: deps.newId(),
    type: EDIT_ACTION_TYPE,
    status: "prepared",
    title: `Change ${human}'s ${change}`,
    description: `Prepared from a chat with Pilot Brain by ${oneLine(user.name, 40) || "a team member"}. Nothing changes until you approve it.`,
    reason,
    payload: { kind, recordId: id, recordLabel: human, field, fieldLabel: fieldRule.label, previousValue: previous, newValue: parsed.value },
    preparedAt: new Date(deps.now()).toISOString(),
  };
  deps.addAction(action);
  return {
    ok: true,
    actionId: action.id,
    summary: `Prepared (NOT done): change ${forModel}'s ${change}. It is waiting for an owner or manager to approve it in Operations.`,
  };
}

// ---- approving and undoing ----

export interface RecordStore {
  read(kind: EditKind): Rec[];
  write(kind: EditKind, records: Rec[]): void;
}
export type ApplyResult = { ok: true } | { ok: false; conflict: boolean; error: string };

// Moves one field from one value to another, but only if the record still
// holds the value the change was prepared against. "apply" goes previous → new;
// "revert" goes back.
export function changeRecord(store: RecordStore, payload: RecordUpdatePayload, direction: "apply" | "revert", nowIso: string): ApplyResult {
  const from = direction === "apply" ? payload.previousValue : payload.newValue;
  const to = direction === "apply" ? payload.newValue : payload.previousValue;

  const records = store.read(payload.kind);
  const index = records.findIndex(r => asRec(r)?.id === payload.recordId);
  if (index === -1) return { ok: false, conflict: false, error: `That ${payload.kind} no longer exists, so nothing was changed.` };

  const current = norm(records[index]![payload.field]);
  if (current !== from) {
    return {
      ok: false,
      conflict: true,
      error: `The ${payload.fieldLabel} of ${payload.recordLabel} has been changed by someone since this was prepared (it is now ${current === null ? "not set" : String(current)}), so nothing was overwritten.`,
    };
  }

  const updated: Rec = { ...records[index]!, [payload.field]: to };
  // Marking a job done stamps when, exactly as the Jobs board does.
  if (payload.kind === "job" && payload.field === "status") updated.completedAt = to === "done" ? nowIso : null;
  const next = [...records];
  next[index] = updated;
  store.write(payload.kind, next);
  return { ok: true };
}

// ---- what the model is told and offered ----

export function prepareEditToolDefinition() {
  const fields = Object.entries(EDITABLE).map(([kind, r]) => `${kind}: ${Object.keys(r.fields).join(", ")}`).join("; ");
  return {
    name: "prepare_edit",
    description: `Prepare ONE small change for an owner or manager to approve. It does NOT change anything: it puts a proposal in Operations. You can only change: ${fields}. Use look_inside first to get the record's real id and its current value. Give a specific reason based on what you saw.`,
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: Object.keys(EDITABLE), description: "What sort of record." },
        id: { type: "string", description: "The record's id, exactly as look_inside returned it." },
        field: { type: "string", enum: [...new Set(Object.values(EDITABLE).flatMap(r => Object.keys(r.fields)))], description: "Which field. Vehicle: priceRetail (the asking price). Lead: status. Job: status, priority or dueDate." },
        value: { type: ["string", "number"], description: "The new value: a price in pounds; a status (lead: new, contacted, viewing_booked, test_drive, negotiating, won, lost; job: todo, in_progress, done); a priority (low, medium, high); or a date YYYY-MM-DD." },
        reason: { type: "string", description: "One or two sentences on why, from the records you saw." },
      },
      required: ["kind", "id", "field", "value", "reason"],
    },
  };
}

export function prepareEditPromptSection(user: AuthUser): string {
  if (!canPrepareEdits(user)) {
    return "PREPARING CHANGES: you cannot prepare changes for the person you're talking to, because only an owner or manager can. If they ask you to change something, say so, and that they can make the change themselves in the app or ask an owner or manager.";
  }
  return [
    `PREPARING CHANGES: you also have a prepare_edit tool, for owners and managers. It never changes anything itself: it puts ONE proposed change in Operations (Pilot Brain → Operations (Approvals)) for an owner or manager to approve, reject or undo. You can prepare only these: a car's asking price, a lead's status, and a job's status, priority or due date. Nothing else can be edited by you, and never a customer's details.`,
    `Always look_inside first for the record's real id and current value, and prepare a change only when the records support it and the person has asked for it or agreed to it. Give a specific reason. Prepare at most ${MAX_EDITS_PER_MESSAGE} in one message. Afterwards say plainly what you prepared and that it is WAITING for approval: never say it's done, changed or updated until it has been approved. If a tool result says something can't be done, tell them why in plain words.`,
  ].join(" ");
}
