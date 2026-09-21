import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The state helpers read/write a per-dealership doc; keep these tests off
// the real SQLite file with a tiny in-memory stand-in.
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("./db", () => ({
  readTenantDoc: (dealershipId: string, collection: string, fallback: unknown) =>
    store.has(`${dealershipId}/${collection}`)
      ? structuredClone(store.get(`${dealershipId}/${collection}`))
      : fallback,
  writeTenantDoc: (dealershipId: string, collection: string, data: unknown) => {
    store.set(`${dealershipId}/${collection}`, structuredClone(data));
  },
}));

import {
  WEB_SEARCH_ALLOWED_DOMAINS,
  WEB_SEARCH_DAILY_CAP,
  WEB_SEARCH_MAX_USES_PER_CHAT,
  WEB_SOURCES_MARKER,
  buildWebSearchTool,
  chatWithWebSearch,
  chooseSources,
  formatSourcesFooter,
  parseWebResponse,
  joinTextBlocks,
  readWebState,
  recordWebSearches,
  setWebEnabled,
  stripWebSourcesFooter,
  webAccessMode,
  webAccessPromptSection,
  webSearchesRemaining,
  webUsageToday,
} from "./pilotBrainWeb";

// The example response shape from Anthropic's web search documentation.
const EXAMPLE_CONTENT = [
  { type: "text", text: "I'll look up current Fiesta prices. " },
  { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "ford fiesta 2018 asking price uk" } },
  {
    type: "web_search_tool_result",
    tool_use_id: "srvtoolu_1",
    content: [
      { type: "web_search_result", url: "https://www.autotrader.co.uk/cars/ford-fiesta", title: "Used Ford Fiesta for sale", encrypted_content: "abc", page_age: "September 2, 2026" },
      { type: "web_search_result", url: "https://www.motors.co.uk/ford/fiesta", title: "Ford Fiesta | Motors", encrypted_content: "def" },
    ],
  },
  {
    type: "text",
    text: "Asking prices sit around £6,000–£7,500.",
    citations: [
      { type: "web_search_result_location", url: "https://www.autotrader.co.uk/cars/ford-fiesta", title: "Used Ford Fiesta for sale", encrypted_index: "x", cited_text: "..." },
    ],
  },
];

describe("allowed domains", () => {
  it("are plain lower-case ASCII hostnames the API will accept — no scheme, wildcard, or look-alike characters", () => {
    expect(WEB_SEARCH_ALLOWED_DOMAINS.length).toBeGreaterThan(0);
    expect(WEB_SEARCH_ALLOWED_DOMAINS.length).toBeLessThanOrEqual(64);
    expect(new Set(WEB_SEARCH_ALLOWED_DOMAINS).size).toBe(WEB_SEARCH_ALLOWED_DOMAINS.length);
    for (const d of WEB_SEARCH_ALLOWED_DOMAINS) {
      expect(d, d).toMatch(/^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/);
      expect(d).not.toContain("*");
      expect(d).not.toContain("://");
    }
  });
});

describe("buildWebSearchTool", () => {
  it("is the basic web search tool, limited to the motoring sites and localised to the UK", () => {
    const tool = buildWebSearchTool(WEB_SEARCH_DAILY_CAP);
    expect(tool.type).toBe("web_search_20250305");
    expect(tool.name).toBe("web_search");
    expect(tool.allowed_domains).toEqual(WEB_SEARCH_ALLOWED_DOMAINS);
    expect(tool.user_location).toEqual({ type: "approximate", country: "GB", timezone: "Europe/London" });
    // The API rejects a request that has both lists.
    expect("blocked_domains" in tool).toBe(false);
  });

  it("never lets one reply search more than the per-reply limit, or more than today's allowance has left", () => {
    expect(buildWebSearchTool(50).max_uses).toBe(WEB_SEARCH_MAX_USES_PER_CHAT);
    expect(buildWebSearchTool(2).max_uses).toBe(2);
    expect(buildWebSearchTool(1).max_uses).toBe(1);
  });
});

describe("joinTextBlocks", () => {
  it("puts a paragraph break between a finished sentence and a fresh one, so words around a lookup never run together", () => {
    expect(joinTextBlocks(["Let me look at the aging stock in detail.", "Let me get a clearer view.", "Good — now the oldest stock: the BMW."]))
      .toBe("Let me look at the aging stock in detail.\n\nLet me get a clearer view.\n\nGood — now the oldest stock: the BMW.");
  });

  it("runs pieces on as they were when a citation split a sentence in half", () => {
    expect(joinTextBlocks(["Asking prices range ", "between £11,890 and £14,250", " for a 2017 320d."])).toBe("Asking prices range between £11,890 and £14,250 for a 2017 320d.");
    expect(joinTextBlocks(["Two things stand out. ", "First, the BMW."])).toBe("Two things stand out. First, the BMW.");
  });

  it("ignores empty pieces and trims the ends", () => {
    expect(joinTextBlocks(["", "  Hello Boss.  ", ""])).toBe("Hello Boss.");
    expect(joinTextBlocks([])).toBe("");
  });
});

describe("parseWebResponse", () => {
  it("keeps the words before and after a search apart", () => {
    const parsed = parseWebResponse([
      { type: "text", text: "Let me check the market." },
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "2017 320d price" } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: "https://www.autotrader.co.uk/x", title: "Used BMW" }] },
      { type: "text", text: "Similar cars ask £11,890 to £14,250." },
    ]);
    expect(parsed.text).toBe("Let me check the market.\n\nSimilar cars ask £11,890 to £14,250.");
  });

  it("reads the text, what was searched, and the results and citations", () => {
    const parsed = parseWebResponse(EXAMPLE_CONTENT);
    expect(parsed.text).toBe("I'll look up current Fiesta prices. Asking prices sit around £6,000–£7,500.");
    expect(parsed.searches).toEqual([
      {
        query: "ford fiesta 2018 asking price uk",
        resultCount: 2,
        sources: [
          { url: "https://www.autotrader.co.uk/cars/ford-fiesta", title: "Used Ford Fiesta for sale", pageAge: "September 2, 2026" },
          { url: "https://www.motors.co.uk/ford/fiesta", title: "Ford Fiesta | Motors" },
        ],
      },
    ]);
    expect(parsed.cited).toHaveLength(1);
    expect(parsed.retrieved).toHaveLength(2);
  });

  it("records a search error (HTTP 200 with an error OBJECT instead of a list) without treating it as results", () => {
    const parsed = parseWebResponse([
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "q" } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
      { type: "text", text: "I couldn't search." },
    ]);
    expect(parsed.searches).toEqual([{ query: "q", resultCount: 0, sources: [], errorCode: "max_uses_exceeded" }]);
    expect(parsed.text).toBe("I couldn't search.");
  });

  it("treats a search that matched nothing (an empty list) as a search that ran, not an error", () => {
    const parsed = parseWebResponse([
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "q" } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: [] },
    ]);
    expect(parsed.searches).toEqual([{ query: "q", resultCount: 0, sources: [] }]);
  });

  it("copes with junk instead of throwing — the response is third-party data", () => {
    expect(() => parseWebResponse(null)).not.toThrow();
    expect(() => parseWebResponse("nope")).not.toThrow();
    expect(() =>
      parseWebResponse([null, 5, {}, { type: "text" }, { type: "web_search_tool_result" }, { type: "server_tool_use", name: "web_search" }])
    ).not.toThrow();
    expect(parseWebResponse(undefined).text).toBe("");
  });
});

describe("chooseSources", () => {
  it("prefers what was actually cited, and carries the page date over from the retrieved result", () => {
    const parsed = parseWebResponse(EXAMPLE_CONTENT);
    expect(chooseSources(parsed)).toEqual([
      { url: "https://www.autotrader.co.uk/cars/ford-fiesta", title: "Used Ford Fiesta for sale", pageAge: "September 2, 2026" },
    ]);
  });

  it("falls back to what was retrieved when nothing was cited, de-duplicated and capped", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ url: `https://example.com/${i % 7}`, title: `T${i}` }));
    const chosen = chooseSources({ text: "", searches: [], cited: [], retrieved: many });
    expect(chosen).toHaveLength(5);
    expect(new Set(chosen.map(s => s.url)).size).toBe(5);
  });

  it("drops anything that isn't a real http(s) link", () => {
    const chosen = chooseSources({
      text: "",
      searches: [],
      cited: [],
      retrieved: [
        { url: "javascript:alert(1)", title: "bad" },
        { url: "ftp://example.com/x", title: "bad" },
        { url: "not a url", title: "bad" },
        { url: "https://www.gov.uk/check-mot-history", title: "" },
      ],
    });
    expect(chosen).toEqual([{ url: "https://www.gov.uk/check-mot-history", title: "www.gov.uk" }]);
  });
});

describe("formatSourcesFooter", () => {
  it("is empty with no sources", () => {
    expect(formatSourcesFooter([])).toBe("");
  });

  it("lists each source as a link with its site and page date, under a marker that can be cut off", () => {
    const footer = formatSourcesFooter(chooseSources(parseWebResponse(EXAMPLE_CONTENT)));
    expect(footer.startsWith(WEB_SOURCES_MARKER)).toBe(true);
    expect(footer).toContain("[Used Ford Fiesta for sale](https://www.autotrader.co.uk/cars/ford-fiesta)");
    expect(footer).toContain("autotrader.co.uk, page dated September 2, 2026");
    expect(footer).not.toContain("www.autotrader.co.uk, page"); // shown as the plain site name
  });

  it("can't be used to plant a fake link: a hostile page title is escaped, so there is exactly one link per source", () => {
    const footer = formatSourcesFooter([
      { url: "https://www.autotrader.co.uk/x", title: "Great deal](https://evil.example/login) [Click to verify", pageAge: "](https://evil.example)" },
    ]);
    // Count Markdown links: "](" not preceded by a backslash.
    const links = footer.match(/(?<!\\)\]\(/g) ?? [];
    expect(links).toHaveLength(1);
    expect(footer).not.toMatch(/(?<!\\)\]\(https:\/\/evil/);
  });

  it("keeps parentheses and spaces in a URL from breaking out of the link", () => {
    const footer = formatSourcesFooter([{ url: "https://example.com/a(b) c", title: "T" }]);
    expect(footer).toContain("(https://example.com/a%28b%29%20c)");
  });
});

describe("stripWebSourcesFooter", () => {
  it("removes the sources footer so it isn't read aloud, and leaves a reply without one alone", () => {
    const reply = "Asking prices are £6,000–£7,500.";
    const withFooter = reply + formatSourcesFooter([{ url: "https://www.autotrader.co.uk/x", title: "T" }]);
    expect(stripWebSourcesFooter(withFooter)).toBe(reply);
    expect(stripWebSourcesFooter(reply)).toBe(reply);
  });
});

describe("switch, daily allowance and log", () => {
  const NOW = Date.parse("2030-03-15T12:00:00Z");
  beforeEach(() => store.clear());

  it("is off by default, and on once the owner switches it on", () => {
    expect(webAccessMode(readWebState("d1"), NOW)).toBe("off");
    setWebEnabled("d1", true);
    expect(webAccessMode(readWebState("d1"), NOW)).toBe("on");
    setWebEnabled("d1", false);
    expect(webAccessMode(readWebState("d1"), NOW)).toBe("off");
  });

  it("keeps each dealership's switch and usage separate", () => {
    setWebEnabled("d1", true);
    recordWebSearches("d1", "Sam", [{ query: "q", resultCount: 1, sources: [] }], NOW);
    expect(webAccessMode(readWebState("d2"), NOW)).toBe("off");
    expect(webUsageToday(readWebState("d2"), NOW)).toBe(0);
  });

  it("counts searches that ran against today's allowance, but not ones that errored — and logs both", () => {
    setWebEnabled("d1", true);
    recordWebSearches(
      "d1",
      "Sam",
      [
        { query: "ran", resultCount: 3, sources: [] },
        { query: "failed", resultCount: 0, sources: [], errorCode: "unavailable" },
      ],
      NOW
    );
    const state = readWebState("d1");
    expect(webUsageToday(state, NOW)).toBe(1);
    expect(webSearchesRemaining(state, NOW)).toBe(WEB_SEARCH_DAILY_CAP - 1);
    expect(state.log.map(e => e.query)).toEqual(["ran", "failed"]);
    expect(state.log[0]!.askedByName).toBe("Sam");
    expect(state.log[1]!.errorCode).toBe("unavailable");
  });

  it("goes to 'capped' once the day's allowance is used, and resets on the next day", () => {
    setWebEnabled("d1", true);
    const searches = Array.from({ length: WEB_SEARCH_DAILY_CAP }, (_, i) => ({ query: `q${i}`, resultCount: 1, sources: [] }));
    recordWebSearches("d1", "Sam", searches, NOW);

    expect(webAccessMode(readWebState("d1"), NOW)).toBe("capped");
    expect(webSearchesRemaining(readWebState("d1"), NOW)).toBe(0);

    const tomorrow = NOW + 24 * 3600 * 1000;
    expect(webAccessMode(readWebState("d1"), tomorrow)).toBe("on");
    expect(webUsageToday(readWebState("d1"), tomorrow)).toBe(0);
  });

  it("keeps only real web links in the log — the owner's screen shows them as links", () => {
    setWebEnabled("d1", true);
    recordWebSearches(
      "d1",
      "Sam",
      [
        {
          query: "q",
          resultCount: 3,
          sources: [
            { url: "javascript:alert(1)", title: "bad" },
            { url: "https://www.gov.uk/check-mot-history", title: "GOV.UK" },
            { url: "not a url", title: "bad" },
          ],
        },
      ],
      NOW
    );
    expect(readWebState("d1").log[0]!.sources).toEqual([{ url: "https://www.gov.uk/check-mot-history", title: "GOV.UK" }]);
  });

  it("keeps only the most recent 200 log entries", () => {
    setWebEnabled("d1", true);
    for (let batch = 0; batch < 3; batch++) {
      const searches = Array.from({ length: 100 }, (_, i) => ({ query: `b${batch}-${i}`, resultCount: 0, sources: [], errorCode: "x" }));
      recordWebSearches("d1", "Sam", searches, NOW);
    }
    const log = readWebState("d1").log;
    expect(log).toHaveLength(200);
    expect(log[0]!.query).toBe("b1-0"); // the oldest 100 were dropped
    expect(log[199]!.query).toBe("b2-99");
  });
});

describe("webAccessPromptSection", () => {
  it("tells Pilot Brain the truth for each state, so it never claims a lookup it didn't do", () => {
    const on = webAccessPromptSection("on");
    expect(on).toContain("NEVER put customers' names");
    expect(on).toContain("untrusted third-party text");
    expect(on).toContain("ASKING price");
    expect(webAccessPromptSection("off")).toContain("owner hasn't switched it on");
    expect(webAccessPromptSection("capped")).toContain("allowance has been used up");
    expect(webAccessPromptSection("unavailable")).toContain("isn't available right now");
  });
});

describe("chatWithWebSearch", () => {
  const tool = buildWebSearchTool(WEB_SEARCH_DAILY_CAP);
  const messages = [{ role: "user", content: "What are Fiestas going for?" }];
  const fallbackCall = vi.fn();

  function reply(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
  }
  function run() {
    return chatWithWebSearch({
      apiKey: "test-key",
      systemPromptWithWeb: "SYSTEM WITH WEB",
      systemPromptWithoutWeb: "SYSTEM WITHOUT WEB",
      messages,
      tool,
      fallbackCall,
    });
  }

  beforeEach(() => {
    fallbackCall.mockReset().mockResolvedValue("plain fallback answer");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.ANTHROPIC_API_URL;
  });

  it("sends the search tool with the web-enabled prompt, and returns the answer, sources and what was searched", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { stop_reason: "end_turn", content: EXAMPLE_CONTENT }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.system).toBe("SYSTEM WITH WEB");
    expect(body.tools).toEqual([tool]);
    expect(body.messages).toEqual(messages);

    expect(out.webFailed).toBe(false);
    expect(out.text).toContain("Asking prices sit around");
    expect(out.footer).toContain("autotrader.co.uk");
    expect(out.searches.map(s => s.query)).toEqual(["ford fiesta 2018 asking price uk"]);
    expect(fallbackCall).not.toHaveBeenCalled();
  });

  it("resumes a paused turn by sending the assistant content back UNCHANGED, with the same tools", async () => {
    const paused = [
      { type: "text", text: "Looking that up. " },
      { type: "server_tool_use", id: "srvtoolu_9", name: "web_search", input: { query: "q" } },
    ];
    const finished = [
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_9", content: [{ type: "web_search_result", url: "https://www.gov.uk/x", title: "GOV.UK", encrypted_content: "zz" }] },
      { type: "text", text: "Here is what I found." },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { stop_reason: "pause_turn", content: paused }))
      .mockResolvedValueOnce(reply(200, { stop_reason: "end_turn", content: finished }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await run();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(second.tools).toEqual([tool]);
    expect(second.messages).toEqual([...messages, { role: "assistant", content: paused }]);
    expect(out.text).toBe("Looking that up. Here is what I found.");
    expect(out.searches).toEqual([
      { query: "q", resultCount: 1, sources: [{ url: "https://www.gov.uk/x", title: "GOV.UK" }] },
    ]);
  });

  it("stops resuming after a few pauses rather than looping forever", async () => {
    const pausedForever = reply(200, { stop_reason: "pause_turn", content: [{ type: "text", text: "still going " }] });
    const fetchMock = vi.fn().mockResolvedValue(pausedForever);
    vi.stubGlobal("fetch", fetchMock);

    const out = await run();

    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(5);
    expect(out.text).toContain("still going");
  });

  it("answers without the web, and says so, when the API rejects the web-enabled request (e.g. web search disabled for the org)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(400, { type: "error", error: { type: "invalid_request_error", message: "web search is not enabled" } }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await run();

    expect(out.webFailed).toBe(true);
    expect(out.text).toBe("plain fallback answer");
    expect(out.footer).toBe("");
    expect(fallbackCall).toHaveBeenCalledWith("SYSTEM WITHOUT WEB", messages);
  });

  it("never trusts the body of a failed request, even if it happens to look like an answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply(529, { stop_reason: "end_turn", content: [{ type: "text", text: "SHOULD NOT BE USED" }] }))
    );

    const out = await run();

    expect(out.webFailed).toBe(true);
    expect(out.text).toBe("plain fallback answer");
  });

  it("falls back too if the request throws (network, timeout), still reporting any searches that had already run", async () => {
    const paused = [
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "ran before it broke" } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: "https://www.gov.uk/x", title: "T" }] },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { stop_reason: "pause_turn", content: paused }))
      .mockRejectedValueOnce(new Error("socket hang up"));
    vi.stubGlobal("fetch", fetchMock);

    const out = await run();

    expect(out.webFailed).toBe(true);
    expect(out.text).toBe("plain fallback answer");
    expect(out.searches.map(s => s.query)).toEqual(["ran before it broke"]);
  });

  it("falls back if the answer comes back with no text at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { stop_reason: "end_turn", content: [] })));
    const out = await run();
    expect(out.webFailed).toBe(true);
    expect(out.text).toBe("plain fallback answer");
  });

  it("can be pointed elsewhere with ANTHROPIC_API_URL (tests, a staging proxy)", async () => {
    process.env.ANTHROPIC_API_URL = "http://127.0.0.1:9999/v1/messages";
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { stop_reason: "end_turn", content: EXAMPLE_CONTENT }));
    vi.stubGlobal("fetch", fetchMock);
    await run();
    expect(fetchMock.mock.calls[0]![0]).toBe("http://127.0.0.1:9999/v1/messages");
  });
});

// The web-search call can also carry the look_inside tool. A tool call ends
// the assistant's message and needs its result sent back; a paused search
// resumes the SAME message. These check the two never get mixed up.
describe("chatWithWebSearch alongside the look_inside tool", () => {
  const tool = buildWebSearchTool(WEB_SEARCH_DAILY_CAP);
  const messages = [{ role: "user", content: "Which cars are ageing, and what are they going for online?" }];
  const fallbackCall = vi.fn();
  const execute = vi.fn((_name: string, _input: unknown) => JSON.stringify({ ok: true, records: [{ id: "v1" }] }));
  const clientTools = { definitions: [{ name: "look_inside" }], execute };

  const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  const run = () =>
    chatWithWebSearch({ apiKey: "k", systemPromptWithWeb: "WITH WEB", systemPromptWithoutWeb: "WITHOUT WEB", messages, tool, clientTools, fallbackCall });
  const stub = (...bodies: unknown[]) => {
    const fetchMock = vi.fn();
    bodies.forEach(b => fetchMock.mockResolvedValueOnce(reply(b)));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  const bodyOf = (m: ReturnType<typeof vi.fn>, i: number) => JSON.parse(m.mock.calls[i]![1].body);
  const useTool = (id: string) => ({ type: "tool_use", id, name: "look_inside", input: { tab: "inventory" } });

  beforeEach(() => {
    fallbackCall.mockReset().mockResolvedValue("plain fallback answer");
    execute.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the web search tool AND look_inside together", async () => {
    const m = stub({ stop_reason: "end_turn", content: [{ type: "text", text: "Answer." }] });
    const out = await run();
    expect(bodyOf(m, 0).tools).toEqual([tool, { name: "look_inside" }]);
    expect(out.text).toBe("Answer.");
    expect(execute).not.toHaveBeenCalled();
  });

  it("runs a look_inside call, sends the result back, and carries on to the answer", async () => {
    const asked = [{ type: "text", text: "Checking stock. " }, useTool("tu_1")];
    const m = stub({ stop_reason: "tool_use", content: asked }, { stop_reason: "end_turn", content: [{ type: "text", text: "Two cars are ageing." }] });

    const out = await run();

    expect(execute).toHaveBeenCalledWith("look_inside", { tab: "inventory" });
    const second = bodyOf(m, 1);
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1]).toEqual({ role: "assistant", content: asked });
    expect(second.messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "tu_1", content: JSON.stringify({ ok: true, records: [{ id: "v1" }] }) }],
    });
    expect(second.tools).toEqual([tool, { name: "look_inside" }]);
    expect(out.webFailed).toBe(false);
    expect(out.text).toContain("Two cars are ageing.");
  });

  it("a paused search resumes the SAME assistant message, and a tool call after it starts a new one", async () => {
    const paused = [{ type: "text", text: "Looking up prices. " }, { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "q" } }];
    const afterPause = [
      { type: "web_search_tool_result", tool_use_id: "srv_1", content: [{ type: "web_search_result", url: "https://www.gov.uk/x", title: "GOV.UK", encrypted_content: "e" }] },
      useTool("tu_2"),
    ];
    const m = stub(
      { stop_reason: "pause_turn", content: paused },
      { stop_reason: "tool_use", content: afterPause },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Both done." }] }
    );

    const out = await run();

    // resuming the pause: the paused content alone, unchanged
    expect(bodyOf(m, 1).messages).toEqual([...messages, { role: "assistant", content: paused }]);
    // after the tool call: ONE assistant message holding the pause AND the tool call, then the result
    const third = bodyOf(m, 2).messages;
    expect(third).toHaveLength(3);
    expect(third[1]).toEqual({ role: "assistant", content: [...paused, ...afterPause] });
    expect(third[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_2" });
    expect(out.searches.map(s => s.query)).toEqual(["q"]);
    expect(out.text).toContain("Both done.");
  });

  it("holds the limit on lookups in one message, but still answers every call", async () => {
    const many = Array.from({ length: 9 }, (_, i) => useTool(`t${i}`));
    const m = stub({ stop_reason: "tool_use", content: many }, { stop_reason: "end_turn", content: [{ type: "text", text: "Done." }] });
    await run();
    expect(bodyOf(m, 1).messages[2].content).toHaveLength(9);
    expect(execute).toHaveBeenCalledTimes(6);
  });

  it("allows several rounds of lookups in a row before the answer, more than a search alone would", async () => {
    const m = stub(...Array.from({ length: 5 }, () => ({ stop_reason: "tool_use", content: [useTool("t")] })), { stop_reason: "end_turn", content: [{ type: "text", text: "Finally." }] });
    const out = await run();
    expect(out.webFailed).toBe(false);
    expect(out.text).toContain("Finally.");
    expect(m).toHaveBeenCalledTimes(6);
    expect(fallbackCall).not.toHaveBeenCalled();
  });

  it("never loops forever on tool calls: it gives up and answers without the web or tools", async () => {
    const m = stub(...Array.from({ length: 20 }, () => ({ stop_reason: "tool_use", content: [useTool("t")] })));
    const out = await run();
    expect(out.webFailed).toBe(true);
    expect(out.text).toBe("plain fallback answer");
    expect(fallbackCall).toHaveBeenCalledWith("WITHOUT WEB", messages);
    expect(m.mock.calls.length).toBeLessThanOrEqual(3 + 4 + 1);
  });

  it("without look_inside configured, a tool_use stop is not acted on (behaviour unchanged)", async () => {
    const m = stub({ stop_reason: "tool_use", content: [{ type: "text", text: "Text only." }, useTool("t")] });
    const out = await chatWithWebSearch({ apiKey: "k", systemPromptWithWeb: "W", systemPromptWithoutWeb: "WO", messages, tool, fallbackCall });
    expect(m).toHaveBeenCalledTimes(1);
    expect(out.text).toContain("Text only.");
  });
});
