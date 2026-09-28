import { Express, Request } from "express";
import { readTenantCollection, readTenantDoc, writeTenantCollection } from "./db";
import { requireStaffRole, type AuthUser } from "./auth";

// A customer (or anyone the dealership holds details about) asks "what do you
// hold about me?" or "delete me" (UK GDPR access and erasure requests). The
// owner or a manager searches by the email address or phone number the person
// gave, sees every record that matches, downloads it for them, and can erase it.
//
// Matching is on email or phone only, never on a name: two people share a name
// far more often than an email address, and erasing the wrong customer can't be
// undone.
//
// What erasure removes: leads, bookings, the customer list, wanted-car requests,
// contacts, and matching entries in Recently deleted. What it KEEPS: sales in the
// bookkeeping, because the law requires a business to keep its sales and invoice
// records (six years for HMRC). The person is told that in the reply.
//
// Leads, customers and contacts are saved as whole lists, so an old browser tab
// that still holds an erased record would write it straight back on its next
// save. Every erased id is noted in ERASED (ids only, no personal details) and
// those saves drop them (withoutErased).

const ERASED = "erasedRecords";

type Rec = Record<string, unknown> & { id?: unknown };

interface Place {
  // The tenant collection the records live in.
  collection: string;
  // What the place is called in the reply and on screen.
  label: string;
  // The fields holding an email address / phone number.
  email: string;
  phone: string;
}

const ERASABLE: Place[] = [
  { collection: "leads", label: "Leads", email: "email", phone: "phone" },
  { collection: "appointments", label: "Bookings", email: "customerEmail", phone: "customerPhone" },
  { collection: "customers", label: "Customers", email: "email", phone: "phone" },
  { collection: "wantedRequests", label: "Wanted cars", email: "email", phone: "phone" },
  { collection: "contacts", label: "Contacts", email: "email", phone: "phone" },
];

// The whole-list saves that must never bring an erased record back.
export const GUARDED_LISTS = ["leads", "customers", "contacts"] as const;

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v.includes("@") && v.length <= 254 ? v : null;
}

// Digits only, with a UK +44 turned into a leading 0, so "+44 7700 900123",
// "07700 900123" and "07700-900-123" are the same number.
export function normalisePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("44")) digits = `0${digits.slice(2)}`;
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

interface Who {
  email: string | null;
  phone: string | null;
}

function matches(record: unknown, emailField: string, phoneField: string, who: Who): boolean {
  if (!record || typeof record !== "object") return false;
  const r = record as Rec;
  return (
    (who.email !== null && normaliseEmail(r[emailField]) === who.email) ||
    (who.phone !== null && normalisePhone(r[phoneField]) === who.phone)
  );
}

// A Recently deleted entry holds a lead or contact as it was when removed.
function binEntryMatches(entry: unknown, who: Who): boolean {
  const record = (entry as { record?: unknown } | null)?.record;
  return matches(record, "email", "phone", who);
}

function saleMatches(sale: unknown, who: Who): boolean {
  return matches(sale, "buyerEmail", "buyerPhone", who);
}

export function findCustomerData(dealershipId: string, who: Who) {
  const found: Record<string, Rec[]> = {};
  for (const place of ERASABLE) {
    found[place.collection] = readTenantCollection<Rec>(dealershipId, place.collection).filter(r =>
      matches(r, place.email, place.phone, who)
    );
  }
  const recentlyDeleted = readTenantCollection<Rec>(dealershipId, "recentlyDeleted").filter(e => binEntryMatches(e, who));
  const bookkeeping = readTenantDoc<{ sales?: unknown[] }>(dealershipId, "bookkeeping", { sales: [] });
  const sales = (Array.isArray(bookkeeping.sales) ? bookkeeping.sales : []).filter(s => saleMatches(s, who)) as Rec[];
  return { found, recentlyDeleted, sales };
}

// The ids erased from `list`, for withoutErased.
function erasedIds(dealershipId: string, list: string): Set<string> {
  return new Set(
    readTenantCollection<{ list: string; id: string }>(dealershipId, ERASED)
      .filter(e => e.list === list)
      .map(e => e.id)
  );
}

// Drops any record that has been erased from a whole-list save (see the top of
// this file). Saves with nothing erased pass through untouched.
export function withoutErased<T>(dealershipId: string, list: (typeof GUARDED_LISTS)[number], items: T[]): T[] {
  const gone = erasedIds(dealershipId, list);
  if (gone.size === 0) return items;
  return items.filter(item => {
    const id = (item as Rec | null)?.id;
    return !(typeof id === "string" && gone.has(id));
  });
}

function whoFrom(body: unknown): Who | { error: string } {
  const { email, phone } = (body ?? {}) as Record<string, unknown>;
  const who = { email: normaliseEmail(email), phone: normalisePhone(phone) };
  if (email !== undefined && email !== "" && who.email === null) return { error: "That email address doesn't look right." };
  if (phone !== undefined && phone !== "" && who.phone === null) return { error: "That phone number doesn't look right." };
  if (who.email === null && who.phone === null) {
    return { error: "Enter the email address or phone number the person gave you." };
  }
  return who;
}

const KEPT_NOTE =
  "Sales records are kept: the law requires a business to keep its sales and invoice records (six years for HMRC).";

export default function registerCustomerDataRoute(app: Express) {
  const me = (req: Request) => (req as Request & { user: AuthUser }).user;

  // Everything held about the person, as one reply (the web app offers it as a
  // download to hand over).
  app.post("/customer-data/search", requireStaffRole("manager"), (req, res) => {
    const who = whoFrom(req.body);
    if ("error" in who) return res.status(400).json({ ok: false, error: who.error });
    const { found, recentlyDeleted, sales } = findCustomerData(me(req).dealershipId, who);
    res.json({
      ok: true,
      searchedFor: who,
      searchedAt: new Date().toISOString(),
      places: ERASABLE.map(p => ({ key: p.collection, label: p.label, records: found[p.collection] })),
      recentlyDeleted,
      keptSales: sales,
      keptNote: KEPT_NOTE,
    });
  });

  // Erases everything the search finds, except sales. Needs `confirm: true` so
  // a stray request can't do it.
  app.post("/customer-data/erase", requireStaffRole("manager"), (req, res) => {
    const who = whoFrom(req.body);
    if ("error" in who) return res.status(400).json({ ok: false, error: who.error });
    if ((req.body ?? {}).confirm !== true) {
      return res.status(400).json({ ok: false, error: "Erasing can't be undone. Confirm it to go ahead." });
    }
    const user = me(req);
    const d = user.dealershipId;
    const now = new Date().toISOString();
    const noted: { list: string; id: string; erasedAt: string; erasedByName: string }[] = [];
    const erased: Record<string, number> = {};

    for (const place of ERASABLE) {
      const all = readTenantCollection<Rec>(d, place.collection);
      const kept = all.filter(r => !matches(r, place.email, place.phone, who));
      erased[place.collection] = all.length - kept.length;
      if (kept.length === all.length) continue;
      for (const r of all) {
        if (kept.includes(r)) continue;
        if (typeof r.id === "string") noted.push({ list: place.collection, id: r.id, erasedAt: now, erasedByName: user.name });
      }
      writeTenantCollection(d, place.collection, kept);
    }

    const bin = readTenantCollection<Rec>(d, "recentlyDeleted");
    const keptBin = bin.filter(e => !binEntryMatches(e, who));
    erased.recentlyDeleted = bin.length - keptBin.length;
    for (const e of bin) {
      if (keptBin.includes(e)) continue;
      const record = (e as { list?: unknown; record?: Rec }).record;
      const list = (e as { list?: unknown }).list;
      if (typeof list === "string" && typeof record?.id === "string") {
        noted.push({ list, id: record.id, erasedAt: now, erasedByName: user.name });
      }
    }
    if (keptBin.length !== bin.length) writeTenantCollection(d, "recentlyDeleted", keptBin);

    // Kept as the record that the request was carried out: ids and who did it,
    // never the person's details.
    if (noted.length > 0) writeTenantCollection(d, ERASED, [...readTenantCollection(d, ERASED), ...noted]);

    const { sales } = findCustomerData(d, who);
    res.json({ ok: true, erased, keptSales: sales.length, keptNote: KEPT_NOTE });
  });
}
