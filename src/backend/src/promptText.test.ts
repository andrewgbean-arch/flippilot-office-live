import { describe, it, expect } from "vitest";
import { oneLine } from "./engines/promptText.js";

// Staff-typed text (a lead's source, a car's make and model) is flattened by
// oneLine before it goes into Pilot Brain's prompt. Its length limit used to
// count and cut in UTF-16 units, so an emoji at the cut was left in half, and
// half an emoji is not valid text.

const EMOJI = String.fromCodePoint(0x1f600); // one character, two UTF-16 units

// encodeURIComponent throws on half an emoji, as a strict UTF-8 or JSON encoder would
function isWholeText(text: string): boolean {
  try {
    encodeURIComponent(text);
    return true;
  } catch {
    return false;
  }
}

describe("oneLine", () => {
  it("flattens line breaks and runs of spaces into one plain line", () => {
    expect(oneLine("  Facebook\n\nMarketplace \t ad  ", 40)).toBe("Facebook Marketplace ad");
  });

  it("leaves short text alone and cuts long text with an ellipsis", () => {
    expect(oneLine("Autotrader", 40)).toBe("Autotrader");
    expect(oneLine("a".repeat(10), 10)).toBe("a".repeat(10));
    expect(oneLine("a".repeat(50), 10)).toBe("a".repeat(9) + "…");
  });

  it("gives nothing for what is not text", () => {
    expect(oneLine(undefined, 10)).toBe("");
    expect(oneLine(42, 10)).toBe("");
    expect(oneLine({ a: 1 }, 10)).toBe("");
  });

  it("never cuts an emoji in half", () => {
    // 38 letters and three emoji: the cut at 40 UTF-16 units falls in the middle of the first emoji
    const cut = oneLine("a".repeat(38) + EMOJI.repeat(3), 40);
    expect(isWholeText(cut)).toBe(true);
    expect(Array.from(cut).length).toBeLessThanOrEqual(40);
    expect(cut.endsWith("…")).toBe(true);
    // wherever the limit falls in a run of emoji, what comes back is whole text
    for (let max = 2; max < 20; max++) {
      expect(isWholeText(oneLine(EMOJI.repeat(30), max)), `limit ${max}`).toBe(true);
    }
  });

  it("counts an emoji as one character when deciding whether to cut at all", () => {
    const fits = "a".repeat(38) + EMOJI.repeat(2); // 40 characters, though 42 UTF-16 units
    expect(oneLine(fits, 40)).toBe(fits);
  });
});
