import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// "Log out" used to only forget the login in the browser. The login itself (a
// signed token) went on working for up to 7 days, so a copy taken off a shared
// computer still got in. POST /auth/logout now cancels that one login on the
// server (revoked_sessions in db.ts), and requireAuth refuses it.
//
// Its own private database (see roleGates.test.ts for why).
vi.hoisted(() => {
  const shared = process.env.DATA_DIR;
  if (!shared) throw new Error("DATA_DIR is not set — run these tests through vitest.config.ts so they use the private test database");
  process.env.DATA_DIR = `${shared}/logout-${process.pid}`;
});

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "./app.js";
import { readCollection, writeCollection, deleteTenantData, revokeSession, isSessionRevoked } from "./db.js";

const runId = Date.now();
const email = `logout-${runId}@test.local`;
const password = "logoutpass12345";
let dealershipId = "";
afterAll(() => {
  writeCollection("users", readCollection<any>("users").filter(u => u.email !== email));
  writeCollection("dealerships", readCollection<any>("dealerships").filter(d => d.id !== dealershipId));
  deleteTenantData(dealershipId);
});

beforeAll(async () => {
  const res = await request(app).post("/auth/signup").send({ email, password, name: "Owner", dealershipName: "Logout Motors" });
  dealershipId = res.body.user.dealershipId;
});

const login = async (client?: "phone") =>
  (await request(app).post("/auth/login").send({ email, password, ...(client ? { client } : {}) })).body.token as string;
const me = (token: string) => request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
const logout = (token?: string) => {
  const r = request(app).post("/auth/logout");
  return token ? r.set("Authorization", `Bearer ${token}`) : r;
};

describe("log out", () => {
  it("the login stops working on the server, for every address, not only in the browser", async () => {
    const token = await login();
    expect((await me(token)).status).toBe(200);
    expect((await request(app).get("/inventory").set("Authorization", `Bearer ${token}`)).status).toBe(200);

    const res = await logout(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    expect((await me(token)).status).toBe(401);
    expect((await request(app).get("/inventory").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });

  it("only that one login: the same person stays signed in on their other devices", async () => {
    const showroom = await login();
    const laptop = await login();
    expect(showroom).not.toBe(laptop);
    await logout(showroom);
    expect((await me(showroom)).status).toBe(401);
    expect((await me(laptop)).status).toBe(200);
  });

  it("stays logged out when others log out later (their log out tidies the list)", async () => {
    const first = await login();
    await logout(first);
    await logout(await login());
    await logout(await login());
    expect((await me(first)).status).toBe(401);
  });

  it("the staff phone app can log out too", async () => {
    const phone = await login("phone");
    expect((await me(phone)).status).toBe(200);
    expect((await logout(phone)).status).toBe(200);
    expect((await me(phone)).status).toBe(401);
  });

  it("logging out twice, with no login, or with a made-up one is fine and changes nothing", async () => {
    const token = await login();
    await logout(token);
    expect((await logout(token)).status).toBe(200);
    expect((await logout()).status).toBe(200);
    expect((await logout("not-a-real-login")).status).toBe(200);

    // Signed with the wrong key: never written down, so it can't be used to
    // cancel someone else's login by guessing its id.
    const other = await login();
    const theirId = (jwt.decode(other) as { jti: string }).jti;
    const forged = jwt.sign({ id: "x", email: "x@x", dealershipId: "x", jti: theirId }, "wrong-secret", { expiresIn: "1h" });
    expect((await logout(forged)).status).toBe(200);
    expect(isSessionRevoked(theirId)).toBe(false);
    expect((await me(other)).status).toBe(200);
  });

  it("a login that has run out is cleared from the list at the next log out", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const future = Math.floor(Date.now() / 1000) + 3600;
    revokeSession(`old-${runId}`, past);
    expect(isSessionRevoked(`old-${runId}`)).toBe(true);
    revokeSession(`new-${runId}`, future);
    expect(isSessionRevoked(`old-${runId}`)).toBe(false);
    expect(isSessionRevoked(`new-${runId}`)).toBe(true);
  });
});
