import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "./app.js";
import {
  RESET_EMAILS_PER_WINDOW,
  RESET_WINDOW_MS,
  resetResetEmailLimitsForTests,
  takeResetEmailSlot,
} from "./resetRequestLimit.js";
import { asProduction, captureEmails, signupOwner } from "./resetTestSupport.js";

// One person's inbox could be flooded with reset emails by asking for the same
// address over and over from many machines: the per-IP limiter never sees that.
// Each account is now capped (3 an hour), and the reply stays exactly the same
// whether the address is known, unknown or over its cap.
//
// The per-IP limiter on /auth/forgot-password allows 10 requests per file.

const GENERIC_REPLY = {
  ok: true,
  message: "If an account exists for that email, a reset link has been sent.",
};

beforeEach(() => {
  resetResetEmailLimitsForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("forgot-password is limited per email address", () => {
  it("only 3 emails an hour go out for one account, and every reply looks the same", async () => {
    const owner = await signupOwner(app, "limit-a");
    const other = await signupOwner(app, "limit-b");
    const { sent } = captureEmails();

    const replies = await asProduction(async () => {
      const out = [];
      for (let i = 0; i < 4; i += 1) {
        out.push(await request(app).post("/auth/forgot-password").send({ email: owner.email }));
      }
      out.push(await request(app).post("/auth/forgot-password").send({ email: `ghost-${Date.now()}@test.local` }));
      out.push(await request(app).post("/auth/forgot-password").send({ email: other.email }));
      return out;
    });

    // Every caller, known / unknown / over the cap, sees the identical reply.
    for (const reply of replies) {
      expect(reply.status).toBe(200);
      expect(reply.body).toEqual(GENERIC_REPLY);
    }

    // But only three mails were sent to the first account, one to the second,
    // and none to the address that has no account.
    expect(sent.filter(m => m.to === owner.email)).toHaveLength(RESET_EMAILS_PER_WINDOW);
    expect(sent.filter(m => m.to === other.email)).toHaveLength(1);
    expect(sent).toHaveLength(RESET_EMAILS_PER_WINDOW + 1);
  });

  it("the address is matched without regard to case or spaces", async () => {
    const owner = await signupOwner(app, "limit-case");
    const { sent } = captureEmails();

    await asProduction(async () => {
      for (const variant of [owner.email, owner.email.toUpperCase(), `  ${owner.email}  `, owner.email.toUpperCase()]) {
        await request(app).post("/auth/forgot-password").send({ email: variant });
      }
    });

    expect(sent).toHaveLength(RESET_EMAILS_PER_WINDOW);
  });
});

describe("the allowance itself", () => {
  it("counts an hour, then lets the address ask again", () => {
    const start = 1_000_000;
    for (let i = 0; i < RESET_EMAILS_PER_WINDOW; i += 1) {
      expect(takeResetEmailSlot("a@test.local", start + i)).toBe(true);
    }
    expect(takeResetEmailSlot("a@test.local", start + 10)).toBe(false);
    // A refused request is not counted, so it does not push the window out.
    expect(takeResetEmailSlot("a@test.local", start + RESET_WINDOW_MS - 1)).toBe(false);
    expect(takeResetEmailSlot("a@test.local", start + RESET_WINDOW_MS + RESET_EMAILS_PER_WINDOW)).toBe(true);
  });

  it("one address using its allowance does not affect another", () => {
    for (let i = 0; i < RESET_EMAILS_PER_WINDOW; i += 1) takeResetEmailSlot("busy@test.local", 5);
    expect(takeResetEmailSlot("busy@test.local", 6)).toBe(false);
    expect(takeResetEmailSlot("quiet@test.local", 6)).toBe(true);
  });
});
