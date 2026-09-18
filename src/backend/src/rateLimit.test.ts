import fs from "fs";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "./app.js";

// Regression tests for how the rate limiters tell one client from another
// when the app is deployed behind Render's reverse proxy.
//
// Every limiter in the app uses express-rate-limit's default key, which
// is req.ip. With Express's `trust proxy` left at its default (false),
// req.ip is the address of whatever opened the TCP connection — on
// Render, that is Render's own proxy, not the visitor. Every user on the
// platform then shared one bucket: 10 logins per 15 minutes across ALL
// dealers combined, 20 signups per hour platform-wide. Render's logs
// showed the symptom as ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
//
// These go through the real app and its real limiter config (not a copy
// that could drift), simulating the proxy with supertest's X-Forwarded-For
// header. The addresses are from the RFC 5737 documentation ranges, so
// they can never collide with a real client.

const LOGIN = "/auth/login";
const SIGNUP = "/auth/signup";

// Vitest runs test files in parallel workers, and importing the app opens
// the shared SQLite file (db.ts runs `PRAGMA journal_mode = WAL` at import
// time). Two files doing that at once intermittently die with "database
// is locked". These tests never write anything, so give this file its own
// throwaway database rather than competing with integration.test.ts for
// the real one. db.ts reads DATA_DIR once, at import, so it has to be set
// before the imports above evaluate — vi.hoisted runs ahead of them,
// which is also why it uses process.getBuiltinModule instead of an import.
// (A dynamic import() in beforeAll would also work at runtime, but tsc's
// nodenext/CommonJS model types its `.default` as the whole exports object
// rather than the app, so the static import keeps the types honest.)
const dataDir = vi.hoisted(() => {
  const fs = process.getBuiltinModule("node:fs");
  const os = process.getBuiltinModule("node:os");
  const path = process.getBuiltinModule("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flippilot-ratelimit-test-"));
  process.env.DATA_DIR = dir;
  return dir;
});

afterAll(() => {
  // Best effort — Windows won't delete a SQLite file that's still open
  // (db.ts doesn't expose the handle to close), so there a small
  // flippilot-ratelimit-test-* folder can be left behind in the OS temp dir.
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

// An empty body is rejected with a 400 before either route touches the
// database, so a probe has no side effects — but the limiter counts it
// like any other request, which is all these tests need. The remaining
// count is read back from the standard RateLimit-* response headers so
// the tests follow the configured limit instead of hard-coding it.
async function probe(path: string, forwardedFor: string) {
  const res = await request(app)
    .post(path)
    .set("X-Forwarded-For", forwardedFor)
    .send({});
  return {
    status: res.status,
    limit: Number(res.headers["ratelimit-limit"]),
    remaining: Number(res.headers["ratelimit-remaining"]),
  };
}

describe("rate limiters identify the real client behind a proxy", () => {
  // express-rate-limit reports a misconfigured proxy by logging a
  // ValidationError — once per limiter, on its first request — rather
  // than throwing, so the only way to see it is to watch console.error.
  // A plain wrapper rather than vi.spyOn: vitest clears spy history
  // between tests, which would silently discard the one-off log if the
  // first request happened in an earlier test than the one asserting on it.
  const loggedErrors: unknown[] = [];
  const originalConsoleError = console.error;

  beforeAll(() => {
    console.error = (...args: unknown[]) => {
      loggedErrors.push(args[0]);
      originalConsoleError(...args);
    };
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("counts different clients in separate buckets and repeats from one client together", async () => {
    const a1 = await probe(LOGIN, "203.0.113.10");
    const a2 = await probe(LOGIN, "203.0.113.10");
    const b1 = await probe(LOGIN, "203.0.113.20");
    const a3 = await probe(LOGIN, "203.0.113.10");

    expect(a1.remaining).toBe(a1.limit - 1);
    // Same client again: counted together with its first request...
    expect(a2.remaining).toBe(a1.limit - 2);
    // ...while a different client starts its own untouched budget...
    expect(b1.remaining).toBe(a1.limit - 1);
    // ...and the first client carries on from where it left off.
    expect(a3.remaining).toBe(a1.limit - 3);
  });

  it("locks out only the client that used up its login attempts", async () => {
    const { limit } = await probe(LOGIN, "203.0.113.30");
    for (let i = 1; i < limit; i++) {
      await probe(LOGIN, "203.0.113.30");
    }

    // The exact scenario the shared bucket caused: one busy client
    // exhausting the budget must not lock out anyone else.
    expect((await probe(LOGIN, "203.0.113.30")).status).toBe(429);
    expect((await probe(LOGIN, "203.0.113.31")).status).not.toBe(429);
  });

  it("applies the same per-client bucketing to the signup limiter", async () => {
    const a1 = await probe(SIGNUP, "203.0.113.50");
    const b1 = await probe(SIGNUP, "203.0.113.60");
    const a2 = await probe(SIGNUP, "203.0.113.50");

    expect(b1.remaining).toBe(a1.limit - 1);
    expect(a2.remaining).toBe(a1.limit - 2);
  });

  // The other half of getting `trust proxy` right: trusting too much
  // would let a client pick its own bucket. Render appends the address it
  // actually saw to whatever X-Forwarded-For the client itself sent, so a
  // forged value always sits to the LEFT of the real one. Only the
  // proxy-appended (rightmost) entry may count — rotating a fake leading
  // value must not buy a fresh login budget.
  it("ignores forged leading X-Forwarded-For entries", async () => {
    const first = await probe(LOGIN, "198.51.100.1, 203.0.113.40");
    const second = await probe(LOGIN, "198.51.100.2, 203.0.113.40");

    expect(second.remaining).toBe(first.remaining - 1);
  });

  it("no longer trips express-rate-limit's proxy validation", async () => {
    // Own requests through both limiters, so this holds when the test is
    // run on its own as well as after the ones above.
    await probe(LOGIN, "203.0.113.70");
    await probe(SIGNUP, "203.0.113.70");

    const codes = loggedErrors.map(err => (err as { code?: string } | undefined)?.code);
    // The symptom seen in Render's logs.
    expect(codes).not.toContain("ERR_ERL_UNEXPECTED_X_FORWARDED_FOR");
    // What a careless "fix" (`trust proxy: true`) would trade it for —
    // it trusts the client-controlled leftmost entry.
    expect(codes).not.toContain("ERR_ERL_PERMISSIVE_TRUST_PROXY");
  });
});
