import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchRow } from "./PilotBrainWebAccessCard";
import type { WebSearchLogEntry } from "@/lib/pilotBrainWebApi";

// The owner's log of what Pilot Brain searched shows where each result came
// from. Those addresses come back from the web, so only genuine web links may
// be clickable — the same rule as links inside Pilot Brain's own replies.
const entry = (urls: string[]): WebSearchLogEntry => ({
  id: "e1",
  at: "2026-09-19T10:00:00.000Z",
  askedByName: "Andrew",
  query: "ford fiesta 2018 asking price",
  resultCount: urls.length,
  sources: urls.map(url => ({ url, title: "A page" })),
});

describe("web access search log", () => {
  it("makes a genuine web address a link that opens safely in a new tab", () => {
    const html = renderToStaticMarkup(<SearchRow entry={entry(["https://www.autotrader.co.uk/cars/ford-fiesta"])} />);
    expect(html).toContain('href="https://www.autotrader.co.uk/cars/ford-fiesta"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">autotrader.co.uk</a>");
  });

  it("shows anything that is not a web address as plain text, never a link", () => {
    // (a row shows at most its first four sources)
    const first = renderToStaticMarkup(
      <SearchRow
        entry={entry(["javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "mailto:someone@example.com", "https://www.parkers.co.uk/x"])}
      />
    );
    const second = renderToStaticMarkup(<SearchRow entry={entry(["file:///C:/Windows/win.ini", "/relative/path", "//evil.example/x"])} />);

    // only the one real web address is a link
    expect(first.match(/<a /g)).toHaveLength(1);
    expect(first).toContain('href="https://www.parkers.co.uk/x"');
    expect(first).not.toContain('href="javascript');
    expect(first).not.toContain('href="data:');
    expect(first).not.toContain('href="mailto:');
    expect(second).not.toContain("<a ");
    expect(second).not.toContain("href=");
  });
});
