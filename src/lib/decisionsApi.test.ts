import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { BASE_URL } from "@/lib/apiBaseUrl";
import { decideDecision, createDecision, editDecision, failureMessage, fetchDecision, fetchDecisions, recordOutcome } from "./decisionsApi";

// The Decision Journal's client: the right address, method, login and body for each
// call, and a plain sentence (never a thrown error) when something goes wrong.

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const notJson = (status: number) => ({ ok: status >= 200 && status < 300, status, json: async () => { throw new Error("not json"); } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", { getItem: () => "test-token", setItem: () => undefined, removeItem: () => undefined });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit & { headers: Record<string, string> }];
  return { url, init };
};

describe("the calls", () => {
  it("lists decisions with a GET, the login token, and no body", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, decisions: [], stats: { total: 0 } }));
    const res = await fetchDecisions();
    expect(res).toEqual({ ok: true, decisions: [], stats: { total: 0 } });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/pilot-brain/decisions`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("creates a decision with a POST of the draft as JSON", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, decision: { id: "d1" }, state: "open", comparison: null, closeWithinPercent: 20 }));
    const draft = { question: "Q?", context: "", options: [{ label: "A" }, { label: "B" }] };
    const res = await createDecision(draft);
    expect(res.ok && res.decision.id).toBe("d1");
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/pilot-brain/decisions`);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(draft);
  });

  it("reads one decision, and puts the id safely into the address", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, decision: {}, state: "open", comparison: null, closeWithinPercent: 20 }));
    await fetchDecision("a b/c?d");
    expect(lastCall().url).toBe(`${BASE_URL}/pilot-brain/decisions/a%20b%2Fc%3Fd`);
  });

  it("edits, decides and records what happened with PUTs to the right places", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, decision: {}, state: "decided", comparison: null, closeWithinPercent: 20 }));
    await editDecision("d1", { question: "New?" });
    expect(lastCall().url).toBe(`${BASE_URL}/pilot-brain/decisions/d1`);
    expect(lastCall().init.method).toBe("PUT");
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ question: "New?" });

    const decide = { optionKey: "b", reasoning: "", expectations: [], reviewInDays: 90 };
    await decideDecision("d1", decide);
    expect(lastCall().url).toBe(`${BASE_URL}/pilot-brain/decisions/d1/decide`);
    expect(lastCall().init.method).toBe("PUT");
    expect(JSON.parse(lastCall().init.body as string)).toEqual(decide);

    const outcome = { actuals: [{ expectationId: "e0", actual: null, note: "" }], notes: "", lessons: { pilotRight: "", pilotWrong: "", bossRight: "", unexpected: "", lesson: "" } };
    await recordOutcome("d1", outcome);
    expect(lastCall().url).toBe(`${BASE_URL}/pilot-brain/decisions/d1/outcome`);
    expect(JSON.parse(lastCall().init.body as string).actuals[0].actual).toBeNull(); // not known stays null: never 0
  });
});

describe("when something goes wrong", () => {
  it("passes on the server's own plain-English reason, with the status", async () => {
    fetchMock.mockResolvedValue(json(409, { ok: false, error: "This decision has already been made and can't be changed." }));
    expect(await decideDecision("d1", { optionKey: "a", reasoning: "", expectations: [], reviewInDays: 90 })).toEqual({
      ok: false,
      error: "This decision has already been made and can't be changed.",
      status: 409,
    });
  });

  it("gives the owners-and-managers message for a 403 that came with none", async () => {
    fetchMock.mockResolvedValue(notJson(403));
    expect(await fetchDecisions()).toEqual({ ok: false, error: "Decisions are for owners and managers.", status: 403 });
  });

  it("keeps the server's own words for a 403 that had some", async () => {
    fetchMock.mockResolvedValue(json(403, { ok: false, error: "Your account role (sales) doesn't have access to this." }));
    const res = await fetchDecisions();
    expect(res).toMatchObject({ ok: false, status: 403, error: "Your account role (sales) doesn't have access to this." });
  });

  it("says something sensible for a page that is not JSON, and for a 200 that is not a success", async () => {
    fetchMock.mockResolvedValue(notJson(502));
    expect(await fetchDecisions()).toEqual({ ok: false, error: "Something went wrong. Please try again.", status: 502 });
    fetchMock.mockResolvedValue(json(200, { ok: false }));
    expect(await fetchDecisions()).toMatchObject({ ok: false });
    fetchMock.mockResolvedValue(json(200, null));
    expect(await fetchDecisions()).toMatchObject({ ok: false });
  });

  it("does not throw when the server cannot be reached: it answers with a sentence", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await fetchDecisions()).toEqual({ ok: false, error: "Couldn't reach the server. Check your connection and try again.", status: 0 });
  });
});

describe("failureMessage", () => {
  it("prefers the server's sentence, trimmed", () => {
    expect(failureMessage(400, { error: "  Please write the question you are deciding.  " })).toBe("Please write the question you are deciding.");
  });
  it("otherwise says something fitting for the kind of failure", () => {
    expect(failureMessage(401, {})).toBe("Please log in again.");
    expect(failureMessage(402, null)).toMatch(/premium add-on/);
    expect(failureMessage(403, undefined)).toBe("Decisions are for owners and managers.");
    expect(failureMessage(404, {})).toBe("That decision wasn't found.");
    expect(failureMessage(500, { error: "" })).toBe("Something went wrong. Please try again.");
    expect(failureMessage(500, { error: 5 })).toBe("Something went wrong. Please try again.");
  });
});
