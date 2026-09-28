import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, readTenantCollection, writeTenantCollection } from "./db.js";

// Removing a teammate used to leave behind everything only they could ever
// see: their private diary, their notifications, their chat with Pilot Brain
// and the facts she remembered about them. Nobody could open any of it again,
// so it was personal data kept for no one. It is now erased with the account,
// while records of work done (clock-ins, leave, pay) are kept as before.
//
// Separately, anyone can now see and delete what Pilot Brain remembers about
// them, even when Pilot Brain is switched off for them or no longer paid for.

vi.setConfig({ testTimeout: 90_000 });

const runId = Date.now();
let counter = 0;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function signup(tag: string) {
  counter += 1;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email: `pd-${runId}-${tag}-${counter}@test.local`, password: "personaldatapass1", name: `PD ${tag}`, dealershipName: `PD Motors ${tag} ${counter}` });
  if (!res.body.token) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, user: res.body.user as { id: string; dealershipId: string } };
}

async function joinStaff(ownerToken: string, staffRole: "sales" | "manager" | "general" = "sales") {
  const invite = await request(app).post("/dealership/invite").set(bearer(ownerToken)).send({ inviteeName: "PD Staff", staffRole });
  if (!invite.body.token) throw new Error(`invite failed: ${JSON.stringify(invite.body)}`);
  counter += 1;
  const res = await request(app)
    .post("/auth/join")
    .send({ token: invite.body.token, name: "PD Staff", email: `pd-${runId}-staff-${counter}@test.local`, password: "personaldatapass1" });
  if (!res.body.token) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, user: res.body.user as { id: string; dealershipId: string } };
}

type Row = { id: string; userId: string | null } & Record<string, unknown>;
const rows = (d: string, c: string) => readTenantCollection<Row>(d, c);
const add = (d: string, c: string, row: Row) => writeTenantCollection(d, c, [...rows(d, c), row]);

// One of everything that belongs to `userId`, of each kind.
function giveDataTo(d: string, userId: string, tag: string) {
  const now = new Date().toISOString();
  add(d, "diary", { id: `diary-${tag}`, userId, date: "2026-09-28", text: `private note ${tag}`, isTask: false, done: false, createdAt: now });
  add(d, "notifications", { id: `note-${tag}`, userId, title: "t", message: "m", type: "info", createdAt: now, readAt: null });
  add(d, "pilotBrainMessages", { id: `msg-${tag}`, userId, role: "user", content: `asked something ${tag}`, createdAt: now });
  add(d, "pilotBrainMemories", { id: `mem-${tag}`, userId, fact: `prefers mornings ${tag}`, createdAt: now });
  add(d, "timekeeping", { id: `clock-${tag}`, userId, userName: "PD Staff", clockIn: now });
  add(d, "leave", { id: `leave-${tag}`, userId, userName: "PD Staff", status: "approved", startDate: "2026-01-02", endDate: "2026-01-03" });
}
const ids = (d: string, c: string) => rows(d, c).map(r => r.id);

describe("removing a teammate erases what only they could see", () => {
  it("their diary, notifications and Pilot Brain chat and memories go; work records and everyone else's stay", async () => {
    const owner = await signup("remove");
    const leaver = await joinStaff(owner.token);
    const stayer = await joinStaff(owner.token);
    const d = owner.user.dealershipId;
    giveDataTo(d, leaver.user.id, "leaver");
    giveDataTo(d, stayer.user.id, "stayer");
    giveDataTo(d, owner.user.id, "owner");

    const res = await request(app).delete(`/dealership/team/${leaver.user.id}`).set(bearer(owner.token));
    expect(res.status).toBe(200);

    for (const c of ["diary", "notifications", "pilotBrainMessages", "pilotBrainMemories"]) {
      const left = rows(d, c);
      expect(left.some(r => r.userId === leaver.user.id), c).toBe(false);
      expect(left.some(r => r.userId === stayer.user.id), c).toBe(true);
      expect(left.some(r => r.userId === owner.user.id), c).toBe(true);
    }
    // Records of work done are kept.
    expect(ids(d, "timekeeping")).toContain("clock-leaver");
    expect(ids(d, "leave")).toContain("leave-leaver");
  });

  it("another dealership's data is never touched, even for the same user id", async () => {
    const owner = await signup("iso-a");
    const other = await signup("iso-b");
    const leaver = await joinStaff(owner.token);
    giveDataTo(other.user.dealershipId, leaver.user.id, "elsewhere");

    expect((await request(app).delete(`/dealership/team/${leaver.user.id}`).set(bearer(owner.token))).status).toBe(200);
    expect(ids(other.user.dealershipId, "diary")).toContain("diary-elsewhere");
    expect(ids(other.user.dealershipId, "pilotBrainMemories")).toContain("mem-elsewhere");
  });

  it("a refused removal (a sales person trying) erases nothing", async () => {
    const owner = await signup("refused");
    const sales = await joinStaff(owner.token, "sales");
    const target = await joinStaff(owner.token, "general");
    const d = owner.user.dealershipId;
    giveDataTo(d, target.user.id, "target");

    expect((await request(app).delete(`/dealership/team/${target.user.id}`).set(bearer(sales.token))).status).toBe(403);
    expect(ids(d, "diary")).toContain("diary-target");
    expect(ids(d, "pilotBrainMemories")).toContain("mem-target");
  });
});

describe("what Pilot Brain remembers about me", () => {
  it("I see only my own memories, newest first", async () => {
    const owner = await signup("list");
    const staff = await joinStaff(owner.token);
    const d = owner.user.dealershipId;
    add(d, "pilotBrainMemories", { id: "m-old", userId: staff.user.id, fact: "old fact", createdAt: "2026-01-01T00:00:00.000Z" });
    add(d, "pilotBrainMemories", { id: "m-new", userId: staff.user.id, fact: "new fact", createdAt: "2026-02-01T00:00:00.000Z" });
    add(d, "pilotBrainMemories", { id: "m-owner", userId: owner.user.id, fact: "owner fact", createdAt: "2026-03-01T00:00:00.000Z" });

    const res = await request(app).get("/me/pilot-brain-memories").set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.memories.map((m: { id: string }) => m.id)).toEqual(["m-new", "m-old"]);
  });

  it("I can delete one of mine, but not someone else's (404, and it stays)", async () => {
    const owner = await signup("one");
    const staff = await joinStaff(owner.token);
    const d = owner.user.dealershipId;
    add(d, "pilotBrainMemories", { id: "mine-1", userId: staff.user.id, fact: "a", createdAt: "2026-01-01T00:00:00.000Z" });
    add(d, "pilotBrainMemories", { id: "mine-2", userId: staff.user.id, fact: "b", createdAt: "2026-01-02T00:00:00.000Z" });
    add(d, "pilotBrainMemories", { id: "owners-1", userId: owner.user.id, fact: "c", createdAt: "2026-01-03T00:00:00.000Z" });

    expect((await request(app).delete("/me/pilot-brain-memories/mine-1").set(bearer(staff.token))).status).toBe(200);
    const notMine = await request(app).delete("/me/pilot-brain-memories/owners-1").set(bearer(staff.token));
    expect(notMine.status).toBe(404);
    expect(ids(d, "pilotBrainMemories").sort()).toEqual(["mine-2", "owners-1"]);
  });

  it("forget everything clears only mine", async () => {
    const owner = await signup("all");
    const staff = await joinStaff(owner.token);
    const d = owner.user.dealershipId;
    add(d, "pilotBrainMemories", { id: "s1", userId: staff.user.id, fact: "a", createdAt: "2026-01-01T00:00:00.000Z" });
    add(d, "pilotBrainMemories", { id: "s2", userId: staff.user.id, fact: "b", createdAt: "2026-01-02T00:00:00.000Z" });
    add(d, "pilotBrainMemories", { id: "o1", userId: owner.user.id, fact: "c", createdAt: "2026-01-03T00:00:00.000Z" });

    const res = await request(app).delete("/me/pilot-brain-memories").set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(2);
    expect(ids(d, "pilotBrainMemories")).toEqual(["o1"]);
  });

  it("still works when the owner has switched Pilot Brain off for me", async () => {
    const owner = await signup("switched-off");
    const staff = await joinStaff(owner.token);
    const d = owner.user.dealershipId;
    const users = readCollection<{ id: string; pilotBrainAllowed?: boolean }>("users");
    users.find(u => u.id === staff.user.id)!.pilotBrainAllowed = false;
    writeCollection("users", users);
    add(d, "pilotBrainMemories", { id: "off-1", userId: staff.user.id, fact: "a", createdAt: "2026-01-01T00:00:00.000Z" });

    // Pilot Brain itself is closed to them...
    expect((await request(app).get("/pilot-brain/memories").set(bearer(staff.token))).status).toBe(403);
    // ...but their own data is not.
    expect((await request(app).get("/me/pilot-brain-memories").set(bearer(staff.token))).body.memories).toHaveLength(1);
    expect((await request(app).delete("/me/pilot-brain-memories").set(bearer(staff.token))).status).toBe(200);
    expect(ids(d, "pilotBrainMemories")).toEqual([]);
  });

  it("needs a login", async () => {
    expect((await request(app).get("/me/pilot-brain-memories")).status).toBe(401);
    expect((await request(app).delete("/me/pilot-brain-memories")).status).toBe(401);
  });
});
