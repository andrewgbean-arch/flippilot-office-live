import { describe, it, expect } from "vitest";
import { MAX_LINE, MAX_LINES, passportUrl, remainingSuggestions, sameDraft, toDraft, withLine, withoutLine, type Draft } from "./passportDraft";
import { QR_QUIET_ZONE, qrModules, qrPath } from "./passportQr";

const draft = (over: Partial<Draft> = {}): Draft => ({
  published: false,
  showReg: true,
  showMot: true,
  showUlez: true,
  showMarket: false,
  workDone: [],
  note: "",
  ...over,
});

describe("toDraft and sameDraft", () => {
  it("copies the settings, without the save time, and without sharing the list", () => {
    const settings = { ...draft({ workDone: ["New pads"] }), updatedAt: "2030-01-01T00:00:00Z" };
    const d = toDraft(settings);
    expect(d).toEqual(draft({ workDone: ["New pads"] }));
    expect(d).not.toHaveProperty("updatedAt");
    d.workDone.push("Valet");
    expect(settings.workDone).toEqual(["New pads"]);
  });

  it("notices every kind of change, and nothing else", () => {
    const base = draft({ workDone: ["a", "b"], note: "hi" });
    expect(sameDraft(base, toDraft({ ...base, workDone: ["a", "b"], updatedAt: "x" }))).toBe(true);
    for (const changed of [
      { published: true },
      { showReg: false },
      { showMot: false },
      { showUlez: false },
      { showMarket: true },
      { note: "hello" },
      { workDone: ["a"] },
      { workDone: ["a", "c"] },
      { workDone: ["b", "a"] },
    ]) {
      expect(sameDraft(base, { ...base, ...changed }), JSON.stringify(changed)).toBe(false);
    }
  });
});

describe("withLine", () => {
  it("adds a tidied line to the end", () => {
    const r = withLine(draft({ workDone: ["New pads"] }), "  Full   valet ");
    expect(r).toEqual({ ok: true, draft: draft({ workDone: ["New pads", "Full valet"] }) });
  });

  it("says why it can't: empty, too long, a repeat, or too many", () => {
    const err = (r: ReturnType<typeof withLine>) => (r.ok ? "" : r.error);
    expect(err(withLine(draft(), "   "))).toContain("Type a line");
    expect(err(withLine(draft(), "x".repeat(MAX_LINE + 1)))).toContain(`${MAX_LINE}`);
    expect(err(withLine(draft({ workDone: ["New pads"] }), "new PADS"))).toContain("already there");
    expect(err(withLine(draft({ workDone: Array.from({ length: MAX_LINES }, (_, i) => `Line ${i}`) }), "One more"))).toContain(`${MAX_LINES}`);
  });

  it("accepts a line of exactly the maximum length", () => {
    expect(withLine(draft(), "x".repeat(MAX_LINE)).ok).toBe(true);
  });

  it("doesn't change the draft it was given", () => {
    const d = draft({ workDone: ["a"] });
    withLine(d, "b");
    expect(d.workDone).toEqual(["a"]);
  });
});

describe("withoutLine", () => {
  it("removes just that line", () => {
    expect(withoutLine(draft({ workDone: ["a", "b", "c"] }), 1).workDone).toEqual(["a", "c"]);
    expect(withoutLine(draft({ workDone: ["a"] }), 5).workDone).toEqual(["a"]);
  });
});

describe("remainingSuggestions", () => {
  it("offers only what isn't already on the list, however it's capitalised", () => {
    expect(remainingSuggestions(["Full valet", "Two new tyres", "MOT"], draft({ workDone: ["full VALET", "mot"] }))).toEqual(["Two new tyres"]);
    expect(remainingSuggestions([], draft())).toEqual([]);
  });
});

describe("passportUrl", () => {
  it("builds the address a buyer opens from where the app is running", () => {
    expect(passportUrl("https://app.example.com", "d1", "v1")).toBe("https://app.example.com/car/d1/v1");
    expect(passportUrl("https://app.example.com/", "d 1", "v/1")).toBe("https://app.example.com/car/d%201/v%2F1");
  });
});

describe("the QR code", () => {
  const url = "https://app.example.com/car/d1/v1";
  const modules = qrModules(url);

  it("is a square grid big enough for the address", () => {
    expect(modules.length).toBeGreaterThanOrEqual(21); // the smallest QR code
    expect(modules.every(row => row.length === modules.length)).toBe(true);
  });

  it("has the three corner finder squares every scanner looks for", () => {
    const n = modules.length;
    const finder = (r0: number, c0: number) => {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          const edge = i === 0 || i === 6 || j === 0 || j === 6;
          const centre = i >= 2 && i <= 4 && j >= 2 && j <= 4;
          expect(modules[r0 + i]![c0 + j], `${r0 + i},${c0 + j}`).toBe(edge || centre);
        }
      }
    };
    finder(0, 0);
    finder(0, n - 7);
    finder(n - 7, 0);
  });

  it("is different for a different address, and the same for the same one", () => {
    expect(qrModules(url)).toEqual(modules);
    expect(qrModules("https://app.example.com/car/d1/v2")).not.toEqual(modules);
  });

  it("draws every dark square, and only those, in one path", () => {
    const path = qrPath(modules);
    const dark = modules.flat().filter(Boolean).length;
    expect(path.match(/M/g)).toHaveLength(dark);
    expect(path.startsWith("M")).toBe(true);
    expect(qrPath([[false, false], [false, false]])).toBe("");
  });

  it("leaves a quiet border for scanners", () => {
    expect(QR_QUIET_ZONE).toBeGreaterThanOrEqual(4);
  });
});
