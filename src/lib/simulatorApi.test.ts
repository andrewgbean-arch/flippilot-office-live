import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  NETWORK_MESSAGE,
  NO_ACCESS_MESSAGE,
  attachSimulation,
  canUseSimulator,
  runSimulation,
  type SimulationRequest,
} from "./simulatorApi";

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => "test-token" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const request: SimulationRequest = { kind: "stock_investment", params: { amountGbp: 48000 } };
const simulation = {
  ranAt: "2030-06-01T12:00:00.000Z",
  kind: "stock_investment",
  title: "Put £48,000 into stock",
  assumptions: [],
  scenarios: [{ key: "keep", label: "Keep things as they are", figures: [] }],
  confidence: "medium",
  confidenceReasons: ["Nine cars sold."],
  note: "Simulation, not a forecast: arithmetic on your own recent history and the assumptions listed. Change an assumption and the answer changes.",
};
const decision = { id: "d1", question: "q", simulations: [{ id: "s1", ...simulation }], events: [] };

describe("running a simulation", () => {
  it("sends only the numbers, with the login, to the run route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true, simulation }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runSimulation(request);

    expect(result).toEqual({ ok: true, simulation });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/pilot-brain\/simulator\/run$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual(request);
  });

  it("tells anyone who is not an owner or a manager so in plain words, whatever the server said", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(403, { ok: false, error: "Your account role (sales) doesn't have access to this." })));
    expect(await runSimulation(request)).toEqual({ ok: false, status: 403, error: NO_ACCESS_MESSAGE });
    expect(NO_ACCESS_MESSAGE).toBe("Only owners and managers can use the Simulator.");
  });

  it("asks for a fresh login when the session has ended", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(401, { ok: false, error: "Not authenticated" })));
    expect(await runSimulation(request)).toEqual({ ok: false, status: 401, error: "Please log in again." });
  });

  it("gives back the server's own plain message when it refuses the numbers", async () => {
    const error = "How much would you put into stock? Enter an amount from £1 to £1,000,000.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(400, { ok: false, error })));
    expect(await runSimulation(request)).toEqual({ ok: false, status: 400, error });
  });

  it("says something plain when the server answers with something that is not JSON, or with no message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError("Unexpected token <"); } }));
    const html = await runSimulation(request);
    expect(html).toMatchObject({ ok: false, status: 502 });
    expect(html.ok ? "" : html.error).toContain("Something went wrong");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(500, { ok: false })));
    const bare = await runSimulation(request);
    expect(bare.ok ? "" : bare.error).toContain("Something went wrong");
  });

  it("reports a network failure instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await runSimulation(request)).toEqual({ ok: false, status: 0, error: NETWORK_MESSAGE });
  });

  it("refuses to show a result whose confidence is not low, medium or high", async () => {
    for (const confidence of ["82%", 0.82, 82, "very high", "", null, undefined]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { ok: true, simulation: { ...simulation, confidence } })));
      const r = await runSimulation(request);
      expect(r.ok, String(confidence)).toBe(false);
    }
  });

  it("refuses a reply that does not look like a simulation at all", async () => {
    for (const body of [{ ok: true }, { ok: true, simulation: null }, { ok: true, simulation: "yes" }, { ok: true, simulation: { ...simulation, scenarios: "none" } }, { ok: true, simulation: { ...simulation, title: 5 } }]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, body)));
      expect((await runSimulation(request)).ok, JSON.stringify(body)).toBe(false);
    }
  });
});

describe("saving a simulation to a decision", () => {
  it("sends only the numbers to the decision's own route, never a result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(201, { ok: true, decision, simulation: { id: "s1", ...simulation } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await attachSimulation("d1", request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.id).toBe("d1");
      expect(result.simulation.id).toBe("s1");
    }
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/pilot-brain\/decisions\/d1\/simulations$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    // the server works the simulation out itself: nothing but the request goes up
    expect(JSON.parse(init.body)).toEqual(request);
    expect(Object.keys(JSON.parse(init.body))).toEqual(["kind", "params"]);
  });

  it("puts an odd decision id safely into the address", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(404, { ok: false, error: "That decision wasn't found." }));
    vi.stubGlobal("fetch", fetchMock);
    await attachSimulation("a/b c?x=1", request);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/pilot-brain\/decisions\/a%2Fb%20c%3Fx%3D1\/simulations$/);
  });

  it("gives back the server's reason when the decision is closed or full", async () => {
    const error = "This decision has already been made, so its simulations can't be changed. You can still run a simulation without saving it.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(409, { ok: false, error })));
    expect(await attachSimulation("d1", request)).toEqual({ ok: false, status: 409, error });
  });

  it("says plainly that only owners and managers can do it, and reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(403, { ok: false })));
    expect(await attachSimulation("d1", request)).toEqual({ ok: false, status: 403, error: NO_ACCESS_MESSAGE });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await attachSimulation("d1", request)).toEqual({ ok: false, status: 0, error: NETWORK_MESSAGE });
  });

  it("does not hand back a decision or simulation the server did not really send", async () => {
    for (const body of [{ ok: true }, { ok: true, decision: {}, simulation: { id: "s", ...simulation } }, { ok: true, decision, simulation: { id: "s", ...simulation, confidence: "90%" } }]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(201, body)));
      expect((await attachSimulation("d1", request)).ok, JSON.stringify(body)).toBe(false);
    }
  });
});

describe("who the screen treats as allowed", () => {
  it("is the owner, or a manager account, like the server", () => {
    expect(canUseSimulator({ role: "owner" })).toBe(true);
    expect(canUseSimulator({ role: "staff", staffRole: "manager" })).toBe(true);
    expect(canUseSimulator({ role: "owner", staffRole: "general" })).toBe(true);
  });

  it("is nobody else", () => {
    for (const staffRole of ["sales", "finance", "general", undefined] as const) {
      expect(canUseSimulator(staffRole ? { role: "staff", staffRole } : { role: "staff" }), String(staffRole)).toBe(false);
    }
    expect(canUseSimulator(null)).toBe(false);
    expect(canUseSimulator(undefined)).toBe(false);
  });
});
