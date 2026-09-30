import {
  watchTenantWrites,
  insertChanges,
  deleteChangesBefore,
  readCollection,
  readTenantCollection,
  type ChangeAction,
  type ChangeRow,
  type FieldChange,
} from "./db";
import { currentActor, requestActor, type Actor } from "./requestActor";

// The change history: who changed which record, when, and what it was before,
// so an owner can see (and put right) what someone did. Only the owner can read
// it (routes/changeHistory.ts), and entries are kept 90 days.
//
// It is recorded where records are saved (db.ts tells it about every save), not
// route by route, so a new screen or a Pilot Brain action is covered without
// anyone remembering to add it. Only saves made by a signed-in person count
// (requestActor.ts): the public booking form, webhooks and background tidy-ups
// change nothing here. Team changes (roles, removals, joining) are recorded
// explicitly by the team routes, because the stored accounts list holds
// password hashes and must never be diffed into a history.
//
// Never stored: anything that looks like a secret or a bank / identity number
// (shown only as "(hidden)"), and the figures the app works out by itself for a
// car (scores, predictions), which change without anyone touching the car.

export const HISTORY_DAYS = 90;
export const historySince = (now = Date.now()) => new Date(now - HISTORY_DAYS * 86_400_000).toISOString();

type Rec = Record<string, unknown>;

interface ListSpec {
  area: string;
  // Clock-ins are added every time someone clocks in; only edits and removals
  // of them are worth the owner's attention.
  skipAdded?: boolean;
  ignore?: readonly string[];
}

// Figures the app works out for a car by itself.
const CAR_WORKED_OUT = [
  "market", "marketHeat", "riskScore", "rarity", "depreciationCurve", "predictedRepairs", "supernovaScore",
  "flipDifficulty", "valuationConfidence", "photoQuality", "auctionDelta", "aiPriceConfidence", "buyerPersona",
  "sellerPsychology", "finance", "img",
];

export const LISTS: Record<string, ListSpec> = {
  vehicles: { area: "Stock", ignore: CAR_WORKED_OUT },
  leads: { area: "Leads" },
  customers: { area: "Customers" },
  contacts: { area: "Contacts" },
  jobs: { area: "Jobs" },
  appointments: { area: "Bookings" },
  consumables: { area: "Parts & consumables" },
  staff: { area: "Staff records" },
  timekeeping: { area: "Clock-ins", skipAdded: true },
  leave: { area: "Leave" },
  shifts: { area: "Rota" },
  workPatterns: { area: "Work patterns" },
  wantedRequests: { area: "Wanted cars" },
  payRates: { area: "Pay rates" },
};

// Settings kept as one document each.
export const DOCS: Record<string, string> = {
  bookingSettings: "Booking settings",
  rotaSettings: "Rota settings",
};

// The Books is one document holding several lists.
export const BOOKS_LISTS: Record<string, string> = {
  costs: "Books · Costs",
  purchases: "Books · Purchases",
  sales: "Books · Sales",
  transactions: "Books · Transactions",
  suppliers: "Books · Suppliers",
  categories: "Books · Categories",
};

// Bookkeeping fields, not changes anyone made.
const NEVER_A_CHANGE = new Set(["id", "updatedAt", "lastUpdated", "lastModified", "modifiedAt", "savedAt", "syncedAt", "version", "_v"]);

const SECRET = /pass(word)?|secret|token|api.?key|sort.?code|account.?(number|no)|bank|national.?insurance|^ni(no|number)?$|passport|date.?of.?birth|^dob$/i;
export const HIDDEN = "(hidden)";

const MAX_TEXT = 200;
const MAX_FIELDS = 40;

const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);
const isEmpty = (v: unknown) => v === undefined || v === null || v === "";

/** A value as the owner reads it, or undefined for "nothing". */
export function shown(v: unknown): string | undefined {
  if (isEmpty(v)) return undefined;
  if (typeof v === "string") return v.startsWith("data:") ? "(a picture)" : clip(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return undefined;
    const simple = v.every((x) => typeof x === "string" || typeof x === "number") && !v.some((x) => String(x).startsWith("data:"));
    const joined = simple ? v.join(", ") : "";
    return simple && joined.length <= MAX_TEXT ? joined : `${v.length} item${v.length === 1 ? "" : "s"}`;
  }
  return clip(JSON.stringify(v));
}

// Key order and "missing vs null vs empty" are not changes.
function canonical(v: unknown): string {
  if (isEmpty(v)) return "null";
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Rec;
    return `{${Object.keys(o)
      .filter((k) => !isEmpty(o[k]))
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function fieldChange(field: string, before: unknown, after: unknown): FieldChange {
  if (SECRET.test(field)) return { field, ...(isEmpty(before) ? {} : { before: HIDDEN }), ...(isEmpty(after) ? {} : { after: HIDDEN }) };
  const b = shown(before);
  const a = shown(after);
  return { field, ...(b === undefined ? {} : { before: b }), ...(a === undefined ? {} : { after: a }) };
}

/** What changed between two versions of one record. */
export function fieldChanges(before: Rec, after: Rec, ignore: readonly string[] = []): FieldChange[] {
  const skip = new Set([...NEVER_A_CHANGE, ...ignore]);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => !skip.has(f));
  return fields
    .filter((f) => canonical(before[f]) !== canonical(after[f]))
    .slice(0, MAX_FIELDS)
    .map((f) => fieldChange(f, before[f], after[f]));
}

/** Everything a removed record held, so the owner can see what was lost. */
function whatWasThere(rec: Rec, ignore: readonly string[] = []): FieldChange[] {
  const skip = new Set([...NEVER_A_CHANGE, ...ignore]);
  return Object.keys(rec)
    .filter((f) => !skip.has(f) && !isEmpty(rec[f]))
    .slice(0, MAX_FIELDS)
    .map((f) => fieldChange(f, rec[f], undefined));
}

const idOf = (r: unknown): string | null => {
  const id = (r as Rec | null)?.id;
  return typeof id === "string" && id ? id : typeof id === "number" ? String(id) : null;
};

function byId(list: unknown): Map<string, Rec> {
  const m = new Map<string, Rec>();
  if (!Array.isArray(list)) return m;
  for (const r of list) {
    const id = idOf(r);
    if (id !== null && r && typeof r === "object") m.set(id, r as Rec);
  }
  return m;
}

// ── Names people recognise ───────────────────────────────────────────────

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : "");
const money = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? `£${v.toLocaleString("en-GB", { maximumFractionDigits: 2 })}` : "");

export function carName(v: Rec | undefined): string {
  if (!v) return "";
  const car = [text(v.year), text(v.make), text(v.model)].filter(Boolean).join(" ");
  const reg = text(v.reg);
  return [car, reg && `(${reg.toUpperCase()})`].filter(Boolean).join(" ");
}

interface Lookups {
  car(id: unknown): string;
  person(id: unknown): string;
}

function lookupsFor(dealershipId: string): Lookups {
  let cars: Map<string, Rec> | null = null;
  let people: Map<string, string> | null = null;
  return {
    car(id) {
      if (typeof id !== "string") return "";
      cars ??= byId(readTenantCollection<Rec>(dealershipId, "vehicles"));
      return carName(cars.get(id));
    },
    person(id) {
      if (typeof id !== "string") return "";
      people ??= new Map(
        readCollection<{ id: string; name: string; dealershipId: string }>("users")
          .filter((u) => u.dealershipId === dealershipId)
          .map((u) => [u.id, u.name])
      );
      return people.get(id) ?? "";
    },
  };
}

const NAME_FIELDS = ["name", "customerName", "fullName", "staffName", "title", "label", "description", "item", "partName", "supplier"];

export function recordLabel(where: string, r: Rec, look: Lookups): string {
  if (where === "vehicles") return carName(r) || "a car";
  if (where === "costs") return [text(r.type) || "cost", money(r.amount), look.car(r.vehicleId) && `on ${look.car(r.vehicleId)}`].filter(Boolean).join(" ");
  if (where === "purchases") return ["purchase", money(r.purchasePrice), look.car(r.vehicleId) && `of ${look.car(r.vehicleId)}`].filter(Boolean).join(" ");
  if (where === "sales") return ["sale", text(r.invoiceNumber), money(r.salePrice), look.car(r.vehicleId) && `of ${look.car(r.vehicleId)}`].filter(Boolean).join(" ");
  const named = NAME_FIELDS.map((f) => text(r[f])).find(Boolean) ?? "";
  const forWhom = look.person(r.userId);
  const car = look.car(r.vehicleId);
  const label = [named, forWhom && `for ${forWhom}`, car && !named.includes(car) && `(${car})`].filter(Boolean).join(" ");
  return clip(label || "an entry");
}

// ── Turning a save into history ───────────────────────────────────────────

interface Entry {
  area: string;
  recordId: string | null;
  recordLabel: string;
  action: ChangeAction;
  changes: FieldChange[];
}

function diffList(where: string, spec: ListSpec, before: unknown, after: unknown, look: Lookups): Entry[] {
  const b = byId(before);
  const a = byId(after);
  const out: Entry[] = [];
  for (const [id, rec] of a) {
    const old = b.get(id);
    if (!old) {
      if (!spec.skipAdded) out.push({ area: spec.area, recordId: id, recordLabel: recordLabel(where, rec, look), action: "added", changes: [] });
      continue;
    }
    const changes = fieldChanges(old, rec, spec.ignore);
    if (changes.length > 0) out.push({ area: spec.area, recordId: id, recordLabel: recordLabel(where, rec, look), action: "changed", changes });
  }
  for (const [id, old] of b) {
    if (!a.has(id)) out.push({ area: spec.area, recordId: id, recordLabel: recordLabel(where, old, look), action: "removed", changes: whatWasThere(old, spec.ignore) });
  }
  return out;
}

export function entriesForSave(dealershipId: string, collection: string, before: unknown, after: unknown): Entry[] {
  const look = lookupsFor(dealershipId);
  const list = LISTS[collection];
  if (list) return diffList(collection, list, before, after, look);
  if (collection === "bookkeeping") {
    const b = (before ?? {}) as Rec;
    const a = (after ?? {}) as Rec;
    return Object.entries(BOOKS_LISTS).flatMap(([name, area]) => diffList(name, { area }, b[name], a[name], look));
  }
  const doc = DOCS[collection];
  if (doc) {
    const changes = fieldChanges((before ?? {}) as Rec, (after ?? {}) as Rec);
    return changes.length > 0 ? [{ area: doc, recordId: collection, recordLabel: doc, action: "changed", changes }] : [];
  }
  return [];
}

// ── Writing it down ───────────────────────────────────────────────────────

const PURGE_EVERY_MS = 60 * 60 * 1000;
let lastPurge = 0;

/** Drops entries older than 90 days (at most once an hour, or now if `force`). */
export function purgeOldHistory(force = false): void {
  const now = Date.now();
  if (!force && now - lastPurge < PURGE_EVERY_MS) return;
  lastPurge = now;
  deleteChangesBefore(historySince(now));
}

function roleName(actor: Actor): string {
  return actor.role === "owner" ? "owner" : actor.staffRole ?? "staff";
}

function write(dealershipId: string, actor: Actor, entries: Entry[]): void {
  if (entries.length === 0) return;
  const at = new Date().toISOString();
  const rows: Omit<ChangeRow, "id">[] = entries.map((e) => ({
    dealershipId,
    at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: roleName(actor),
    ...e,
  }));
  insertChanges(rows);
  purgeOldHistory();
}

/**
 * Something done that isn't a record being saved (a role changed, someone
 * removed, customer details erased). `actor` defaults to whoever is signed in;
 * recorded even while saves are being kept out of the history.
 */
export function recordEvent(
  dealershipId: string,
  area: string,
  recordLabel: string,
  changes: FieldChange[],
  opts: { recordId?: string; action?: ChangeAction; actor?: Actor } = {}
): void {
  const actor = opts.actor ?? requestActor();
  if (!actor) return;
  write(dealershipId, actor, [{ area, recordId: opts.recordId ?? null, recordLabel, action: opts.action ?? "note", changes }]);
}

export { fieldChange };

const followed = (collection: string) => collection in LISTS || collection in DOCS || collection === "bookkeeping";

watchTenantWrites({
  wants: (collection) => followed(collection) && currentActor() !== null,
  saw(dealershipId, collection, before, after) {
    const actor = currentActor();
    if (!actor) return;
    write(dealershipId, actor, entriesForSave(dealershipId, collection, before, after));
  },
});
