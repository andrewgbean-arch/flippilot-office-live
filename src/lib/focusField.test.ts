import { describe, it, expect, vi, afterEach } from "vitest";
import { focusField } from "./focusField";

// After a refused Save the first field to fix is scrolled to and focused, so on a
// phone the person is taken to the problem instead of wondering why nothing happened.

afterEach(() => vi.unstubAllGlobals());

describe("focusField", () => {
  it("scrolls the field into view and focuses it", () => {
    const calls: string[] = [];
    vi.stubGlobal("document", {
      getElementById: (id: string) => ({
        scrollIntoView: (options: unknown) => calls.push(`scroll ${id} ${JSON.stringify(options)}`),
        focus: (options: unknown) => calls.push(`focus ${id} ${JSON.stringify(options)}`),
      }),
    });
    focusField("price");
    expect(calls).toEqual(['scroll price {"block":"center","behavior":"smooth"}', 'focus price {"preventScroll":true}']);
  });

  it("does nothing, and does not throw, when there is no document", () => {
    vi.stubGlobal("document", undefined);
    expect(() => focusField("price")).not.toThrow();
  });

  it("skips a field that is not on the page", () => {
    vi.stubGlobal("document", { getElementById: () => null });
    expect(() => focusField("nothing-here")).not.toThrow();
  });

  it("copes with an element that cannot scroll or focus", () => {
    vi.stubGlobal("document", { getElementById: () => ({}) });
    expect(() => focusField("bare")).not.toThrow();
  });

  it("does not let a browser that rejects the options stop the save flow", () => {
    vi.stubGlobal("document", {
      getElementById: () => ({
        scrollIntoView: () => {
          throw new Error("bad options");
        },
        focus: () => {},
      }),
    });
    expect(() => focusField("price")).not.toThrow();
  });
});
