import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "./app.js";

// Regression tests for how the rate limiters tell one visitor from another on
// Render.
//
// Every limiter in the app uses express-rate-limit's default key, which is
// req.ip, and req.ip depends on Express's `trust proxy` setting. On Render a
// request passes through TWO proxies, Cloudflare and then Render's own router,
// and each adds to X-Forwarded-For. Read off production with a temporary
// diagnostic route (2026-09-21), what the app receives is:
//
//     X-Forwarded-For: <anything the client sent>, <visitor>, <Cloudflare edge address>
//
// (Cloudflare appends the visitor; Render's router then appends the Cloudflare
// address it saw connect.) That Cloudflare address ROTATES from one request to
// the next. With the earlier setting, which trusted 1 hop and so took the
// rightmost entry, the limiters keyed on it: one visitor was scattered over
// many buckets and strangers shared them. Before that (`trust proxy` unset)
// req.ip was Render's router for everybody.
//
// These go through the real app and its real limiter config (not a copy that
// could drift), building the header the way production delivers it. The
// addresses come from the RFC 5737 documentation ranges so they can never
// collide with a real client: 203.0.113.x are visitors, 198.51.100.x are
// stand-ins for Cloudflare's rotating edge, 192.0.2.x are forged entries.

const LOGIN = "/auth/login";
const SIGNUP = "/auth/signup";

// The X-Forwarded-For a request from `visitor` arrives with on Render. `forged`
// is anything the client put in the header itself, which always sits to the
// LEFT of what the proxies add. Every call gets a different edge address, as in
// production.
let edgeCounter = 0;
function chain(visitor: string, forged: string[] = []) {
  const edge = `198.51.100.${1 + (edgeCounter++ % 254)}`;
  return [...forged, visitor, edge].join(", ");
}

// An empty body is rejected with a 400 before either route touches the
// database, so a probe has no side effects, but the limiter counts it like any
// other request, which is all these tests need. The remaining count is read
// back from the standard RateLimit-* response headers so the tests follow the
// configured limit instead of hard-coding it.
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

describe("rate limiters identify the real visitor behind Cloudflare and Render", () => {
  // express-rate-limit reports a misconfigured proxy by logging a
  // ValidationError, once per limiter on its first request, rather than
  // throwing, so the only way to see it is to watch console.error. A plain
  // wrapper rather than vi.spyOn: vitest clears spy history between tests,
  // which would silently discard the one-off log if the first request happened
  // in an earlier test than the one asserting on it.
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

  // The bug seen live: one visitor, Cloudflare address changing per request.
  it("keeps one visitor in one bucket while Cloudflare's address changes on every request", async () => {
    const first = await probe(LOGIN, chain("203.0.113.5"));
    const second = await probe(LOGIN, chain("203.0.113.5"));
    const third = await probe(LOGIN, chain("203.0.113.5"));

    expect(first.remaining).toBe(first.limit - 1);
    expect(second.remaining).toBe(first.limit - 2);
    expect(third.remaining).toBe(first.limit - 3);
  });

  it("gives different visitors separate buckets", async () => {
    const a1 = await probe(LOGIN, chain("203.0.113.10"));
    const a2 = await probe(LOGIN, chain("203.0.113.10"));
    const b1 = await probe(LOGIN, chain("203.0.113.20"));
    const a3 = await probe(LOGIN, chain("203.0.113.10"));

    expect(a1.remaining).toBe(a1.limit - 1);
    // Same visitor again: counted together with their first request...
    expect(a2.remaining).toBe(a1.limit - 2);
    // ...while a different visitor starts their own untouched budget...
    expect(b1.remaining).toBe(a1.limit - 1);
    // ...and the first visitor carries on from where they left off.
    expect(a3.remaining).toBe(a1.limit - 3);
  });

  it("locks out only the visitor who used up their login attempts", async () => {
    const { limit } = await probe(LOGIN, chain("203.0.113.30"));
    for (let i = 1; i < limit; i++) {
      await probe(LOGIN, chain("203.0.113.30"));
    }

    // The exact scenario a shared bucket causes: one busy visitor exhausting
    // the budget must not lock out anyone else.
    expect((await probe(LOGIN, chain("203.0.113.30"))).status).toBe(429);
    expect((await probe(LOGIN, chain("203.0.113.31"))).status).not.toBe(429);
  });

  it("applies the same per-visitor bucketing to the signup limiter", async () => {
    const a1 = await probe(SIGNUP, chain("203.0.113.50"));
    const b1 = await probe(SIGNUP, chain("203.0.113.60"));
    const a2 = await probe(SIGNUP, chain("203.0.113.50"));

    expect(b1.remaining).toBe(a1.limit - 1);
    expect(a2.remaining).toBe(a1.limit - 2);
  });

  // The other half of getting `trust proxy` right: trusting too much would let
  // a visitor pick their own bucket. Anything they put in X-Forwarded-For sits
  // to the left of the address Cloudflare recorded, so only that entry may
  // count. Rotating fake leading values, one, two or none, must not buy a
  // fresh login budget.
  it("ignores forged leading X-Forwarded-For entries", async () => {
    const visitor = "203.0.113.40";
    const none = await probe(LOGIN, chain(visitor));
    const one = await probe(LOGIN, chain(visitor, ["192.0.2.1"]));
    const two = await probe(LOGIN, chain(visitor, ["192.0.2.2", "192.0.2.3"]));
    const oneAgain = await probe(LOGIN, chain(visitor, ["192.0.2.4"]));

    expect(one.remaining).toBe(none.remaining - 1);
    expect(two.remaining).toBe(none.remaining - 2);
    expect(oneAgain.remaining).toBe(none.remaining - 3);
  });

  it("no longer trips express-rate-limit's proxy validation", async () => {
    // Own requests through both limiters, so this holds when the test is run
    // on its own as well as after the ones above.
    await probe(LOGIN, chain("203.0.113.70"));
    await probe(SIGNUP, chain("203.0.113.70"));

    const codes = loggedErrors.map(err => (err as { code?: string } | undefined)?.code);
    // The symptom first seen in Render's logs.
    expect(codes).not.toContain("ERR_ERL_UNEXPECTED_X_FORWARDED_FOR");
    // What a careless "fix" (`trust proxy: true`) would trade it for: it
    // trusts the client-controlled leftmost entry.
    expect(codes).not.toContain("ERR_ERL_PERMISSIVE_TRUST_PROXY");
  });
});
