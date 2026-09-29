import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Whole-list saves can't wipe a list any more, and whatever is removed from
// leads, jobs, contacts or consumables waits in "Recently deleted" for 30
// days (recycleBin.ts). Checked through the real routes with real accounts.
//
// Its own private database (see roleGates.test.ts for why).
vi.hoisted(() => {
  const shared = process.env.DATA_DIR;
  if (!shared) throw new Error("DATA_DIR is not set — run these tests through vitest.config.ts so they use the private test database");
  process.env.DATA_DIR = `${shared}/recycle-bin-${process.pid}`;
});

import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, readTenantCollection, writeTenantCollection, deleteTenantData } from "./db.js";
import { BIN_DAYS, removedRecords, tooManyRemoved } from "./recycleBin.js";

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
  const email = `recycle-bin-${runId}-${suffix}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "recyclebintestpass123",
    name: `Owner ${suffix}`,
    dealershipName: `Recycle Bin ${suffix}`,
  });
  cleanupEmails.push(email);
  cleanupDealershipIds.push(res.body.user.dealershipId);
  return { token: res.body.token, id: res.body.user.id, dealershipId: res.body.user.dealershipId };
}

let joined = 0;
async function joinAs(owner: Account, staffRole: string): Promise<Account> {
  joined += 1;
  const invite = await request(app).post("/dealership/invite").set("Authorization", `Bearer ${owner.token}`).send({ inviteeName: `Staff ${joined}`, staffRole });
  const email = `recycle-bin-${runId}-staff-${joined}@test.local`;
  const res = await request(app).post("/auth/join").send({ token: invite.body.token, name: `${staffRole} person`, email, password: "recyclebinjoinpass123" });
  cleanupEmails.push(email);
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, id: res.body.user.id, dealershipId: owner.dealershipId };
}

const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
const rows = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, name: `${prefix} ${i}`, title: `${prefix} ${i}` }));

let owner: Account;
let manager: Account;
let sales: Account;
let general: Account;
beforeAll(async () => {
  owner = await signup("shop");
  manager = await joinAs(owner, "manager");
  sales = await joinAs(owner, "sales");
  general = await joinAs(owner, "general");
});

describe("the brake on whole-list saves", () => {
  it("counts what a save would remove, by id", () => {
    expect(removedRecords([{ id: "a" }, { id: "b" }, { id: "c" }], [{ id: "a" }]).map(r => r.id)).toEqual(["b", "c"]);
    expect(tooManyRemoved("leads", rows("x", 5), rows("x", 4))).toBeNull();
    expect(tooManyRemoved("leads", rows("x", 5), rows("x", 3))).toBe(2);
    expect(tooManyRemoved("contacts", rows("x", 5), rows("x", 4))).toBe(1);
  });

  it("an out-of-date screen can't wipe the leads, even the owner's: refused, nothing written", async () => {
    writeTenantCollection(owner.dealershipId, "leads", rows("lead", 10));
    const res = await request(app).put("/leads").set(auth(owner)).send({ items: rows("lead", 3) });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/removed 7 leads at once/);
    expect(readTenantCollection(owner.dealershipId, "leads")).toHaveLength(10);
  });

  it("removing one lead still works, and it goes to Recently deleted", async () => {
    writeTenantCollection(owner.dealershipId, "leads", rows("lead", 10));
    const res = await request(app).put("/leads").set(auth(sales)).send({ items: rows("lead", 10).filter(l => l.id !== "lead-4") });
    expect(res.status).toBe(200);
    expect(readTenantCollection(owner.dealershipId, "leads")).toHaveLength(9);
    const bin = await request(app).get("/recently-deleted").set(auth(manager));
    expect(bin.body.keptForDays).toBe(BIN_DAYS);
    expect(bin.body.items.find((e: any) => e.label === "lead 4")).toMatchObject({ list: "leads", deletedBy: "sales person" });
  });

  it("the jobs list can't lose more than one at a time either", async () => {
    writeTenantCollection(owner.dealershipId, "jobs", rows("job", 6));
    expect((await request(app).put("/jobs").set(auth(owner)).send({ items: [] })).status).toBe(409);
    expect(readTenantCollection(owner.dealershipId, "jobs")).toHaveLength(6);
    expect((await request(app).put("/jobs").set(auth(owner)).send({ items: rows("job", 5) })).status).toBe(200);
  });

  it("the contacts and consumables list saves can't remove anything; Remove goes through their own route", async () => {
    for (const list of ["contacts", "consumables"] as const) {
      writeTenantCollection(owner.dealershipId, list, rows(list, 4));
      const wipe = await request(app).put(`/${list}`).set(auth(general)).send({ items: [] });
      expect(wipe.status, list).toBe(409);
      expect(wipe.body.error).toMatch(/can't remove any/);
      expect(readTenantCollection(owner.dealershipId, list)).toHaveLength(4);
      // Editing still works: the same records, changed.
      const edited = rows(list, 4).map(r => ({ ...r, name: `${r.name} (edited)` }));
      expect((await request(app).put(`/${list}`).set(auth(general)).send({ items: edited })).status).toBe(200);
      // And Remove keeps it in the bin.
      expect((await request(app).delete(`/${list}/${list}-2`).set(auth(general))).status).toBe(200);
      expect(readTenantCollection(owner.dealershipId, list)).toHaveLength(3);
    }
    const bin = await request(app).get("/recently-deleted").set(auth(owner));
    expect(bin.body.items.filter((e: any) => e.list === "contacts" || e.list === "consumables")).toHaveLength(2);
  });
});

describe("Recently deleted", () => {
  it("is for the owner and managers only", async () => {
    for (const who of [sales, general]) expect((await request(app).get("/recently-deleted").set(auth(who))).status).toBe(403);
    expect((await request(app).get("/recently-deleted").set(auth(manager))).status).toBe(200);
  });

  it("puts a record back where it was, once", async () => {
    writeTenantCollection(owner.dealershipId, "contacts", rows("restore", 2));
    await request(app).delete("/contacts/restore-1").set(auth(sales));
    const bin = await request(app).get("/recently-deleted").set(auth(manager));
    const entry = bin.body.items.find((e: any) => e.label === "restore 1");
    const res = await request(app).post(`/recently-deleted/${entry.id}/restore`).set(auth(manager));
    expect(res.status).toBe(200);
    expect(readTenantCollection<any>(owner.dealershipId, "contacts").map(c => c.id).sort()).toEqual(["restore-0", "restore-1"]);
    // It left the bin, so a second restore finds nothing.
    expect((await request(app).post(`/recently-deleted/${entry.id}/restore`).set(auth(manager))).status).toBe(404);
  });

  it("deletes for good when asked, and staff can't", async () => {
    writeTenantCollection(owner.dealershipId, "consumables", rows("forgood", 1));
    await request(app).delete("/consumables/forgood-0").set(auth(general));
    const entry = (await request(app).get("/recently-deleted").set(auth(owner))).body.items.find((e: any) => e.label === "forgood 0");
    expect((await request(app).delete(`/recently-deleted/${entry.id}`).set(auth(sales))).status).toBe(403);
    expect((await request(app).delete(`/recently-deleted/${entry.id}`).set(auth(owner))).status).toBe(200);
    const after = (await request(app).get("/recently-deleted").set(auth(owner))).body.items;
    expect(after.find((e: any) => e.id === entry.id)).toBeUndefined();
  });

  it("forgets anything older than the time it keeps things for, and drops it from storage on the read that notices", async () => {
    const old = new Date(Date.now() - (BIN_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date().toISOString();
    writeTenantCollection(owner.dealershipId, "recentlyDeleted", [
      { id: "old-entry", list: "leads", record: { id: "ancient", name: "Ancient lead" }, deletedAt: old, deletedBy: { id: "x", name: "x" } },
      { id: "fresh-entry", list: "leads", record: { id: "new", name: "New lead" }, deletedAt: recent, deletedBy: { id: "x", name: "x" } },
    ]);
    const items = (await request(app).get("/recently-deleted").set(auth(owner))).body.items;
    expect(items.find((e: any) => e.id === "old-entry")).toBeUndefined();
    // A dealership that never deletes or restores anything else would
    // otherwise keep an expired lead's full record in storage forever:
    // the read itself has to forget it, not just hide it in the response.
    expect(readTenantCollection<any>(owner.dealershipId, "recentlyDeleted").map((e: any) => e.id)).toEqual(["fresh-entry"]);
  });

  it("belongs to one dealership: another can't see or restore it", async () => {
    const other = await signup("other");
    writeTenantCollection(owner.dealershipId, "contacts", rows("mine", 1));
    await request(app).delete("/contacts/mine-0").set(auth(owner));
    const entry = (await request(app).get("/recently-deleted").set(auth(owner))).body.items.find((e: any) => e.label === "mine 0");
    expect((await request(app).get("/recently-deleted").set(auth(other))).body.items).toHaveLength(0);
    expect((await request(app).post(`/recently-deleted/${entry.id}/restore`).set(auth(other))).status).toBe(404);
  });
});
