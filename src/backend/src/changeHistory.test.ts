import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import {
  readCollection,
  readTenantCollection,
  writeTenantCollection,
  insertChanges,
  listChanges,
  deleteTenantData,
} from "./db.js";
import { entriesForSave, fieldChanges, shown, HIDDEN } from "./changeHistory.js";
import type { StaffRole } from "./auth.js";

// The owner's change history: who changed which record, when, and what it was
// before (changeHistory.ts, routes/changeHistory.ts).

const runId = Date.now();
let counter = 0;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function signup(tag: string) {
  counter += 1;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email: `history-${runId}-${tag}-${counter}@test.local`, password: "historytestpass123", name: `Owner ${tag}`, dealershipName: `History Motors ${tag}` });
  if (!res.body.token) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, id: res.body.user.id as string, d: res.body.user.dealershipId as string };
}

async function join(ownerToken: string, staffRole: StaffRole, name: string) {
  const invite = await request(app).post("/dealership/invite").set(bearer(ownerToken)).send({ inviteeName: name, staffRole });
  counter += 1;
  const res = await request(app)
    .post("/auth/join")
    .send({ token: invite.body.token, name, email: `history-${runId}-staff-${counter}@test.local`, password: "historytestpass123" });
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, id: res.body.user.id as string };
}

const history = async (token: string, query: Record<string, string | number> = {}) =>
  request(app).get("/change-history").query(query).set(bearer(token));

const car = (id: string, extra: Record<string, unknown> = {}) => ({
  id, make: "Ford", model: "Focus", year: 2018, reg: "ab12cde", mileage: 60000, priceRetail: 6500, priceTrade: 5000,
  condition: "good", status: "new", img: "", mot: { expiry: "", advisories: [], historyScore: 0, history: [] },
  depreciationCurve: [], finance: { apr: 0, depositMin: 0, lenderTier: "" }, ...extra,
});
const putStock = (token: string, items: unknown[]) => request(app).put("/inventory").set(bearer(token)).send({ items });

let owner: Awaited<ReturnType<typeof signup>>;
let manager: { token: string; id: string };
let sales: { token: string; id: string };

beforeAll(async () => {
  owner = await signup("main");
  manager = await join(owner.token, "manager", "Morgan Manager");
  sales = await join(owner.token, "sales", "Sam Sales");
});

describe("what gets recorded", () => {
  it("a price change, by name, with what it was before", async () => {
    await putStock(owner.token, [car("c1")]);
    const res = await putStock(sales.token, [car("c1", { priceRetail: 5999 })]);
    expect(res.status).toBe(200);

    const h = await history(owner.token, { area: "Stock" });
    const entry = h.body.entries.find((e: any) => e.recordId === "c1" && e.action === "changed");
    expect(entry).toMatchObject({ actorName: "Sam Sales", actorRole: "sales", area: "Stock", recordLabel: "2018 Ford Focus (AB12CDE)" });
    expect(entry.changes).toEqual([{ field: "priceRetail", before: "6500", after: "5999" }]);
  });

  it("a car added and a car removed, with everything the removed one held", async () => {
    await putStock(owner.token, [car("c1", { priceRetail: 5999 }), car("c2", { make: "Vauxhall", model: "Corsa", reg: "XY99ZZZ" })]);
    const del = await request(app).put("/inventory").set(bearer(manager.token)).send({ items: [car("c1", { priceRetail: 5999 })], deletedIds: ["c2"] });
    expect(del.status).toBe(200);

    const { entries } = (await history(owner.token, { area: "Stock" })).body;
    expect(entries.find((e: any) => e.recordId === "c2" && e.action === "added")).toMatchObject({ actorName: "Owner main" });
    const removed = entries.find((e: any) => e.recordId === "c2" && e.action === "removed");
    expect(removed).toMatchObject({ actorName: "Morgan Manager", recordLabel: "2018 Vauxhall Corsa (XY99ZZZ)" });
    expect(removed.changes).toEqual(expect.arrayContaining([{ field: "make", before: "Vauxhall" }, { field: "priceRetail", before: "6500" }]));
  });

  it("a save that changes nothing, or only what the app works out itself, adds nothing", async () => {
    const before = (await history(owner.token)).body.entries.length;
    await putStock(owner.token, [car("c1", { priceRetail: 5999, riskScore: 42, market: { demandScore: 9 } })]);
    await putStock(owner.token, [car("c1", { priceRetail: 5999, riskScore: 7, colour: "" })]);
    expect((await history(owner.token)).body.entries.length).toBe(before);
  });

  it("Books entries are named by their car", async () => {
    const cost = { id: "k1", vehicleId: "c1", type: "parts", amount: 120, date: "2030-01-05" };
    await request(app).put("/bookkeeping").set(bearer(owner.token)).send({ costs: [cost], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] });
    await request(app)
      .put("/bookkeeping")
      .set(bearer(manager.token))
      .send({ costs: [{ ...cost, amount: 12 }], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] });
    const { entries } = (await history(owner.token, { area: "Books · Costs" })).body;
    const changed = entries.find((e: any) => e.action === "changed");
    expect(changed).toMatchObject({ actorName: "Morgan Manager", recordLabel: "parts £12 on 2018 Ford Focus (AB12CDE)" });
    expect(changed.changes).toEqual([{ field: "amount", before: "120", after: "12" }]);
  });

  it("never stores a secret or a bank number, only that it changed", async () => {
    await request(app).put("/staff").set(bearer(owner.token)).send({ items: [{ id: "s1", name: "Pat", bankAccountNumber: "12345678", wage: 11 }] });
    await request(app).put("/staff").set(bearer(owner.token)).send({ items: [{ id: "s1", name: "Pat", bankAccountNumber: "87654321", wage: 12 }] });
    const { entries } = (await history(owner.token, { area: "Staff records" })).body;
    const changed = entries.find((e: any) => e.action === "changed");
    expect(changed.changes).toEqual(expect.arrayContaining([
      { field: "bankAccountNumber", before: HIDDEN, after: HIDDEN },
      { field: "wage", before: "11", after: "12" },
    ]));
    expect(JSON.stringify(entries)).not.toMatch(/12345678|87654321/);
  });

  it("saves made without anyone signed in (the public booking form, tidy-ups) are not in it", async () => {
    const before = (await history(owner.token)).body.entries.length;
    writeTenantCollection(owner.d, "leads", [{ id: "public-1", name: "Walk In", phone: "07700900001" }]);
    expect((await history(owner.token)).body.entries.length).toBe(before);
  });
});

describe("team and settings", () => {
  it("records a new teammate joining, a role change, the Pilot Brain switch and a removal", async () => {
    const newbie = await join(owner.token, "general", "Gerry General");
    await request(app).put(`/dealership/team/${newbie.id}`).set(bearer(owner.token)).send({ staffRole: "sales" });
    await request(app).put(`/dealership/team/${newbie.id}/pilot-brain-access`).set(bearer(owner.token)).send({ allowed: false });
    await request(app).delete(`/dealership/team/${newbie.id}`).set(bearer(manager.token));

    const team = (await history(owner.token, { area: "Team" })).body.entries.filter((e: any) => e.recordId === newbie.id);
    expect(team.map((e: any) => [e.action, e.actorName, e.changes])).toEqual([
      ["removed", "Morgan Manager", [{ field: "role", before: "sales" }]],
      ["changed", "Owner main", [{ field: "Pilot Brain", before: "allowed", after: "not allowed" }]],
      ["changed", "Owner main", [{ field: "role", before: "general", after: "sales" }]],
      ["added", "Gerry General", [{ field: "role", after: "general" }]],
    ]);
    // and never anything from the stored account
    expect(JSON.stringify(team)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it("records the owner changing the dealership's settings", async () => {
    await request(app).put("/dealership/me").set(bearer(owner.token)).send({ phone: "01803 555 777", autoSignOutMinutes: 60 });
    const entry = (await history(owner.token, { area: "Dealership settings" })).body.entries[0];
    expect(entry.changes).toEqual(expect.arrayContaining([
      { field: "phone", after: "01803 555 777" },
      { field: "autoSignOutMinutes", after: "60" },
    ]));
  });
});

describe("who can read it", () => {
  it("only the owner: managers and staff are refused", async () => {
    expect((await history(owner.token)).status).toBe(200);
    expect((await history(manager.token)).status).toBe(403);
    expect((await history(sales.token)).status).toBe(403);
    expect((await request(app).get("/change-history")).status).toBe(401);
  });

  it("each dealership sees only its own", async () => {
    const other = await signup("other");
    await putStock(other.token, [car("x1", { make: "Other" })]);
    const mine = (await history(owner.token)).body.entries;
    expect(mine.some((e: any) => e.recordId === "x1")).toBe(false);
    const theirs = (await history(other.token)).body.entries;
    expect(theirs.map((e: any) => e.recordId)).toEqual(["x1"]);
    deleteTenantData(other.d);
    expect(listChanges(other.d, { since: "2000-01-01", limit: 10 })).toEqual([]);
  });
});

describe("finding things", () => {
  it("by person, by area, by words, by how far back, a page at a time", async () => {
    const bySam = (await history(owner.token, { person: sales.id })).body;
    expect(bySam.entries.length).toBeGreaterThan(0);
    expect(bySam.entries.every((e: any) => e.actorName === "Sam Sales")).toBe(true);
    expect(bySam.people).toEqual(expect.arrayContaining([{ id: sales.id, name: "Sam Sales" }, { id: manager.id, name: "Morgan Manager" }]));
    expect(bySam.areas).toEqual(expect.arrayContaining(["Stock", "Team"]));

    const words = (await history(owner.token, { search: "corsa" })).body.entries;
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((e: any) => /corsa/i.test(JSON.stringify(e)))).toBe(true);

    // an entry from 10 days ago shows for "30 days" but not for "7 days"
    insertChanges([{ dealershipId: owner.d, at: new Date(Date.now() - 10 * 86_400_000).toISOString(), actorId: owner.id, actorName: "Owner main", actorRole: "owner", area: "Leads", recordId: "old-lead", recordLabel: "Old lead", action: "changed", changes: [] }]);
    expect((await history(owner.token, { days: 30 })).body.entries.some((e: any) => e.recordId === "old-lead")).toBe(true);
    expect((await history(owner.token, { days: 7 })).body.entries.some((e: any) => e.recordId === "old-lead")).toBe(false);

    // a page at a time, newest first, no gaps or repeats
    const rows = Array.from({ length: 130 }, (_, i) => ({ dealershipId: owner.d, at: new Date().toISOString(), actorId: owner.id, actorName: "Owner main", actorRole: "owner", area: "Paging", recordId: `p${i}`, recordLabel: `p${i}`, action: "note" as const, changes: [] }));
    insertChanges(rows);
    const first = (await history(owner.token, { area: "Paging" })).body;
    expect(first.entries).toHaveLength(100);
    expect(first.entries[0].recordId).toBe("p129");
    const second = (await history(owner.token, { area: "Paging", before: first.nextBefore })).body;
    expect(second.entries).toHaveLength(30);
    expect(second.nextBefore).toBeNull();
    expect(new Set([...first.entries, ...second.entries].map((e: any) => e.recordId)).size).toBe(130);
  });

  it("forgets anything older than 90 days", async () => {
    insertChanges([{ dealershipId: owner.d, at: new Date(Date.now() - 91 * 86_400_000).toISOString(), actorId: owner.id, actorName: "Owner main", actorRole: "owner", area: "Leads", recordId: "ancient", recordLabel: "Ancient", action: "changed", changes: [] }]);
    await history(owner.token, { days: 90 });
    expect(listChanges(owner.d, { since: "2000-01-01", limit: 10_000 }).some(e => e.recordId === "ancient")).toBe(false);
  });
});

describe("erasing a customer's details", () => {
  it("takes them out of the history too, leaving only that it was done", async () => {
    await request(app).put("/leads").set(bearer(sales.token)).send({ items: [{ id: "lead-e", name: "Erin Erase", email: "Erin@Example.com", phone: "07700 900123" }] });
    await request(app).put("/leads").set(bearer(sales.token)).send({ items: [{ id: "lead-e", name: "Erin Erase", email: "Erin@Example.com", phone: "07700 900999" }] });
    expect(JSON.stringify(listChanges(owner.d, { since: "2000-01-01", limit: 10_000 }))).toContain("07700 900999");

    const erase = await request(app).post("/customer-data/erase").set(bearer(owner.token)).send({ email: "erin@example.com", confirm: true });
    expect(erase.status).toBe(200);

    const all = JSON.stringify(listChanges(owner.d, { since: "2000-01-01", limit: 10_000 }));
    expect(all).not.toMatch(/Erin|07700 900123|07700 900999|lead-e/i);
    const note = (await history(owner.token, { area: "Customer data" })).body.entries[0];
    expect(note).toMatchObject({ actorName: "Owner main", action: "note", changes: [{ field: "records erased", after: "1" }] });
  });

  it("also where their number was typed into another record, like a job's notes", async () => {
    await request(app).put("/leads").set(bearer(sales.token)).send({ items: [{ id: "lead-f", name: "Fran Forget", phone: "07700 900777" }] });
    await request(app).put("/jobs").set(bearer(owner.token)).send({ items: [{ id: "job-f", title: "Valet", status: "todo" }] });
    await request(app).put("/jobs").set(bearer(owner.token)).send({ items: [{ id: "job-f", title: "Valet", notes: "ring 07700 900777 when done", status: "todo" }] });
    const jobEntry = listChanges(owner.d, { since: "2000-01-01", limit: 10_000 }).find(e => e.recordId === "job-f" && e.action === "changed");
    expect(JSON.stringify(jobEntry)).toContain("07700 900777");

    await request(app).post("/customer-data/erase").set(bearer(owner.token)).send({ phone: "07700900777", confirm: true });
    expect(JSON.stringify(listChanges(owner.d, { since: "2000-01-01", limit: 10_000 }))).not.toContain("07700 900777");
    const note = (await history(owner.token, { area: "Customer data" })).body.entries[0];
    expect(note).toMatchObject({ actorName: "Owner main", action: "note", changes: [{ field: "records erased", after: "1" }] });
  });
});

describe("Download my data", () => {
  it("lists what the person changed, but not other people's details", async () => {
    const res = await request(app).get("/me/data-export").set(bearer(sales.token));
    const mine = res.body.changesYouMade as { at: string; area: string; action: string; fields: string[] }[];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine).toEqual(expect.arrayContaining([expect.objectContaining({ area: "Stock", action: "changed", fields: ["priceRetail"] })]));
    expect(Object.keys(mine[0]!).sort()).toEqual(["action", "area", "at", "fields"]);
    expect(JSON.stringify(mine)).not.toMatch(/Ford|5999|6500/);
  });
});

describe("the pieces", () => {
  it("empty, missing and null are the same; key order doesn't matter", () => {
    expect(fieldChanges({ a: "", b: null, c: { x: 1, y: 2 } }, { c: { y: 2, x: 1 } })).toEqual([]);
    expect(fieldChanges({ a: 1 }, { a: 2, updatedAt: "now" })).toEqual([{ field: "a", before: "1", after: "2" }]);
  });

  it("shows values briefly: pictures, lists and long text", () => {
    expect(shown("data:image/png;base64,AAAA")).toBe("(a picture)");
    expect(shown(["a", "b"])).toBe("a, b");
    expect(shown([{ x: 1 }, { x: 2 }])).toBe("2 items");
    expect(shown("x".repeat(500))).toHaveLength(200);
    expect(shown(0)).toBe("0");
    expect(shown("")).toBeUndefined();
  });

  it("the stored accounts list is never followed", () => {
    // users is saved with writeCollection, not a tenant write, and has no entry
    expect(readCollection("users").length).toBeGreaterThan(0);
    expect(readTenantCollection(owner.d, "users")).toEqual([]);
  });

  it("a settings document is recorded field by field", () => {
    expect(entriesForSave(owner.d, "rotaSettings", { weekStartsOn: 1, minStaff: 2 }, { weekStartsOn: 0, minStaff: 2 })).toEqual([
      { area: "Rota settings", recordId: "rotaSettings", recordLabel: "Rota settings", action: "changed", changes: [{ field: "weekStartsOn", before: "1", after: "0" }] },
    ]);
    expect(entriesForSave(owner.d, "rotaSettings", { a: 1 }, { a: 1 })).toEqual([]);
    expect(entriesForSave(owner.d, "pilotBrainMessages", [], [{ id: "m" }])).toEqual([]);
  });

  it("clock-ins added every day aren't listed, but an edited one is", () => {
    expect(entriesForSave(owner.d, "timekeeping", [], [{ id: "t1", userId: sales.id, in: "09:00" }])).toEqual([]);
    const edited = entriesForSave(owner.d, "timekeeping", [{ id: "t1", userId: sales.id, in: "09:00" }], [{ id: "t1", userId: sales.id, in: "07:00" }]);
    expect(edited).toEqual([
      { area: "Clock-ins", recordId: "t1", recordLabel: "for Sam Sales", action: "changed", changes: [{ field: "in", before: "09:00", after: "07:00" }] },
    ]);
  });
});
