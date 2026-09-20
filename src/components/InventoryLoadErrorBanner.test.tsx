import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement, ReactNode } from "react";

// The banner over the app for the dealer's stock. Two kinds of message: the red
// ones (the stock couldn't be loaded, a change couldn't be saved), and a calm
// amber one for a change that was dropped on purpose because someone else had
// deleted the car. That one has to be readable and dismissable with the
// keyboard, and must never look like an error the dealer has to fix.

const inventory = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/context/InventoryProvider", () => ({ useInventory: () => inventory.value }));

import InventoryLoadErrorBanner from "./InventoryLoadErrorBanner";

const NOTICE = `"Ford Fiesta (AB12 CDE)" was deleted by someone else, so your change to it wasn't saved.`;

function setContext(over: Record<string, unknown> = {}) {
  inventory.value = {
    loadError: false,
    loading: false,
    refreshInventory: vi.fn(),
    saveError: null,
    isSaving: false,
    retrySave: vi.fn(),
    saveNotice: null,
    dismissSaveNotice: vi.fn(),
    ...over,
  };
}

// The text HTML shows for a string (quotes and apostrophes are escaped).
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

// Every element in what the component returned (it uses no hooks of its own
// once useInventory is stood in for, so it can just be called).
function elements(node: ReactNode): ReactElement<{ children?: ReactNode; onClick?: () => void; role?: string }>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (node === null || typeof node !== "object") return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [element as never, ...elements(element.props.children)];
}
const textOf = (node: ReactNode): string =>
  Array.isArray(node)
    ? node.map(textOf).join("")
    : typeof node === "string" || typeof node === "number"
      ? String(node)
      : node !== null && typeof node === "object"
        ? textOf((node as ReactElement<{ children?: ReactNode }>).props.children)
        : "";

beforeEach(() => setContext());

describe("InventoryLoadErrorBanner", () => {
  it("shows nothing when there is nothing to say", () => {
    expect(renderToStaticMarkup(<InventoryLoadErrorBanner />)).toBe("");
  });

  describe("the notice about a car someone else deleted", () => {
    it("shows the notice, with an OK button", () => {
      setContext({ saveNotice: NOTICE });
      const html = renderToStaticMarkup(<InventoryLoadErrorBanner />);
      expect(html).toContain(escaped(NOTICE));
      expect(html).toMatch(/<button[^>]*>OK<\/button>/);
    });

    it("is amber and not red, and is a status message rather than an alarm", () => {
      setContext({ saveNotice: NOTICE });
      const html = renderToStaticMarkup(<InventoryLoadErrorBanner />);
      expect(html).toContain('role="status"');
      expect(html).toContain("bg-amber-500/20");
      expect(html).not.toContain('role="alert"');
      expect(html).not.toContain("red-");
    });

    it("has a real button to dismiss it, so the keyboard can reach it", () => {
      setContext({ saveNotice: NOTICE });
      const buttons = elements(InventoryLoadErrorBanner()).filter(element => element.type === "button");
      expect(buttons).toHaveLength(1);
      expect(textOf(buttons[0]!.props.children)).toBe("OK");
      expect(buttons[0]!.props).not.toHaveProperty("disabled");
      expect(buttons[0]!.props).not.toHaveProperty("tabIndex");
    });

    it("pressing OK dismisses it, and nothing else", () => {
      const dismissSaveNotice = vi.fn();
      const retrySave = vi.fn();
      const refreshInventory = vi.fn();
      setContext({ saveNotice: NOTICE, dismissSaveNotice, retrySave, refreshInventory });
      const ok = elements(InventoryLoadErrorBanner()).find(element => element.type === "button")!;
      ok.props.onClick!();
      expect(dismissSaveNotice).toHaveBeenCalledTimes(1);
      expect(retrySave).not.toHaveBeenCalled();
      expect(refreshInventory).not.toHaveBeenCalled();
    });

    it("is gone once the notice is cleared", () => {
      setContext({ saveNotice: null });
      expect(renderToStaticMarkup(<InventoryLoadErrorBanner />)).toBe("");
    });

    it("shows what is in the notice and only that: text from a car can't become markup", () => {
      setContext({ saveNotice: `"<img src=x onerror=alert(1)>" was deleted by someone else, so your change to it wasn't saved.` });
      const html = renderToStaticMarkup(<InventoryLoadErrorBanner />);
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img");
    });
  });

  describe("next to the red messages", () => {
    it("is separate from a failed save: two different alerts, each with its own button", () => {
      setContext({ saveNotice: NOTICE, saveError: "We couldn't save your latest changes to stock." });
      const html = renderToStaticMarkup(<InventoryLoadErrorBanner />);
      expect(html.match(/role="alert"/g)).toHaveLength(1); // the red one
      expect(html.match(/role="status"/g)).toHaveLength(1); // the amber one
      const [red, amber] = html.split('role="status"') as [string, string];
      expect(red).toContain("We couldn&#x27;t save your latest changes");
      expect(red).toContain("Try again");
      expect(red).not.toContain(">OK<");
      expect(amber).toContain(">OK<");
      expect(amber).not.toContain("Try again");
    });

    it("all three can show together", () => {
      setContext({ saveNotice: NOTICE, saveError: "Trouble saving.", loadError: true });
      const html = renderToStaticMarkup(<InventoryLoadErrorBanner />);
      expect(html.match(/role="alert"/g)).toHaveLength(2);
      expect(html.match(/role="status"/g)).toHaveLength(1);
    });

    it("a failed save alone still shows just the red message, with Try again", () => {
      setContext({ saveError: "Trouble saving." });
      const html = renderToStaticMarkup(<InventoryLoadErrorBanner />);
      expect(html).toContain("Trouble saving.");
      expect(html).toContain("Try again");
      expect(html).not.toContain('role="status"');
      expect(html).not.toContain(">OK<");
    });

    it("the red message's Try again still retries the save", () => {
      const retrySave = vi.fn();
      setContext({ saveError: "Trouble saving.", saveNotice: NOTICE, retrySave });
      const tryAgain = elements(InventoryLoadErrorBanner()).find(
        element => element.type === "button" && textOf(element.props.children) === "Try again"
      )!;
      tryAgain.props.onClick!();
      expect(retrySave).toHaveBeenCalledTimes(1);
    });

    it("a load failure alone still offers to try again", () => {
      setContext({ loadError: true });
      const html = renderToStaticMarkup(<InventoryLoadErrorBanner />);
      expect(html).toContain("couldn&#x27;t load your stock");
      expect(html).not.toContain('role="status"');
    });
  });
});
