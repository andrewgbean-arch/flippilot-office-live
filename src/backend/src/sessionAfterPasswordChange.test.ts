import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "./app.js";
import { getJwtSecret } from "./auth.js";
import * as emailModule from "./email.js";
import { resetResetEmailLimitsForTests } from "./resetRequestLimit.js";
import { captureEmails, signupOwner, tokenFromEmail, OWNER_PASSWORD } from "./resetTestSupport.js";

// A login used to keep working for its full 7 days after the password was
// changed or reset, so a thief (or an ex-employee's old laptop) stayed in even
// after the owner did the obvious thing and changed the password. Every login
// now carries a stamp of the password it was made under, and stops working
// the moment the password changes. The device that made the change gets a
// fresh login back.
//
// Also here: /auth/forgot-password no longer waits for the email service,
// which only happened for real accounts and so made them answer slower.

const me = (token: string) => request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
const login = (email: string, password: string, client?: string) =>
  request(app).post("/auth/login").send({ email, password, ...(client ? { client } : {}) });
const changePassword = (token: string, currentPassword: string, newPassword: string) =>
  request(app).put("/auth/password").set("Authorization", `Bearer ${token}`).send({ currentPassword, newPassword });
const CHANGED = { ok: false, error: "Your password was changed. Please log in again." };

beforeEach(() => {
  resetResetEmailLimitsForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("changing the password in Settings", () => {
  it("logs out every other device, and hands this one a fresh login that works", async () => {
    const owner = await signupOwner(app, "change");
    const laptop = (await login(owner.email, OWNER_PASSWORD)).body.token as string;
    const phone = (await login(owner.email, OWNER_PASSWORD, "phone")).body.token as string;
    expect((await me(laptop)).status).toBe(200);
    expect((await me(phone)).status).toBe(200);

    const res = await changePassword(owner.token, OWNER_PASSWORD, "brand-new-password-1");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.token).toBe("string");

    // The signup login that made the change, and the two other devices: all out.
    for (const old of [owner.token, laptop, phone]) {
      const r = await me(old);
      expect(r.status).toBe(401);
      expect(r.body).toEqual(CHANGED);
    }
    // The fresh one works, and so does logging in with the new password.
    expect((await me(res.body.token)).status).toBe(200);
    expect((await me((await login(owner.email, "brand-new-password-1")).body.token)).status).toBe(200);
  });

  it("a phone login that changes the password gets a phone login back, not a full one", async () => {
    const owner = await signupOwner(app, "phone-change");
    const phone = (await login(owner.email, OWNER_PASSWORD, "phone")).body.token as string;

    const res = await changePassword(phone, OWNER_PASSWORD, "phone-new-password-1");
    expect(res.status).toBe(200);
    expect((jwt.decode(res.body.token) as { scope?: string }).scope).toBe("phone");
    // Still held to what the phone app may reach.
    expect((await request(app).get("/leads").set("Authorization", `Bearer ${res.body.token}`)).status).toBe(403);
    expect((await me(res.body.token)).status).toBe(200);
  });

  it("a wrong current password changes nothing and logs nobody out", async () => {
    const owner = await signupOwner(app, "wrong-current");
    const res = await changePassword(owner.token, "not-the-password", "whatever-new-1");
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
    expect((await me(owner.token)).status).toBe(200);
  });
});

describe("resetting a forgotten password", () => {
  it("logs out every device that was signed in", async () => {
    const owner = await signupOwner(app, "reset");
    const laptop = (await login(owner.email, OWNER_PASSWORD)).body.token as string;
    const { sent } = captureEmails();
    await request(app).post("/auth/forgot-password").send({ email: owner.email });
    const resetToken = tokenFromEmail(sent[sent.length - 1]!);

    const res = await request(app).post("/auth/reset-password").send({ token: resetToken, newPassword: "after-reset-pass-1" });
    expect(res.status).toBe(200);

    for (const old of [owner.token, laptop]) {
      const r = await me(old);
      expect(r.status).toBe(401);
      expect(r.body).toEqual(CHANGED);
    }
    expect((await me((await login(owner.email, "after-reset-pass-1")).body.token)).status).toBe(200);
  });
});

describe("what is left alone", () => {
  it("a login made before the stamp existed still works until it runs out (no mass logout on deploy)", async () => {
    const owner = await signupOwner(app, "legacy");
    const claims = jwt.decode(owner.token) as Record<string, unknown>;
    expect(typeof claims.pwv).toBe("string");
    const { pwv: _pwv, iat: _iat, exp: _exp, ...rest } = claims;
    const legacy = jwt.sign(rest, getJwtSecret(), { expiresIn: "7d" });
    expect((await me(legacy)).status).toBe(200);
  });

  it("a forged stamp is refused", async () => {
    const owner = await signupOwner(app, "forged");
    const claims = jwt.decode(owner.token) as Record<string, unknown>;
    const { iat: _iat, exp: _exp, ...rest } = claims;
    const forged = jwt.sign({ ...rest, pwv: "0".repeat(32) }, getJwtSecret(), { expiresIn: "7d" });
    expect((await me(forged)).status).toBe(401);
  });

  it("the stamp does not give away the password hash", async () => {
    const owner = await signupOwner(app, "no-hash");
    const pwv = (jwt.decode(owner.token) as { pwv: string }).pwv;
    expect(pwv).toMatch(/^[0-9a-f]{32}$/);
    expect(owner.token).not.toContain("$2");
  });
});

describe("forgot-password answers without waiting for the email service", () => {
  it("replies while the email is still being sent", async () => {
    const owner = await signupOwner(app, "slow-mail");
    let finish: () => void = () => {};
    const spy = vi.spyOn(emailModule, "sendEmail").mockImplementation(() => new Promise<void>(r => { finish = r; }));

    const res = await Promise.race([
      request(app).post("/auth/forgot-password").send({ email: owner.email }),
      new Promise<"timed out">(r => setTimeout(() => r("timed out"), 3000)),
    ]);
    expect(res).not.toBe("timed out");
    expect((res as { status: number }).status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    finish();
  });

  it("a failing email service still gets the same reply, not an error", async () => {
    const owner = await signupOwner(app, "failing-mail");
    vi.spyOn(emailModule, "sendEmail").mockRejectedValue(new Error("mail down"));
    const known = await request(app).post("/auth/forgot-password").send({ email: owner.email });
    const unknown = await request(app).post("/auth/forgot-password").send({ email: `nobody-${Date.now()}@test.local` });
    expect(known.status).toBe(200);
    const { devResetLink: _link, ...knownBody } = known.body;
    expect(knownBody).toEqual(unknown.body);
  });
});
