import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import app from "./app.js";
import { getJwtSecret } from "./auth.js";
import { readCollection, writeCollection } from "./db.js";
import { resetResetEmailLimitsForTests } from "./resetRequestLimit.js";
import { captureEmails, signupOwner, tokenFromEmail, OWNER_PASSWORD } from "./resetTestSupport.js";

// A reset link used to keep working for its whole hour after a successful reset,
// so anyone who ever saw it (a shared inbox, a forwarded mail, a proxy log) could
// set the password again and again. The token is now tied to the password the
// account has at that moment: once the password changes, every earlier link is
// dead. Tokens here come from the real /auth/forgot-password flow (read out of the
// email the app sends), not minted by the test, so what is proved is what a user
// would really get.
//
// The per-IP limiter on /auth/forgot-password allows 10 requests per file.

type UserRow = { id: string; email: string; passwordHash: string };
const storedUser = (id: string) => readCollection<UserRow>("users").find(u => u.id === id);
const reset = (token: string, newPassword: string) => request(app).post("/auth/reset-password").send({ token, newPassword });
const INVALID = { ok: false, error: "This reset link is invalid or has expired" };

// Asks for a reset email for this owner through the real route, and returns the
// token that was in it.
async function requestToken(email: string): Promise<string> {
  const { sent } = captureEmails();
  const res = await request(app).post("/auth/forgot-password").send({ email });
  expect(res.status).toBe(200);
  expect(sent.length).toBeGreaterThan(0);
  return tokenFromEmail(sent[sent.length - 1]!);
}

beforeEach(() => {
  resetResetEmailLimitsForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("a reset link works once", () => {
  it("the same token used twice: the first resets the password, the second is refused", async () => {
    const owner = await signupOwner(app, "twice");
    const token = await requestToken(owner.email);

    const first = await reset(token, "first-new-password-1");
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true });

    const second = await reset(token, "second-new-password-2");
    expect(second.status).toBe(400);
    expect(second.body).toEqual(INVALID);

    // The second request changed nothing: the password is still the first one.
    const row = storedUser(owner.id)!;
    expect(await bcrypt.compare("first-new-password-1", row.passwordHash)).toBe(true);
    expect(await bcrypt.compare("second-new-password-2", row.passwordHash)).toBe(false);
  });

  it("two requests with the same token at the same moment: exactly one wins", async () => {
    const owner = await signupOwner(app, "race");
    const token = await requestToken(owner.email);

    const [a, b] = await Promise.all([reset(token, "racing-password-AAA"), reset(token, "racing-password-BBB")]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    const winner = a.status === 200 ? "racing-password-AAA" : "racing-password-BBB";
    const loser = a.status === 200 ? "racing-password-BBB" : "racing-password-AAA";
    expect((a.status === 200 ? b : a).body).toEqual(INVALID);
    const row = storedUser(owner.id)!;
    expect(await bcrypt.compare(winner, row.passwordHash)).toBe(true);
    expect(await bcrypt.compare(loser, row.passwordHash)).toBe(false);
  });
});

describe("old tokens die when the password changes", () => {
  it("two links requested; using the newer one kills the older one", async () => {
    const owner = await signupOwner(app, "two-links");
    const older = await requestToken(owner.email);
    const newer = await requestToken(owner.email);

    expect((await reset(newer, "chosen-password-777")).status).toBe(200);

    const res = await reset(older, "attacker-password-9");
    expect(res.status).toBe(400);
    expect(res.body).toEqual(INVALID);
    expect(await bcrypt.compare("chosen-password-777", storedUser(owner.id)!.passwordHash)).toBe(true);
  });

  it("a link requested before the person changed their password in Settings is dead", async () => {
    const owner = await signupOwner(app, "settings-change");
    const token = await requestToken(owner.email);

    const change = await request(app)
      .put("/auth/password")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ currentPassword: OWNER_PASSWORD, newPassword: "changed-in-settings-1" });
    expect(change.status).toBe(200);

    const res = await reset(token, "attacker-password-9");
    expect(res.status).toBe(400);
    expect(res.body).toEqual(INVALID);
    expect(await bcrypt.compare("changed-in-settings-1", storedUser(owner.id)!.passwordHash)).toBe(true);
  });
});

describe("the other refusals are kept", () => {
  it("a password under 8 characters is 400 and does NOT use the link up", async () => {
    const owner = await signupOwner(app, "short");
    const token = await requestToken(owner.email);

    const short = await reset(token, "short");
    expect(short.status).toBe(400);
    expect(short.body).toEqual({ ok: false, error: "New password must be at least 8 characters" });

    expect((await reset(token, "long-enough-password")).status).toBe(200);
  });

  it("garbage, a tampered token, a login token and a token made without the password fingerprint are all 400", async () => {
    const owner = await signupOwner(app, "junk");
    const real = await requestToken(owner.email);

    expect((await reset("not-a-token", "long-enough-password")).body).toEqual(INVALID);

    const [header, payload] = real.split(".");
    expect((await reset(`${header}.${payload}.AAAA`, "long-enough-password")).body).toEqual(INVALID);

    // A genuine login session token is not a reset token.
    expect((await reset(owner.token, "long-enough-password")).body).toEqual(INVALID);

    // Signed by this server, right purpose and account, but with no fingerprint (the
    // shape every token had before this change): refused.
    const noFingerprint = jwt.sign({ purpose: "password-reset", userId: owner.id }, getJwtSecret(), { expiresIn: "1h" });
    expect((await reset(noFingerprint, "long-enough-password")).status).toBe(400);

    // A fingerprint that belongs to some other password: refused.
    const wrongFingerprint = jwt.sign(
      { purpose: "password-reset", userId: owner.id, fp: "0".repeat(32) },
      getJwtSecret(),
      { expiresIn: "1h" }
    );
    expect((await reset(wrongFingerprint, "long-enough-password")).status).toBe(400);

    // Nothing above changed the password: the real link still works.
    expect((await reset(real, "long-enough-password")).status).toBe(200);
  });

  it("an expired link is 400", async () => {
    const owner = await signupOwner(app, "expired");
    const real = await requestToken(owner.email);
    const claims = jwt.decode(real) as { purpose: string; userId: string; fp: string };
    const expired = jwt.sign(
      { purpose: claims.purpose, userId: claims.userId, fp: claims.fp, iat: Math.floor(Date.now() / 1000) - 7200 },
      getJwtSecret(),
      { expiresIn: 3600 }
    );
    const res = await reset(expired, "long-enough-password");
    expect(res.status).toBe(400);
    expect(res.body).toEqual(INVALID);
  });

  it("a link for an account that has since been removed is 404", async () => {
    const owner = await signupOwner(app, "gone");
    const token = await requestToken(owner.email);

    writeCollection("users", readCollection<UserRow>("users").filter(u => u.id !== owner.id));

    const res = await reset(token, "long-enough-password");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "Account no longer exists" });
  });
});
