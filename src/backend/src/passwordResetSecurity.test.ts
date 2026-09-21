import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "./app.js";
import { DEFAULT_APP_URL } from "./appUrl.js";
import { sendEmail } from "./email.js";
import { resetResetEmailLimitsForTests } from "./resetRequestLimit.js";
import { asProduction, captureEmails, signupOwner, tokenFromEmail } from "./resetTestSupport.js";

// Password reset used to hand the working reset link straight back to whoever
// asked for it whenever no email provider was set up (so anyone who knew a
// dealer's email address could take over the account), and built the link in the
// email from the caller's Origin header (so an attacker could have the real email
// point at their own site). These tests drive the real Express app.
//
// The per-IP limiter on /auth/forgot-password allows 10 requests per file, so this
// file keeps well under that.

const GENERIC_REPLY = {
  ok: true,
  message: "If an account exists for that email, a reset link has been sent.",
};

beforeEach(() => {
  resetResetEmailLimitsForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the reset link never comes back to the caller on a real server", () => {
  it("NODE_ENV=production with no RESEND_API_KEY: the reply has no devResetLink and no token anywhere", async () => {
    const owner = await signupOwner(app, "prod-nolink");
    const { sent } = captureEmails();
    const complaint = vi.spyOn(console, "error").mockImplementation(() => {});

    const known = await asProduction(() => request(app).post("/auth/forgot-password").send({ email: owner.email }));
    const unknown = await asProduction(() =>
      request(app).post("/auth/forgot-password").send({ email: `nobody-${Date.now()}@test.local` })
    );

    // The email itself did carry a real link (it is the one place it belongs)...
    expect(sent).toHaveLength(1);
    const token = tokenFromEmail(sent[0]!);
    expect(token.length).toBeGreaterThan(20);

    // ...but nothing about it is in the reply, in any form.
    expect(known.status).toBe(200);
    expect(known.body).toEqual(GENERIC_REPLY);
    expect(known.body).not.toHaveProperty("devResetLink");
    const wire = JSON.stringify(known.body) + known.text + JSON.stringify(known.headers);
    expect(wire).not.toContain(token);
    expect(wire).not.toContain("reset-password");
    expect(wire).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // no JWT-looking string

    // A known and an unknown address get the very same reply.
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);

    // The operator is told, on the server, that nothing can be delivered.
    expect(complaint).toHaveBeenCalled();
    expect(String(complaint.mock.calls[0]![0])).toContain("RESEND_API_KEY");
    // ...and that message never contains the token.
    expect(complaint.mock.calls.flat().join(" ")).not.toContain(token);
  });

  it("under NODE_ENV=test the link is still returned (the existing tests rely on it), and it is the emailed link", async () => {
    const owner = await signupOwner(app, "test-link");
    const { sent } = captureEmails();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app).post("/auth/forgot-password").send({ email: owner.email });
    expect(res.status).toBe(200);
    expect(res.body.devResetLink).toBe(`${DEFAULT_APP_URL}/reset-password?token=${tokenFromEmail(sent[0]!)}`);
  });

  it("the real email sender does not write a reset link into a production log", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await asProduction(() => sendEmail("someone@test.local", "Reset", "Click https://x.example/reset-password?token=SECRETTOKEN"));
    expect(log.mock.calls.flat().join(" ")).not.toContain("SECRETTOKEN");
    expect(log.mock.calls.flat().join(" ")).toContain("someone@test.local");
  });
});

describe("the emailed link comes from the server's own address, never from a request header", () => {
  it("a forged Origin (and Host / X-Forwarded-Host / Referer) never appears in the email body", async () => {
    const owner = await signupOwner(app, "forged");
    const { sent } = captureEmails();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await asProduction(() =>
      request(app)
        .post("/auth/forgot-password")
        .set("Origin", "https://evil.example")
        .set("X-Forwarded-Host", "evil.example")
        .set("Referer", "https://evil.example/login")
        .send({ email: owner.email })
    );
    expect(res.status).toBe(200);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(owner.email);
    expect(sent[0]!.body).not.toContain("evil.example");
    expect(sent[0]!.body).toContain(`${DEFAULT_APP_URL}/reset-password?token=${tokenFromEmail(sent[0]!)}`);
  });

  it("uses APP_URL when it is a valid https address, and ignores a forged Origin next to it", async () => {
    const owner = await signupOwner(app, "app-url");
    const { sent } = captureEmails();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await asProduction(
      () => request(app).post("/auth/forgot-password").set("Origin", "https://evil.example").send({ email: owner.email }),
      { APP_URL: "https://app.dealer.example" }
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toContain("https://app.dealer.example/reset-password?token=");
    expect(sent[0]!.body).not.toContain("evil.example");
  });
});
