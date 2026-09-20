import { describe, it, expect, vi, afterEach } from "vitest";
import { appendToSystem, logUsage, systemParam, systemText, withSystemText } from "./pilotBrainPrompt";

describe("systemParam — what goes in the request's system field", () => {
  it("sends a plain string exactly as before, uncached", () => {
    expect(systemParam("Just the one prompt.")).toBe("Just the one prompt.");
  });

  it("turns blocks into text blocks, with a cache marker only where asked and the hour marked as such", () => {
    expect(
      systemParam([
        { text: "shared", cache: "1h" },
        { text: "dealership", cache: "5m" },
        { text: "this call" },
      ])
    ).toEqual([
      { type: "text", text: "shared", cache_control: { type: "ephemeral", ttl: "1h" } },
      { type: "text", text: "dealership", cache_control: { type: "ephemeral" } },
      { type: "text", text: "this call" },
    ]);
  });

  it("never marks an unmarked block", () => {
    const only = (systemParam([{ text: "x" }]) as { cache_control?: unknown }[])[0]!;
    expect("cache_control" in only).toBe(false);
  });
});

describe("appendToSystem — a call's own sections go after the cached blocks", () => {
  it("adds an uncached block to blocks", () => {
    expect(appendToSystem([{ text: "a", cache: "1h" }], "tail")).toEqual([{ text: "a", cache: "1h" }, { text: "tail" }]);
  });

  it("joins onto a plain string with a newline, as the old prompt did", () => {
    expect(appendToSystem("a", "tail")).toBe("a\ntail");
  });
});

describe("systemText / withSystemText — reading a prompt back as one string", () => {
  it("reads blocks in order, a string as itself, and anything else as empty", () => {
    expect(systemText([{ type: "text", text: "a" }, { type: "text", text: "b" }])).toBe("a\nb");
    expect(systemText("plain")).toBe("plain");
    expect(systemText(undefined)).toBe("");
    expect(systemText([{ type: "text" }, 7])).toBe("\n");
  });

  it("flattens a captured request body without touching the rest of it", () => {
    const body = withSystemText({ model: "m", system: [{ type: "text", text: "a" }, { type: "text", text: "b" }], tools: [1] });
    expect(body).toEqual({ model: "m", system: "a\nb", tools: [1] });
  });
});

describe("logUsage — one line per call so the cache can be seen working", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints the token counts, never the prompt or the reply", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logUsage("pilot-brain/chat", {
      model: "claude-haiku-4-5-20251001",
      content: [{ type: "text", text: "SECRET REPLY" }],
      usage: { input_tokens: 120, cache_creation_input_tokens: 0, cache_read_input_tokens: 9800, output_tokens: 210 },
    });
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]![0]);
    expect(line).toBe("pilot-brain usage: pilot-brain/chat model=claude-haiku-4-5-20251001 input=120 cache_write=0 cache_read=9800 output=210");
    expect(line).not.toContain("SECRET");
  });

  it("stays quiet when the reply carries no usage (the tests' stubs, an error body)", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logUsage("x", { content: [] });
    logUsage("x", null);
    logUsage("x", "nonsense");
    expect(log).not.toHaveBeenCalled();
  });

  it("shows which marker a write landed on when the reply breaks it down", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logUsage("pilot-brain/chat", {
      model: "m",
      usage: {
        input_tokens: 50,
        cache_creation_input_tokens: 5200,
        cache_creation: { ephemeral_1h_input_tokens: 4300, ephemeral_5m_input_tokens: 900 },
        cache_read_input_tokens: 0,
        output_tokens: 10,
      },
    });
    expect(String(log.mock.calls[0]![0])).toBe("pilot-brain usage: pilot-brain/chat model=m input=50 cache_write=5200 (1h=4300 5m=900) cache_read=0 output=10");
  });

  it("treats missing or odd counts as zero rather than printing undefined", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logUsage("x", { usage: { input_tokens: "12", output_tokens: 3 } });
    expect(String(log.mock.calls[0]![0])).toBe("pilot-brain usage: x model=? input=0 cache_write=0 cache_read=0 output=3");
  });
});
