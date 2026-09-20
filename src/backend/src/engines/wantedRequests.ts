// "Tell me when you get one": what a stranger may ask a dealer to watch for, and
// how a request is matched against the cars in stock.
//
// Nothing here sends anything. A match only tells the dealer that somebody is
// waiting for a car like this; the dealer decides whether and how to get in
// touch. That keeps every message a person actually chose to send, and it means
// a person who asked for one car is never contacted about anything else.
//
// A request holds a stranger's contact details, so:
//  - it is only stored with a recorded "yes, contact me" and the exact words
//    they said yes to;
//  - it is forgotten after RETENTION_DAYS without the person asking again;
//  - every piece of text is cleaned before it is kept (untrustedText.ts).

import { toSingleLine } from "../untrustedText";
import { MAX_NAME_CHARS, cleanEmail, cleanPhone } from "../publicContact";

export type WantedStatus = "waiting" | "contacted" | "closed";
export const WANTED_STATUSES: readonly WantedStatus[] = ["waiting", "contacted", "closed"];

export const MAX_MAKE_CHARS = 40;
export const MAX_MODEL_CHARS = 40;
export const MAX_WANTED_NOTE_CHARS = 300;
export const MIN_BUDGET = 500;
export const MAX_BUDGET = 500_000;
// How long a request is kept after the person last asked. Said to them on the form.
export const RETENTION_DAYS = 365;
// The most requests one dealership will hold at once, so a script cannot fill a
// dealer's list with junk however many addresses it comes from.
export const MAX_LIVE_REQUESTS = 300;

const DAY_MS = 86_400_000;

export interface WantedRequest {
  id: string;
  make?: string;
  model?: string;
  maxPrice?: number;
  note?: string;
  name: string;
  phone?: string;
  email?: string;
  status: WantedStatus;
  // What they agreed to, and when: the wording exactly as they were shown it.
  consent: { at: string; wording: string };
  // When they first asked, and the last time they asked (the retention clock).
  createdAt: string;
  askedAt: string;
  // When staff last changed the status.
  statusChangedAt?: string;
}

// What a stranger's form is boiled down to once it has been checked.
export interface WantedInput {
  make?: string;
  model?: string;
  maxPrice?: number;
  note?: string;
  name: string;
  phone?: string;
  email?: string;
}

export type ParsedWanted = { ok: true; value: WantedInput } | { ok: false; error: string };

// The words shown next to the tick-box, and stored with the request. The server
// is the only place they are written, and the form displays what the server
// sends, so what a person agreed to and what was recorded cannot differ.
export function consentWording(dealerName: string): string {
  const name = toSingleLine(dealerName, MAX_NAME_CHARS) || "this dealer";
  return `I'd like ${name} to contact me about cars that match this. They'll keep my details for up to 12 months, and I can ask them to delete them at any time.`;
}

const BUDGET_ADVICE = `Please give a budget between £${MIN_BUDGET.toLocaleString("en-GB")} and £${MAX_BUDGET.toLocaleString("en-GB")}, or leave it blank.`;

// A whole number of pounds, nothing at all, or null when it is not a sensible budget.
function readBudget(raw: unknown): number | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") {
    const digits = raw.replace(/[£,\s]/g, "");
    if (digits === "") return undefined;
    if (!/^\d+(\.\d+)?$/.test(digits)) return null;
    n = Number(digits);
  } else return null;
  if (!Number.isFinite(n)) return null;
  n = Math.round(n);
  return n >= MIN_BUDGET && n <= MAX_BUDGET ? n : null;
}

export function parseWantedInput(body: unknown): ParsedWanted {
  if (!body || typeof body !== "object") return { ok: false, error: "Missing details." };
  const b = body as Record<string, unknown>;

  if (b.consent !== true) {
    return { ok: false, error: "Please tick the box to say the dealer may contact you about this." };
  }
  const name = toSingleLine(b.name, MAX_NAME_CHARS);
  if (!name) return { ok: false, error: "Please tell us your name." };

  const phone = cleanPhone(b.phone);
  if ("refused" in phone) return { ok: false, error: phone.refused };
  const email = cleanEmail(b.email);
  if ("refused" in email) return { ok: false, error: email.refused };
  if (!phone.value && !email.value) {
    return { ok: false, error: "Please give a phone number or email so the dealer can reach you." };
  }

  const make = toSingleLine(b.make, MAX_MAKE_CHARS);
  const model = toSingleLine(b.model, MAX_MODEL_CHARS);
  if (model && !make) return { ok: false, error: "Please add the make as well as the model." };
  const note = toSingleLine(b.note, MAX_WANTED_NOTE_CHARS);
  if (!make && !note) return { ok: false, error: "Tell us what you're looking for: a make, or a few words about it." };

  const maxPrice = readBudget(b.maxPrice);
  if (maxPrice === null) return { ok: false, error: BUDGET_ADVICE };

  return {
    ok: true,
    value: {
      name,
      ...(make ? { make } : {}),
      ...(model ? { model } : {}),
      ...(maxPrice !== undefined ? { maxPrice } : {}),
      ...(note ? { note } : {}),
      ...(phone.value ? { phone: phone.value } : {}),
      ...(email.value ? { email: email.value } : {}),
    },
  };
}

// ---- matching ----

// "Mercedes-Benz" and "Mercedes Benz" are one make; "1 Series" and "1-series" one model.
const words = (text: unknown): string[] =>
  typeof text === "string" ? text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean) : [];

const sameMake = (a: unknown, b: unknown): boolean => {
  const x = words(a).join("");
  return x !== "" && x === words(b).join("");
};

// Every word of what they asked for must start the car's model, in order:
// "Golf" finds a "Golf GTI", "A3" finds an "A3 Sportback", but "A3" never finds an "A30".
const modelFits = (asked: unknown, model: unknown): boolean => {
  const want = words(asked);
  const have = words(model);
  return want.length > 0 && want.length <= have.length && want.every((w, i) => w === have[i]);
};

export interface StockCar {
  id: string;
  make?: unknown;
  model?: unknown;
  year?: unknown;
  priceRetail?: unknown;
}

export interface StockMatch {
  vehicleId: string;
  label: string;
  price: number | null;
  // Set only when the car has a price that is above what they said they'd spend.
  overBudgetBy?: number;
}

const carLabel = (car: StockCar): string =>
  [typeof car.year === "number" && car.year > 0 ? car.year : null, car.make, car.model]
    .filter(part => part !== null && part !== undefined && String(part).trim() !== "")
    .join(" ");

// A request only ever matches on make and model. A request with just a few
// words ("a small automatic") matches nothing by itself: the dealer reads it.
export function matchesFor(request: Pick<WantedRequest, "make" | "model" | "maxPrice">, cars: readonly StockCar[]): StockMatch[] {
  if (!request.make) return [];
  const out: StockMatch[] = [];
  for (const car of cars) {
    if (!sameMake(request.make, car.make)) continue;
    if (request.model && !modelFits(request.model, car.model)) continue;
    const price = typeof car.priceRetail === "number" && car.priceRetail > 0 ? car.priceRetail : null;
    out.push({
      vehicleId: car.id,
      label: carLabel(car),
      price,
      ...(price !== null && request.maxPrice !== undefined && price > request.maxPrice ? { overBudgetBy: price - request.maxPrice } : {}),
    });
  }
  return out;
}

// ---- keeping the list ----

// Requests still inside the retention period. Older ones are treated as gone
// straight away and dropped from the stored list the next time it is written.
export function withoutExpired<T extends Pick<WantedRequest, "askedAt">>(list: readonly T[], now: number = Date.now()): T[] {
  return list.filter(r => {
    const asked = Date.parse(r.askedAt);
    return Number.isFinite(asked) && now - asked < RETENTION_DAYS * DAY_MS;
  });
}

const digitsOnly = (s: string | undefined): string => (s ?? "").replace(/\D/g, "");
const emailKey = (s: string | undefined): string => (s ?? "").trim().toLowerCase();
const modelKey = (s: string | undefined): string => words(s).join(" ");

// Is this the same person asking for the same thing again? Then the existing
// request is refreshed rather than a second one added to the dealer's list.
export function findRepeat(list: readonly WantedRequest[], input: WantedInput): WantedRequest | undefined {
  return list.find(
    r =>
      r.status !== "closed" &&
      words(r.make).join("") === words(input.make).join("") &&
      modelKey(r.model) === modelKey(input.model) &&
      ((input.email !== undefined && emailKey(r.email) === emailKey(input.email)) ||
        (input.phone !== undefined && digitsOnly(r.phone) !== "" && digitsOnly(r.phone) === digitsOnly(input.phone)))
  );
}

// One line for a notification: what they want, never who they are.
export function wantedSummary(r: Pick<WantedRequest, "make" | "model" | "maxPrice" | "note">): string {
  const car = [r.make, r.model].filter(Boolean).join(" ");
  const budget = r.maxPrice !== undefined ? `up to £${r.maxPrice.toLocaleString("en-GB")}` : "";
  const what = car || r.note || "a car";
  return budget ? `${what}, ${budget}` : what;
}

export interface WantedForStaff extends WantedRequest {
  matches: StockMatch[];
}

// Most useful first: people waiting for a car the dealer has right now, then
// everyone else still waiting, then those already contacted, then closed ones.
export function orderForStaff<T extends Pick<WantedRequest, "status" | "askedAt"> & { matches: readonly unknown[] }>(items: readonly T[]): T[] {
  const rank = (r: T): number => (r.status === "closed" ? 3 : r.status === "contacted" ? 2 : r.matches.length > 0 ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b) || Date.parse(b.askedAt) - Date.parse(a.askedAt));
}
