import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

// A real customer database, deliberately separate from both Leads
// (the sales pipeline — no consent concept, no life after "won"/"lost")
// and Contacts (the dealer's own supplier/auction-house address book).
// This is the real foundation for any future stock-alert or dealer-list
// messaging feature — built first, on its own, with zero send
// capability yet, because UK law (PECR + UK GDPR) requires real,
// recorded consent before a dealer can email or WhatsApp someone
// marketing content. Consent always defaults to "not_asked", never
// "opted_in" — silently assuming consent here would be exactly the
// kind of compliance mistake this record exists to prevent.

export type ConsentStatus = "not_asked" | "opted_in" | "opted_out";

export interface MarketingConsent {
  status: ConsentStatus;
  method?: string; // e.g. "verbal at purchase", "web form", "existing customer soft opt-in"
  consentedAt?: string; // ISO — only meaningful when status is "opted_in"
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  vehicleInterests?: string; // free text — what they've bought/shown interest in, for future stock-matching
  tags?: string[]; // optional lightweight segmentation (e.g. "SUV", "under 15k")
  emailConsent: MarketingConsent;
  whatsappConsent: MarketingConsent;
  sourceLeadId?: string; // optional link back to the lead they came from, if any
  notes?: string;
  createdAt: string;
  createdByName: string;
  updatedAt: string;
}

const DEFAULT_CONSENT: MarketingConsent = { status: "not_asked" };

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

function readCustomers(dealershipId: string): Customer[] {
  return readTenantCollection<Customer>(dealershipId, "customers");
}

function writeCustomers(dealershipId: string, items: Customer[]): void {
  writeTenantCollection(dealershipId, "customers", items);
}

function parseConsent(input: unknown): MarketingConsent {
  if (!input || typeof input !== "object") return { ...DEFAULT_CONSENT };
  const { status, method, consentedAt } = input as Record<string, unknown>;
  const validStatuses: ConsentStatus[] = ["not_asked", "opted_in", "opted_out"];
  const resolvedStatus: ConsentStatus = validStatuses.includes(status as ConsentStatus)
    ? (status as ConsentStatus)
    : "not_asked";
  return {
    status: resolvedStatus,
    ...(typeof method === "string" && method.trim() ? { method: method.trim() } : {}),
    ...(resolvedStatus === "opted_in"
      ? { consentedAt: typeof consentedAt === "string" && consentedAt ? consentedAt : new Date().toISOString() }
      : {}),
  };
}

export default function registerCustomersRoute(app: Express) {
  app.get("/customers", (req, res) => {
    const user = authedUser(req);
    res.json({ ok: true, items: readCustomers(user.dealershipId) });
  });

  // Full-array replace, matching the same pattern used by
  // leads/contacts — bulk edits from a table-style UI go through here.
  app.put("/customers", (req, res) => {
    const user = authedUser(req);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeCustomers(user.dealershipId, items);
    res.json({ ok: true, items });
  });

  app.post("/customers", (req, res) => {
    const user = authedUser(req);
    const { name, email, phone, vehicleInterests, tags, emailConsent, whatsappConsent, sourceLeadId, notes } =
      req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ ok: false, error: "name is required" });
    }
    if (!email && !phone) {
      return res.status(400).json({ ok: false, error: "At least one of email or phone is required" });
    }

    const now = new Date().toISOString();
    const entry: Customer = {
      id: randomUUID(),
      name: name.trim(),
      ...(typeof email === "string" && email.trim() ? { email: email.trim() } : {}),
      ...(typeof phone === "string" && phone.trim() ? { phone: phone.trim() } : {}),
      ...(typeof vehicleInterests === "string" && vehicleInterests.trim()
        ? { vehicleInterests: vehicleInterests.trim() }
        : {}),
      ...(Array.isArray(tags) && tags.length > 0 ? { tags: tags.filter((t: unknown) => typeof t === "string") } : {}),
      emailConsent: parseConsent(emailConsent),
      whatsappConsent: parseConsent(whatsappConsent),
      ...(typeof sourceLeadId === "string" && sourceLeadId ? { sourceLeadId } : {}),
      ...(typeof notes === "string" && notes.trim() ? { notes: notes.trim() } : {}),
      createdAt: now,
      createdByName: user.name,
      updatedAt: now,
    };

    const items = readCustomers(user.dealershipId);
    writeCustomers(user.dealershipId, [...items, entry]);
    res.json({ ok: true, entry });
  });

  // Partial update — the main real use is toggling consent status (a
  // customer calls to opt in/out, or a staff member records consent
  // given at purchase), so this deliberately doesn't require
  // round-tripping the whole array the way the bulk PUT above does.
  app.put("/customers/:id", (req, res) => {
    const user = authedUser(req);
    const items = readCustomers(user.dealershipId);
    const existing = items.find(c => c.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Customer not found" });
    }

    const { name, email, phone, vehicleInterests, tags, emailConsent, whatsappConsent, notes } = req.body ?? {};

    // Building via a mutable record rather than object-spread with
    // `undefined` values — exactOptionalPropertyTypes treats `{ email:
    // undefined }` as different from the key being absent, so clearing
    // an optional field has to actually delete the key.
    const draft: Record<string, unknown> = { ...existing };
    function setOrClear(key: string, raw: unknown) {
      if (raw === undefined) return; // field not sent — leave existing value untouched
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      if (trimmed) draft[key] = trimmed;
      else delete draft[key];
    }

    if (typeof name === "string" && name.trim()) draft.name = name.trim();
    setOrClear("email", email);
    setOrClear("phone", phone);
    setOrClear("vehicleInterests", vehicleInterests);
    setOrClear("notes", notes);
    if (Array.isArray(tags)) draft.tags = tags.filter((t: unknown) => typeof t === "string");
    if (emailConsent !== undefined) draft.emailConsent = parseConsent(emailConsent);
    if (whatsappConsent !== undefined) draft.whatsappConsent = parseConsent(whatsappConsent);
    draft.updatedAt = new Date().toISOString();

    const updated = draft as unknown as Customer;

    writeCustomers(user.dealershipId, items.map(c => (c.id === req.params.id ? updated : c)));
    res.json({ ok: true, entry: updated });
  });

  // A customer's real right to erasure under UK GDPR — a working
  // delete here isn't just tidiness, it's a compliance requirement.
  app.delete("/customers/:id", (req, res) => {
    const user = authedUser(req);
    const items = readCustomers(user.dealershipId);
    writeCustomers(user.dealershipId, items.filter(c => c.id !== req.params.id));
    res.json({ ok: true });
  });
}
