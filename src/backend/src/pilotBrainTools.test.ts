import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Keep these off the real database: the tools are exercised against an
// in-memory source, and db.ts is only imported for tenantTabSource.
vi.mock("./db", () => ({ readTenantCollection: () => [], readTenantDoc: (_d: string, _c: string, fallback: unknown) => fallback }));

import type { AuthUser } from "./auth";
import type { TabSource } from "./pilotBrainTabs";
import { buildClientTools, chatWithTools, MAX_TOOL_ROUNDS, MAX_TOOL_CALLS_PER_CHAT } from "./pilotBrainTools";
import { runToolCalls } from "./pilotBrainToolCore";

const asUser = (role: "owner" | "staff", staffRole?: AuthUser["staffRole"]): AuthUser =>
  ({ id: "u1", email: "u@example.test", name: "Asker", role, dealershipId: "d1", ...(staffRole ? { staffRole } : {}) }) as AuthUser;

const source: TabSource = {
  list: name =>
    name === "leads"
      ? [{ id: "l1", name: "Secret Lead", phone: "07700900111", source: "AutoTrader", status: "new", createdAt: "2030-03-01T00:00:00Z" }]
      : [],
  bookkeeping: () => ({ purchases: [], sales: [{ vehicleId: "v1", salePrice: 5000, date: "2030-03-02" }], costs: [] }),
};

const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
const toolUse = (id: string, input: unknown, name = "look_inside") => ({ type: "tool_use", id, name, input });
const usesTool = (...blocks: unknown[]) => ({ stop_reason: "tool_use", content: blocks });
const says = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

const messages = [{ role: "user", content: "Which lead sources are working?" }];

describe("buildClientTools", () => {
  it("offers look_inside, limited to what THIS person's role allows", () => {
    const enumOf = (u: AuthUser) => ((buildClientTools(u, source).definitions[0] as any).input_schema.properties.tab.enum as string[]);
    expect(enumOf(asUser("owner"))).toContain("bookkeeping");
    expect(enumOf(asUser("staff", "sales"))).not.toContain("bookkeeping");
  });

  it("runs a lookup as that person, returning records as JSON text", () => {
    const out = JSON.parse(buildClientTools(asUser("owner"), source).execute("look_inside", { tab: "leads" }));
    expect(out.ok).toBe(true);
    expect(out.records).toEqual([{ id: "l1", source: "AutoTrader", status: "new", addedAt: "2030-03-01T00:00:00Z" }]);
    expect(JSON.stringify(out)).not.toContain("Secret Lead");
    expect(JSON.stringify(out)).not.toContain("07700900111");
  });

  it("refuses a tab the asker's role can't open, even though the model asked for it directly", () => {
    const out = JSON.parse(buildClientTools(asUser("staff", "sales"), source).execute("look_inside", { tab: "bookkeeping", section: "sales" }));
    expect(out.ok).toBe(false);
    expect(out.error).toContain("isn't allowed to open the bookkeeping tab");
    expect(JSON.stringify(out)).not.toContain("5000");
  });

  it("answers an unknown tool, and junk input, with an error rather than throwing", () => {
    const tools = buildClientTools(asUser("owner"), source);
    expect(JSON.parse(tools.execute("delete_everything", {})).ok).toBe(false);
    expect(JSON.parse(tools.execute("look_inside", null)).ok).toBe(false);
    expect(JSON.parse(tools.execute("look_inside", "leads")).ok).toBe(false);
  });
});

describe("runToolCalls", () => {
  it("answers every call, but only runs the first few in one message", () => {
    const tools = { definitions: [], execute: vi.fn(() => "RESULT") };
    const uses = Array.from({ length: MAX_TOOL_CALLS_PER_CHAT + 2 }, (_, i) => ({ type: "tool_use" as const, id: `t${i}`, name: "look_inside", input: {} }));
    const { results, run } = runToolCalls(tools, uses, 0);
    expect(results).toHaveLength(MAX_TOOL_CALLS_PER_CHAT + 2); // the API needs a result for every call
    expect(tools.execute).toHaveBeenCalledTimes(MAX_TOOL_CALLS_PER_CHAT);
    expect(results[0]).toEqual({ type: "tool_result", tool_use_id: "t0", content: "RESULT" });
    expect(JSON.parse(results.at(-1)!.content).error).toContain("Too many lookups");
    expect(run).toBe(MAX_TOOL_CALLS_PER_CHAT + 2);
  });

  it("counts calls already made earlier in the same message", () => {
    const tools = { definitions: [], execute: vi.fn(() => "RESULT") };
    const { results } = runToolCalls(tools, [{ type: "tool_use", id: "x", name: "look_inside", input: {} }], MAX_TOOL_CALLS_PER_CHAT);
    expect(tools.execute).not.toHaveBeenCalled();
    expect(JSON.parse(results[0]!.content).ok).toBe(false);
  });
});

describe("chatWithTools", () => {
  const fallbackCall = vi.fn();
  const tools = () => buildClientTools(asUser("owner"), source);
  const run = () =>
    chatWithTools({ apiKey: "test-key", systemWithTools: "SYSTEM WITH TOOLS", systemWithoutTools: "SYSTEM WITHOUT TOOLS", messages, tools: tools(), fallbackCall });

  beforeEach(() => {
    fallbackCall.mockReset().mockResolvedValue("plain fallback answer");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const stub = (...bodies: unknown[]) => {
    const fetchMock = vi.fn();
    bodies.forEach(b => fetchMock.mockResolvedValueOnce(reply(b)));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, i: number) => JSON.parse(fetchMock.mock.calls[i]![1].body);

  it("offers the tool with the tool prompt, and answers directly when it isn't needed", async () => {
    const fetchMock = stub(says("Straight answer."));
    expect(await run()).toBe("Straight answer.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = bodyOf(fetchMock, 0);
    expect(body.system).toBe("SYSTEM WITH TOOLS");
    expect(body.tools.map((t: any) => t.name)).toEqual(["look_inside"]);
    expect(body.messages).toEqual(messages);
    expect(fallbackCall).not.toHaveBeenCalled();
  });

  it("runs a lookup, sends the result back the way the API expects, and returns only the final words", async () => {
    const asked = [{ type: "text", text: "Let me check the leads. " }, toolUse("tu_1", { tab: "leads" })];
    const fetchMock = stub(usesTool(...asked), says("AutoTrader is bringing in your only lead."));

    const text = await run();

    expect(text).toBe("AutoTrader is bringing in your only lead."); // not "Let me check the leads."
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = bodyOf(fetchMock, 1);
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1]).toEqual({ role: "assistant", content: asked }); // sent back unchanged
    expect(second.messages[2].role).toBe("user");
    expect(second.messages[2].content).toHaveLength(1);
    expect(second.messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
    const result = JSON.parse(second.messages[2].content[0].content);
    expect(result.records[0]).toMatchObject({ source: "AutoTrader", status: "new" });
    expect(second.tools).toBeDefined(); // may look again
  });

  it("answers several lookups made at once, one result each", async () => {
    const fetchMock = stub(usesTool(toolUse("a", { tab: "leads" }), toolUse("b", { tab: "jobs" })), says("Done."));
    await run();
    const results = bodyOf(fetchMock, 1).messages[2].content;
    expect(results.map((r: any) => r.tool_use_id)).toEqual(["a", "b"]);
  });

  it("passes a refusal back to the model as a result to explain, rather than failing the chat", async () => {
    const fetchMock = stub(usesTool(toolUse("tu", { tab: "customers" })), says("I can't open that."));
    expect(await run()).toBe("I can't open that.");
    const result = JSON.parse(bodyOf(fetchMock, 1).messages[2].content[0].content);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown tab");
  });

  it("stops offering the tool on the last round, so the reply has to end in words", async () => {
    const keepAsking = usesTool(toolUse("t", { tab: "leads" }));
    const fetchMock = stub(...Array.from({ length: MAX_TOOL_ROUNDS }, () => keepAsking), says("Here's what I found."));
    expect(await run()).toBe("Here's what I found.");
    expect(fetchMock).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    for (let i = 0; i < MAX_TOOL_ROUNDS; i++) expect(bodyOf(fetchMock, i).tools).toBeDefined();
    expect(bodyOf(fetchMock, MAX_TOOL_ROUNDS).tools).toBeUndefined();
  });

  it("never loops forever: a model that still wants a tool on the last round falls back to a plain answer", async () => {
    const keepAsking = usesTool(toolUse("t", { tab: "leads" }));
    const fetchMock = stub(...Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => keepAsking));
    expect(await run()).toBe("plain fallback answer");
    expect(fetchMock).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
  });

  it("falls back to a plain answer, WITHOUT the tool prompt, if the API rejects the tool request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "nope" }, 400)));
    expect(await run()).toBe("plain fallback answer");
    expect(fallbackCall).toHaveBeenCalledWith("SYSTEM WITHOUT TOOLS", messages);
  });

  it("falls back if the reply has no text at all", async () => {
    stub({ stop_reason: "end_turn", content: [] });
    expect(await run()).toBe("plain fallback answer");
  });

  it("reads a text block that has no type field (as some stubs and older replies do)", async () => {
    stub({ content: [{ text: "Untyped text block." }] });
    expect(await run()).toBe("Untyped text block.");
    expect(fallbackCall).not.toHaveBeenCalled();
  });

  it("gives the model no way to call anything but look_inside", async () => {
    const fetchMock = stub(usesTool(toolUse("x", {}, "prepare_edit")), says("OK."));
    await run();
    const result = JSON.parse(bodyOf(fetchMock, 1).messages[2].content[0].content);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no tool called "prepare_edit"');
  });
});
