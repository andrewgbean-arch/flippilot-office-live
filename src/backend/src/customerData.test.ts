import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// A customer's request to see, or erase, what the dealership holds about them
// (customerData.ts). Checked through the real routes with real accounts.
//
// Its own private database (see roleGates.test.ts for why).
vi.hoisted(() => {
  const shared = process.env.DATA_DIR;
  if (!shared) throw new Error("DATA_DIR is not set — run these tests through vitest.config.ts so they use the private test database");
  process.env.DATA_DIR = `${shared}/customer-data-${process.pid}`;
});

import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, readTenantCollection, writeTenantCollection, readTenantDoc, writeTenantDoc, deleteTenantData } from "./db.js";
import { normaliseEmail, normalisePhone } from "./customerData.js";

const runId = Date.now();
const cleanupEmails: string[] = [];
const cleanupDealershipIds: string[] = [];

afterAll(() => {
  writeCollection("users", readCollection<any>("users").filter(u => !cleanupEmails.includes(u.email)));
  writeCollection("dealerships", readCollection<any>("dealerships").filter(d => !cleanupDealershipIds.includes(d.id)));
  for (const id of cleanupDealershipIds) deleteTenantData(id);
});

interface Account { token: string; id: string; dealershipId: string }

async function signup(suffix: string): Promise<Account> {
  const email = `customer-data-${runId}-${suffix}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email, password: "customerdatapass123", name: `Owner ${suffix}`, dealershipName: `Customer Data ${suffix}`,
  });
  cleanupEmails.push(email);
  cleanupDealershipIds.push(res.body.user.dealershipId);
  return { token: res.body.token, id: res.body.user.id, dealershipId: res.body.user.dealershipId };
}

let joined = 0;
async function joinAs(owner: Account, staffRole: string): Promise<Account> {
  joined += 1;
  const invite = await request(app).post("/dealership/invite").set("Authorization", `Bearer ${owner.token}`).send({ inviteeName: `Staff ${joined}`, staffRole });
  const email = `customer-data-${runId}-staff-${joined}@test.local`;
  const res = await request(app).post("/auth/join").send({ token: invite.body.token, name: `${staffRole} person`, email, password: "customerdatajoin123" });
  cleanupEmails.push(email);
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, id: res.body.user.id, dealershipId: owner.dealershipId };
}

const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
const search = (a: Account, body: object) => request(app).post("/customer-data/search").set(auth(a)).send(body);
const erase = (a: Account, body: object) => request(app).post("/customer-data/erase").set(auth(a)).send(body);
const ids = (d: string, c: string) => readTenantCollection<{ id: string }>(d, c).map(r => r.id).sort();

// Jo Buyer (jo@example.test / 07700 900123) is in every place, written in
// different ways; Sam Other is in the same places and must never be touched.
function seed(d: string) {
  writeTenantCollection(d, "leads", [
    { id: "lead-jo", name: "Jo Buyer", email: "  JO@Example.test ", status: "new", source: "web", createdAt: "2026-09-01" },
    { id: "lead-sam", name: "Sam Other", email: "sam@example.test", phone: "07700 900999", status: "new", source: "web", createdAt: "2026-09-01" },
  ]);
  writeTenantCollection(d, "appointments", [
    { id: "appt-jo", customerName: "Jo Buyer", customerPhone: "+44 7700 900123", vehicleLabel: "Golf", type: "viewing", status: "pending", requestedDate: "2026-10-01", requestedTime: "10:00", createdAt: "2026-09-01" },
    { id: "appt-sam", customerName: "Sam Other", customerPhone: "07700900999", vehicleLabel: "Polo", type: "viewing", status: "pending", requestedDate: "2026-10-01", requestedTime: "11:00", createdAt: "2026-09-01" },
  ]);
  writeTenantCollection(d, "customers", [
    { id: "cust-jo", name: "Jo Buyer", phone: "07700-900-123", emailConsent: { status: "opted_in" }, whatsappConsent: { status: "not_asked" }, createdAt: "x", createdByName: "x", updatedAt: "x" },
    { id: "cust-sam", name: "Sam Other", email: "sam@example.test", emailConsent: { status: "not_asked" }, whatsappConsent: { status: "not_asked" }, createdAt: "x", createdByName: "x", updatedAt: "x" },
  ]);
  writeTenantCollection(d, "wantedRequests", [
    { id: "want-jo", name: "Jo Buyer", email: "jo@example.test", status: "open", consent: { at: "x", wording: "x" }, createdAt: "x", askedAt: "x" },
  ]);
  writeTenantCollection(d, "contacts", [
    { id: "contact-jo", name: "Jo Buyer", category: "other", email: "jo@example.test" },
    { id: "contact-parts", name: "Parts R Us", category: "parts_supplier", email: "sales@parts.test" },
  ]);
  writeTenantCollection(d, "recentlyDeleted", [
    { id: "bin-jo", list: "leads", record: { id: "old-lead-jo", name: "Jo Buyer", phone: "07700900123" }, deletedAt: new Date().toISOString(), deletedBy: { id: "x", name: "x" } },
    { id: "bin-sam", list: "leads", record: { id: "old-lead-sam", name: "Sam Other", phone: "07700900999" }, deletedAt: new Date().toISOString(), deletedBy: { id: "x", name: "x" } },
  ]);
  writeTenantDoc(d, "bookkeeping", {
    costs: [], purchases: [], transactions: [], suppliers: [], categories: [],
    sales: [
      { id: "sale-jo", vehicleId: "v1", salePrice: 5000, buyer: "Jo Buyer", buyerEmail: "jo@example.test", buyerAddress: "1 High St", invoiceNumber: "INV-1", date: "2026-09-10" },
      { id: "sale-sam", vehicleId: "v2", salePrice: 6000, buyer: "Sam Other", buyerEmail: "sam@example.test", invoiceNumber: "INV-2", date: "2026-09-11" },
    ],
  });
}

let owner: Account;
let manager: Account;
let sales: Account;
beforeAll(async () => {
  owner = await signup("shop");
  manager = await joinAs(owner, "manager");
  sales = await joinAs(owner, "sales");
});

describe("matching", () => {
  it("treats the same email or phone written differently as the same", () => {
    expect(normaliseEmail("  JO@Example.test ")).toBe("jo@example.test");
    expect(normalisePhone("+44 7700 900123")).toBe("07700900123");
    expect(normalisePhone("07700-900-123")).toBe("07700900123");
    expect(normalisePhone("123")).toBeNull();
    expect(normaliseEmail("not an email")).toBeNull();
  });
});

describe("finding what we hold about someone", () => {
  it("finds Jo in every place by email OR phone, and nobody else", async () => {
    seed(owner.dealershipId);
    const res = await search(manager, { email: "jo@example.test", phone: "07700 900123" });
    expect(res.status).toBe(200);
    const byPlace = Object.fromEntries(res.body.places.map((p: { key: string; records: { id: string }[] }) => [p.key, p.records.map(r => r.id)]));
    expect(byPlace).toEqual({
      leads: ["lead-jo"], appointments: ["appt-jo"], customers: ["cust-jo"], wantedRequests: ["want-jo"], contacts: ["contact-jo"],
    });
    expect(res.body.recentlyDeleted.map((e: { id: string }) => e.id)).toEqual(["bin-jo"]);
    expect(res.body.keptSales.map((s: { id: string }) => s.id)).toEqual(["sale-jo"]);
    expect(JSON.stringify(res.body)).not.toContain("Sam Other");
  });

  it("needs an email or a phone number, and refuses a malformed one", async () => {
    expect((await search(manager, {})).status).toBe(400);
    expect((await search(manager, { name: "Jo Buyer" })).status).toBe(400);
    expect((await search(manager, { email: "nope" })).status).toBe(400);
  });

  it("is for the owner and managers only", async () => {
    expect((await search(sales, { email: "jo@example.test" })).status).toBe(403);
    expect((await erase(sales, { email: "jo@example.test", confirm: true })).status).toBe(403);
  });
});

describe("erasing it", () => {
  it("erases Jo everywhere except sales, leaves Sam alone, and says what was kept", async () => {
    seed(owner.dealershipId);
    const d = owner.dealershipId;
    const res = await erase(owner, { email: "jo@example.test", phone: "07700900123", confirm: true });
    expect(res.status).toBe(200);
    expect(res.body.erased).toEqual({ leads: 1, appointments: 1, customers: 1, wantedRequests: 1, contacts: 1, recentlyDeleted: 1 });
    expect(res.body.keptSales).toBe(1);
    expect(res.body.keptNote).toMatch(/six years for HMRC/);

    expect(ids(d, "leads")).toEqual(["lead-sam"]);
    expect(ids(d, "appointments")).toEqual(["appt-sam"]);
    expect(ids(d, "customers")).toEqual(["cust-sam"]);
    expect(ids(d, "wantedRequests")).toEqual([]);
    expect(ids(d, "contacts")).toEqual(["contact-parts"]);
    expect(ids(d, "recentlyDeleted")).toEqual(["bin-sam"]);
    const sales = readTenantDoc<{ sales: { id: string }[] }>(d, "bookkeeping", { sales: [] }).sales.map(s => s.id).sort();
    expect(sales).toEqual(["sale-jo", "sale-sam"]);

    // Searching again finds only the kept sale.
    const again = await search(owner, { email: "jo@example.test" });
    expect(again.body.places.every((p: { records: unknown[] }) => p.records.length === 0)).toBe(true);
    expect(again.body.keptSales).toHaveLength(1);
  });

  it("the record of the erasure holds ids and who did it, never the person's details", async () => {
    const log = readTenantCollection<Record<string, unknown>>(owner.dealershipId, "erasedRecords");
    expect(log.length).toBeGreaterThan(0);
    expect(JSON.stringify(log)).not.toMatch(/Jo Buyer|jo@example|07700/);
    expect(log.every(e => typeof e.id === "string" && typeof e.list === "string" && typeof e.erasedByName === "string")).toBe(true);
  });

  it("needs confirm: true", async () => {
    seed(owner.dealershipId);
    const res = await erase(owner, { email: "jo@example.test" });
    expect(res.status).toBe(400);
    expect(ids(owner.dealershipId, "leads")).toContain("lead-jo");
  });

  it("an old screen can't bring an erased lead, customer or contact back", async () => {
    const shop = await signup("stale");
    const d = shop.dealershipId;
    seed(d);
    // What an open browser tab still holds from before the erasure.
    const staleLeads = readTenantCollection(d, "leads");
    const staleCustomers = readTenantCollection(d, "customers");
    const staleContacts = readTenantCollection(d, "contacts");
    expect((await erase(shop, { email: "jo@example.test", phone: "07700900123", confirm: true })).status).toBe(200);

    const leads = await request(app).put("/leads").set(auth(shop)).send({ items: [...staleLeads, { id: "lead-new", name: "New", status: "new", source: "web", createdAt: "x" }] });
    expect(leads.status).toBe(200);
    expect(ids(d, "leads")).toEqual(["lead-new", "lead-sam"]);

    expect((await request(app).put("/customers").set(auth(shop)).send({ items: staleCustomers })).status).toBe(200);
    expect(ids(d, "customers")).toEqual(["cust-sam"]);

    expect((await request(app).put("/contacts").set(auth(shop)).send({ items: staleContacts })).status).toBe(200);
    expect(ids(d, "contacts")).toEqual(["contact-parts"]);
  });

  it("never touches another dealership", async () => {
    const other = await signup("other");
    seed(other.dealershipId);
    seed(owner.dealershipId);
    expect((await erase(owner, { email: "jo@example.test", phone: "07700900123", confirm: true })).status).toBe(200);
    expect(ids(other.dealershipId, "leads")).toEqual(["lead-jo", "lead-sam"]);
    expect(ids(other.dealershipId, "customers")).toEqual(["cust-jo", "cust-sam"]);
  });
});
