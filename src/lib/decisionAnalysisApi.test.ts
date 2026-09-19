import { describe, it, expect, afterEach, vi } from "vitest";
import { runAnalysis } from "./decisionAnalysisApi";

// The web client for Pilot's view and the Devil's Advocate, with the server
// stubbed. It has to turn every answer, including a broken one, into a result the
// screen can show, and never throw.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const reply = (status: number, body: unknown, jsonFails = false) => ({
  ok: status < 300,
  status,
  json: async () => {
    if (jsonFails) throw new Error("not json");
    return body;
  },
});

function stub(response: ReturnType<typeof reply> | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const decision = { id: "d1", question: "q", options: [], simulations: [], expectations: [], events: [] };

describe("runAnalysis", () => {
  it("posts to the recommend or challenge route for that decision", async () => {
    const fn = stub(reply(200, { ok: true, decision, remaining: 19 }));
    await runAnalysis("d1", "recommend");
    await runAnalysis("d1", "challenge");
    expect(fn.mock.calls[0]![0]).toMatch(/\/pilot-brain\/decisions\/d1\/recommend$/);
    expect(fn.mock.calls[1]![0]).toMatch(/\/pilot-brain\/decisions\/d1\/challenge$/);
    expect(fn.mock.calls[0]![1]).toMatchObject({ method: "POST" });
  });

  it("puts the decision id safely into the address", async () => {
    const fn = stub(reply(200, { ok: true, decision }));
    await runAnalysis("a/b?c=d", "recommend");
    expect(fn.mock.calls[0]![0]).toContain("/pilot-brain/decisions/a%2Fb%3Fc%3Dd/recommend");
  });

  it("returns the saved decision and what is left of the allowance", async () => {
    stub(reply(200, { ok: true, decision, remaining: 19 }));
    expect(await runAnalysis("d1", "recommend")).toEqual({ ok: true, status: 200, decision, remaining: 19 });
  });

  it("returns the server's reason for a refusal, with its status", async () => {
    stub(reply(429, { ok: false, error: "You have used all 20 of today's Pilot views and challenges." }));
    expect(await runAnalysis("d1", "challenge")).toEqual({ ok: false, status: 429, error: "You have used all 20 of today's Pilot views and challenges." });
    stub(reply(403, { ok: false, error: "Your account role (sales) doesn't have access to this." }));
    expect(await runAnalysis("d1", "challenge")).toMatchObject({ ok: false, status: 403 });
  });

  it("does not trust an ok that comes without a decision", async () => {
    stub(reply(200, { ok: true }));
    const result = await runAnalysis("d1", "recommend");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("could not read");
  });

  it("does not trust a body that says not ok, even with a 200", async () => {
    stub(reply(200, { ok: false, error: "nope", decision }));
    expect(await runAnalysis("d1", "recommend")).toMatchObject({ ok: false, error: "nope" });
  });

  it("copes with a reply that is not JSON", async () => {
    stub(reply(502, null, true));
    expect(await runAnalysis("d1", "recommend")).toEqual({ ok: false, status: 502, error: undefined });
  });

  it("reports a server that cannot be reached as status 0, without throwing", async () => {
    stub(new Error("Failed to fetch"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runAnalysis("d1", "recommend")).toEqual({ ok: false, status: 0, error: "Network error" });
    expect(quiet).toHaveBeenCalled();
  });
});
