import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NOT_FOUND_TITLE, PAGE_TITLES, documentTitleFor, pageNameFor } from "./pageTitles";

// The tab title and the screen-reader announcement come from one table. The
// point of these tests is that the table cannot quietly fall behind the router.

const ROUTER = fs
  .readFileSync(path.join(__dirname, "..", "router", "AnimatedRoutes.tsx"), "utf8")
  .replace(/\r/g, "");

// Every `path="..."` the router registers, made absolute like the table's keys.
function routerPaths(): string[] {
  const found = [...ROUTER.matchAll(/path="([^"]*)"/g)].map(m => m[1] as string);
  return found.filter(p => p !== "*").map(p => (p.startsWith("/") ? p : `/${p}`));
}

describe("page titles", () => {
  it("has a title for every route the router registers", () => {
    const missing = routerPaths().filter(p => PAGE_TITLES[p] === undefined);
    expect(missing).toEqual([]);
  });

  it("has no title for a route that no longer exists", () => {
    const real = new Set(routerPaths());
    // Platform-admin pages are mounted by the router too, but are listed here
    // explicitly so a rename in the router is noticed rather than tolerated.
    const stale = Object.keys(PAGE_TITLES).filter(p => !real.has(p));
    expect(stale).toEqual([]);
  });

  it("never gives two different pages the same title unless they really are the same page", () => {
    const byTitle = new Map<string, string[]>();
    for (const [route, title] of Object.entries(PAGE_TITLES)) byTitle.set(title, [...(byTitle.get(title) ?? []), route]);
    const shared = [...byTitle.entries()].filter(([, routes]) => routes.length > 1).map(([title]) => title).sort();
    // "/" redirects to the dashboard; the two are one page.
    expect(shared).toEqual(["Dashboard"]);
  });

  it("names a page by exact route, with or without a trailing slash", () => {
    expect(pageNameFor("/dealer/inventory/list")).toBe("Vehicle list");
    expect(pageNameFor("/dealer/inventory/list/")).toBe("Vehicle list");
    expect(pageNameFor("/bookkeeping")).toBe("Bookkeeping");
  });

  it("names a page that carries an id, whatever the id is", () => {
    expect(pageNameFor("/dealer/inventory/car-1")).toBe("Vehicle");
    expect(pageNameFor("/dealer/sales/leads/lead-9")).toBe("Lead");
    expect(pageNameFor("/bookkeeping/entry/abc-123")).toBe("Vehicle ledger");
    expect(pageNameFor("/book/some-dealership-id")).toBe("Book a visit");
  });

  it("does not let an id pattern swallow a fixed page beside it", () => {
    // "/dealer/inventory/list" is a page in its own right, not a vehicle called "list".
    expect(pageNameFor("/dealer/inventory/list")).toBe("Vehicle list");
    expect(pageNameFor("/dealer/inventory/mot-lookup")).toBe("MOT lookup");
    expect(pageNameFor("/dealer/staff/add")).toBe("Add a staff member");
    expect(pageNameFor("/dealer/workflow/mot")).toBe("MOT workflow");
  });

  it("does not match an id pattern with the wrong number of segments or an empty id", () => {
    expect(pageNameFor("/dealer/inventory/car-1/extra")).toBeNull();
    expect(pageNameFor("/dealer/inventory/")).toBe("Stock overview");
    expect(pageNameFor("/totally/unknown")).toBeNull();
  });

  it("puts the app name after the page name, and says so plainly for an unknown page", () => {
    expect(documentTitleFor("/diary")).toBe("Diary · FlipPilot");
    expect(documentTitleFor("/nowhere")).toBe(`${NOT_FOUND_TITLE} · FlipPilot`);
  });
});
