import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// A login made by the staff phone app only reaches the addresses that app
// uses (phoneScope.ts); a web login is unchanged. Real routes, real accounts.
//
// Its own private database (see roleGates.test.ts for why).
vi.hoisted(() => {
  const shared = process.env.DATA_DIR;
  if (!shared) throw new Error("DATA_DIR is not set — run these tests through vitest.config.ts so they use the private test database");
  process.env.DATA_DIR = `${shared}/phone-scope-${process.pid}`;
});

import request from "supertest";
import app from "./app.js";
import { readCollection, writeCollection, deleteTenantData } from "./db.js";
import { phoneMayUse, scopeFromBody } from "./phoneScope.js";

const runId = Date.now();
const email = `phone-scope-${runId}@test.local`;
const password = "phonescopetestpass123";
let dealershipId = "";
let web = "";
let phone = "";

afterAll(() => {
  writeCollection("users", readCollection<any>("users").filter(u => !u.email.startsWith(`phone-scope-${runId}`)));
  writeCollection("dealerships", readCollection<any>("dealerships").filter(d => d.id !== dealershipId));
  if (dealershipId) deleteTenantData(dealershipId);
});

beforeAll(async () => {
  const res = await request(app).post("/auth/signup").send({ email, password, name: "Phone Owner", dealershipName: `Phone Scope ${runId}` });
  dealershipId = res.body.user.dealershipId;
  web = res.body.token;
  const login = await request(app).post("/auth/login").send({ email, password, client: "phone" });
  expect(login.status).toBe(200);
  phone = login.body.token;
});

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("which addresses a phone login may use", () => {
  it("covers what the phone app does, and nothing else", () => {
    for (const [m, u] of [
      ["GET", "/auth/me"], ["GET", "/diary"], ["PUT", "/diary/abc"], ["POST", "/leave"], ["POST", "/timekeeping/in"],
      ["GET", "/pay/summary?from=1&to=2"], ["PUT", "/pay/rates/u1"], ["GET", "/staff-messages"], ["POST", "/message-photos"],
      ["GET", "/inventory"], ["POST", "/inventory/car-1/photos"], ["DELETE", "/inventory/car-1/photos/p9"],
      ["GET", "/team"], ["GET", "/dealership/me"], ["GET", "/shifts"], ["GET", "/work-patterns"], ["GET", "/feedback"], ["POST", "/feedback"], ["PUT", "/feedback/f1/status"],
    ] as const) expect(phoneMayUse(m, u), `${m} ${u}`).toBe(true);
    for (const [m, u] of [
      ["GET", "/leads"], ["PUT", "/leads"], ["GET", "/customers"], ["GET", "/bookkeeping"], ["POST", "/pilot-brain/ask"],
      ["PUT", "/inventory"], ["PUT", "/inventory/car-1"], ["PUT", "/shifts"], ["PUT", "/dealership/me"], ["GET", "/contacts"],
      ["GET", "/recently-deleted"], ["GET", "/email-settings"], ["PUT", "/dealership/team/u1"], ["GET", "/inventoryX"],
    ] as const) expect(phoneMayUse(m, u), `${m} ${u}`).toBe(false);
  });

  it("only the phone app's own word makes a phone login", () => {
    expect(scopeFromBody({ client: "phone" })).toBe("phone");
    expect(scopeFromBody({ client: "web" })).toBeUndefined();
    expect(scopeFromBody(undefined)).toBeUndefined();
  });
});

describe("through the real routes", () => {
  it("a phone login reaches the phone's screens", async () => {
    for (const path of ["/auth/me", "/diary", "/inventory", "/dealership/me", "/shifts"]) {
      const res = await request(app).get(path).set(as(phone));
      expect(res.status, path).toBeLessThan(400);
    }
  });

  it("but not leads, customers, the books, Pilot Brain or settings, nor changing stock", async () => {
    for (const [method, path] of [["get", "/leads"], ["get", "/customers"], ["get", "/bookkeeping"], ["get", "/pilot-brain/status"], ["get", "/email-settings"], ["get", "/contacts"]] as const) {
      const res = await request(app)[method](path).set(as(phone));
      expect(res.status, path).toBe(403);
      expect(res.body.error).toMatch(/phone app/);
    }
    const put = await request(app).put("/inventory").set(as(phone)).send({ items: [] });
    expect(put.status).toBe(403);
  });

  it("the same person's web login is unchanged", async () => {
    for (const path of ["/leads", "/customers", "/contacts"]) {
      expect((await request(app).get(path).set(as(web))).status, path).toBe(200);
    }
  });

  it("joining a dealership from the phone gives a phone login too", async () => {
    const invite = await request(app).post("/dealership/invite").set(as(web)).send({ inviteeName: "Phone Staff", staffRole: "sales" });
    const joined = await request(app).post("/auth/join").send({
      token: invite.body.token, name: "Phone Staff", email: `phone-scope-${runId}-staff@test.local`, password: "phonescopejoinpass123", client: "phone",
    });
    expect(joined.status).toBeLessThan(400);
    expect((await request(app).get("/leads").set(as(joined.body.token))).status).toBe(403);
    expect((await request(app).get("/diary").set(as(joined.body.token))).status).toBeLessThan(400);
  });
});
