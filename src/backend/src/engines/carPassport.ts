// The Car Passport: one public page per car that answers a buyer's questions
// before they have to ask: what it is, what it costs, its MOT history, what has
// been done to it, and how the price sits against the market.
//
// This is a page a stranger on the internet can open, so this file is the
// gatekeeper for what they may see:
//  - It is built ONLY from the fields chosen below. Anything not listed (what
//    the dealer paid, the expected sale price, internal notes, the buyer of a
//    sold car, costs, profit) can't appear however the record looks.
//  - The dealer decides per car whether it is published at all, and which
//    optional sections (MOT, emissions, market comparison, the registration)
//    show. Nothing is published by default.
//  - Every figure is real or absent. A section with no data behind it is left
//    out, never filled in: no MOT record means no MOT section; a market
//    comparison needs enough listings, recently checked, or it isn't shown.
//  - Text from a record (the MOT advisories, the dealer's own lines) is
//    flattened and capped. The page shows it as plain text.

import { plainLine } from "./promptText";

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const asRecords = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);
const finite = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const DAY_MS = 86400000;

// ---- what the dealer controls ----

export interface PassportConfig {
  published: boolean;
  showReg: boolean;
  showMot: boolean;
  showUlez: boolean;
  showMarket: boolean;
  // Lines the dealer wrote about work done to the car. Never prices.
  workDone: string[];
  // A short personal note from the dealer, shown near the top.
  note: string;
  updatedAt: string;
}

export const MAX_WORK_LINES = 12;
export const MAX_WORK_LINE = 120;
export const MAX_NOTE = 300;

export const DEFAULT_CONFIG: PassportConfig = {
  published: false,
  showReg: true,
  showMot: true,
  showUlez: true,
  // Off until the dealer chooses it: whether to put your price next to the
  // market's is the dealer's call, and it is all-or-nothing (a section that
  // only appeared when it flattered the price would be a kind of lie).
  showMarket: false,
  workDone: [],
  note: "",
  updatedAt: "",
};

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

function cleanLines(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of v) {
    const line = plainLine(raw, MAX_WORK_LINE);
    const key = line.toLowerCase();
    if (line.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= MAX_WORK_LINES) break;
  }
  return out;
}

// Reads what is stored, tolerantly: a missing or damaged entry is just "not
// published, defaults".
export function normaliseConfig(raw: unknown): PassportConfig {
  if (!isRec(raw)) return { ...DEFAULT_CONFIG, workDone: [] };
  return {
    published: raw.published === true,
    showReg: bool(raw.showReg, DEFAULT_CONFIG.showReg),
    showMot: bool(raw.showMot, DEFAULT_CONFIG.showMot),
    showUlez: bool(raw.showUlez, DEFAULT_CONFIG.showUlez),
    showMarket: bool(raw.showMarket, DEFAULT_CONFIG.showMarket),
    workDone: cleanLines(raw.workDone),
    note: plainLine(raw.note, MAX_NOTE),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

export type ConfigParse = { ok: true; config: Omit<PassportConfig, "updatedAt"> } | { ok: false; error: string };

// Strict, for what the dealer sends: says what's wrong instead of quietly
// trimming their words.
export function parseConfigInput(body: unknown): ConfigParse {
  if (!isRec(body)) return { ok: false, error: "Send the passport settings as an object." };
  for (const key of ["published", "showReg", "showMot", "showUlez", "showMarket"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") return { ok: false, error: `${key} must be true or false.` };
  }
  if (typeof body.published !== "boolean") return { ok: false, error: "published must be true or false." };

  let workDone: string[] = [];
  if (body.workDone !== undefined) {
    if (!Array.isArray(body.workDone) || body.workDone.some(l => typeof l !== "string")) {
      return { ok: false, error: "workDone must be a list of lines of text." };
    }
    const lines = (body.workDone as string[]).map(l => l.trim()).filter(Boolean);
    if (lines.length > MAX_WORK_LINES) return { ok: false, error: `Up to ${MAX_WORK_LINES} lines of work done.` };
    if (lines.some(l => l.length > MAX_WORK_LINE)) return { ok: false, error: `Each line can be up to ${MAX_WORK_LINE} characters.` };
    workDone = cleanLines(lines);
  }

  let note = "";
  if (body.note !== undefined) {
    if (typeof body.note !== "string") return { ok: false, error: "note must be text." };
    if (body.note.trim().length > MAX_NOTE) return { ok: false, error: `The note can be up to ${MAX_NOTE} characters.` };
    note = plainLine(body.note, MAX_NOTE);
  }

  return {
    ok: true,
    config: {
      published: body.published,
      showReg: bool(body.showReg, DEFAULT_CONFIG.showReg),
      showMot: bool(body.showMot, DEFAULT_CONFIG.showMot),
      showUlez: bool(body.showUlez, DEFAULT_CONFIG.showUlez),
      showMarket: bool(body.showMarket, DEFAULT_CONFIG.showMarket),
      workDone,
      note,
    },
  };
}

// ---- suggestions for the dealer (never shown publicly as they stand) ----

// Cost types that describe work done to a car. Purchase, auction, transport,
// advertising and misc are about the deal, not the car.
const WORK_COST_TYPES = ["parts", "labour", "mot", "tyres", "detailing", "recon"];

// Things already recorded against this car that could be a line on its passport:
// finished jobs and labelled parts. Only the wording, never an amount, so the
// dealer can tick what they want to say and edit how they say it.
export function suggestWorkDone(jobs: unknown, costs: unknown, vehicleId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: unknown) => {
    const line = plainLine(raw, MAX_WORK_LINE);
    const key = line.toLowerCase();
    if (line.length < 3 || seen.has(key) || out.length >= MAX_WORK_LINES) return;
    seen.add(key);
    out.push(line);
  };
  for (const j of asRecords(jobs)) {
    if (j.vehicleId === vehicleId && String(j.status ?? "").toLowerCase() === "done") add(j.title);
  }
  for (const c of asRecords(costs)) {
    if (c.vehicleId === vehicleId && WORK_COST_TYPES.includes(String(c.type ?? "").toLowerCase())) add(c.label);
  }
  return out;
}

// ---- what a stranger may see ----

export const MAX_IMAGES = 10;
const MAX_INLINE_IMAGE_CHARS = 400_000;
const MAX_INLINE_TOTAL_CHARS = 1_500_000;

// While developing, this app's own hosted photos are served from the local
// machine over plain http. That one exact shape (the app's photo path with an
// id) is accepted so a test setup works; any other http address is not.
const LOCAL_HOSTED_PHOTO = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{2,5})?\/photos\/[0-9a-f-]{36}\.(?:jpe?g|png|webp)$/i;

// Hosted photos (public by design: unguessable addresses) and small inline
// ones. Anything else, a link to some other scheme included, is left out.
export function passportImages(images: unknown): string[] {
  const out: string[] = [];
  let inline = 0;
  for (const u of Array.isArray(images) ? images : []) {
    if (out.length >= MAX_IMAGES) break;
    if (typeof u !== "string") continue;
    if (u.length <= 500 && (/^https:\/\/[^\s"'<>]+$/i.test(u) || LOCAL_HOSTED_PHOTO.test(u))) {
      out.push(u);
    } else if (
      u.length <= MAX_INLINE_IMAGE_CHARS &&
      inline + u.length <= MAX_INLINE_TOTAL_CHARS &&
      /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u)
    ) {
      out.push(u);
      inline += u.length;
    }
  }
  return out;
}

// "YYYY-MM-DD", from whatever date text a record holds, or nothing.
function dayOf(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (iso) return iso[1];
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10);
}

export type MotResult = "pass" | "fail" | "unknown";

export interface PassportMotTest {
  date?: string;
  year?: number;
  result: MotResult;
  mileage?: number;
  advisories: string[];
  failures: string[];
}

export interface PassportMot {
  expiry?: string;
  state: "valid" | "expired" | "unknown";
  daysLeft?: number;
  tests: PassportMotTest[];
}

export const MAX_MOT_TESTS = 8;
const MAX_MOT_NOTES = 6;

function motLines(v: unknown): string[] {
  return (Array.isArray(v) ? v : [])
    .map(x => plainLine(x, 140))
    .filter(Boolean)
    .slice(0, MAX_MOT_NOTES);
}

// The car's MOT as recorded, or nothing if no MOT was ever looked up. The
// test numbers on the record are never passed on.
export function motSection(vehicle: Rec, now: number): PassportMot | undefined {
  const mot = isRec(vehicle.mot) ? vehicle.mot : {};
  const expiry = dayOf(mot.expiry);

  const tests: PassportMotTest[] = asRecords(mot.history)
    .map(h => {
      const result = String(h.result ?? "");
      const date = dayOf(h.date);
      const year = finite(h.year);
      const mileage = finite(h.mileage);
      const test: PassportMotTest = {
        result: /pass/i.test(result) ? "pass" : /fail/i.test(result) ? "fail" : "unknown",
        advisories: motLines(h.advisories),
        failures: motLines(h.failures),
        ...(date ? { date } : {}),
        ...(!date && year !== undefined ? { year } : {}),
        ...(mileage !== undefined && mileage >= 0 ? { mileage: Math.round(mileage) } : {}),
      };
      return test;
    })
    // A row with no date, no year and no result says nothing.
    .filter(t => t.date !== undefined || t.year !== undefined || t.result !== "unknown")
    .sort((a, b) => (b.date ?? `${b.year ?? 0}`).localeCompare(a.date ?? `${a.year ?? 0}`))
    .slice(0, MAX_MOT_TESTS);

  if (!expiry && tests.length === 0) return undefined;

  const today = new Date(now).toISOString().slice(0, 10);
  const state = expiry ? (expiry >= today ? "valid" : "expired") : "unknown";
  const daysLeft = expiry && state === "valid" ? Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS) : undefined;
  return { state, tests, ...(expiry ? { expiry } : {}), ...(daysLeft !== undefined ? { daysLeft } : {}) };
}

export interface PassportMarket {
  averageAsking: number;
  lowest?: number;
  highest?: number;
  listings: number;
  checkedOn: string;
  // This car's asking price minus the average asking price (negative = below).
  difference: number;
  basis: "make and model";
}

// Enough listings, checked recently, or there is nothing honest to say.
export const MIN_MARKET_LISTINGS = 5;
export const MAX_MARKET_AGE_DAYS = 45;

// Where the price sits against the make and model's average ASKING price. The
// market data is per make and model (age, mileage and spec are not compared),
// and it is asking prices, not what cars sold for; the page says both.
export function marketSection(vehicle: Rec, asking: number | null, snapshots: unknown, now: number): PassportMarket | undefined {
  if (asking === null || asking <= 0) return undefined;
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const make = norm(vehicle.make);
  const model = norm(vehicle.model);
  if (!make || !model) return undefined;

  const usable = asRecords(snapshots)
    .filter(s => norm(s.make) === make && norm(s.model) === model)
    .filter(s => (finite(s.avgPrice) ?? 0) > 0 && (finite(s.sampleSize) ?? 0) > 0 && dayOf(s.capturedAt) !== undefined)
    .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
  const latest = usable[0];
  if (!latest) return undefined;

  const listings = Math.round(finite(latest.sampleSize)!);
  const checkedOn = dayOf(latest.capturedAt)!;
  // Whole calendar days, so "45 days" means the same all day long.
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  const ageDays = Math.round((today - Date.parse(`${checkedOn}T00:00:00Z`)) / DAY_MS);
  if (listings < MIN_MARKET_LISTINGS || ageDays > MAX_MARKET_AGE_DAYS || ageDays < -1) return undefined;

  const average = finite(latest.avgPrice)!;
  const low = finite(latest.lowPrice);
  const high = finite(latest.highPrice);
  return {
    averageAsking: Math.round(average),
    listings,
    checkedOn,
    difference: Math.round(asking - average),
    basis: "make and model",
    ...(low !== undefined && low > 0 ? { lowest: Math.round(low) } : {}),
    ...(high !== undefined && high > 0 ? { highest: Math.round(high) } : {}),
  };
}

export interface PassportDealer {
  name: string;
  phone?: string;
  address?: string;
}

export interface PublicPassportCar {
  id: string;
  year?: number;
  make: string;
  model: string;
  mileage?: number;
  colour?: string;
  reg?: string;
  fuelType?: string;
  askingPrice: number | null;
  images: string[];
}

export type PublicPassport =
  | { sold: true; dealer: PassportDealer; car: { year?: number; make: string; model: string } }
  | {
      sold: false;
      dealer: PassportDealer;
      car: PublicPassportCar;
      mot?: PassportMot;
      // The fuel and Euro standard the page turns into a ULEZ answer. Only
      // sent when the dealer shows that section and the fuel type is known.
      emissions?: { fuelType: string; euroStatus?: string };
      market?: PassportMarket;
      workDone: string[];
      note?: string;
      generatedAt: string;
    };

export interface PassportInputs {
  dealership: { name?: unknown; phone?: unknown; address?: unknown };
  vehicle: Rec;
  config: PassportConfig;
  snapshots: unknown;
  now: number;
}

export function isSoldVehicle(vehicle: Rec): boolean {
  return String(vehicle.status ?? "").toLowerCase() === "sold";
}

function dealerOf(d: PassportInputs["dealership"]): PassportDealer {
  const phone = plainLine(d.phone, 30);
  const address = plainLine(d.address, 160);
  return {
    name: plainLine(d.name, 80) || "This dealership",
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
  };
}

export function buildPublicPassport(i: PassportInputs): PublicPassport {
  const v = i.vehicle;
  const year = finite(v.year);
  const validYear = year !== undefined && Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : undefined;
  const make = plainLine(v.make, 40);
  const model = plainLine(v.model, 40);
  const dealer = dealerOf(i.dealership);

  if (isSoldVehicle(v)) {
    return { sold: true, dealer, car: { make, model, ...(validYear ? { year: validYear } : {}) } };
  }

  // The asking price only: never the sale price a sold car carries, never
  // what the dealer paid.
  const priceRetail = finite(v.priceRetail);
  const askingPrice = priceRetail !== undefined && priceRetail > 0 ? Math.round(priceRetail) : null;

  const mileage = finite(v.mileage);
  const colour = plainLine(v.colour, 20);
  const reg = i.config.showReg ? plainLine(v.reg, 12).toUpperCase() : "";
  const motRaw = isRec(v.mot) ? v.mot : {};
  const fuelType = plainLine(motRaw.fuelType, 30);
  const euroStatus = plainLine(motRaw.euroStatus, 30);
  const note = i.config.note.trim();

  const mot = i.config.showMot ? motSection(v, i.now) : undefined;
  const market = i.config.showMarket ? marketSection(v, askingPrice, i.snapshots, i.now) : undefined;

  return {
    sold: false,
    dealer,
    car: {
      id: plainLine(v.id, 100),
      make,
      model,
      askingPrice,
      images: passportImages(v.images),
      ...(validYear ? { year: validYear } : {}),
      ...(mileage !== undefined && mileage >= 0 ? { mileage: Math.round(mileage) } : {}),
      ...(colour ? { colour } : {}),
      ...(reg ? { reg } : {}),
      ...(fuelType ? { fuelType } : {}),
    },
    workDone: i.config.workDone,
    generatedAt: new Date(i.now).toISOString(),
    ...(mot ? { mot } : {}),
    ...(i.config.showUlez && fuelType ? { emissions: { fuelType, ...(euroStatus ? { euroStatus } : {}) } } : {}),
    ...(market ? { market } : {}),
    ...(note ? { note } : {}),
  };
}
