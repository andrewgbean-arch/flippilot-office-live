import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SupernovaDealerHUD from "./SupernovaDealerHUD";
import type { DealerHudStats } from "@/lib/dealerHudStats";

// The snapshot bar is on every page inside the layout. These render the real
// component to static HTML and check what a dealer (or a screen reader) would
// get: counts only, a plain message when there is no stock, and the pieces the
// phone's collapsible line needs to be operable.

const stats = (over: Partial<DealerHudStats> = {}): DealerHudStats => ({
  inStock: 5,
  avgDaysInStock: 34,
  daysCounted: 5,
  motExpired: 2,
  motDueSoon: 3,
  motNoDate: 1,
  ...over,
});

const render = (props: { loading?: boolean; stats: DealerHudStats }) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <SupernovaDealerHUD loading={props.loading ?? false} stats={props.stats} />
    </MemoryRouter>
  );

describe("SupernovaDealerHUD", () => {
  it("shows the real counts as links, and nothing invented", () => {
    const html = render({ stats: stats() });
    expect(html).toContain("In stock: 5");
    expect(html).toContain("Average 34 days in stock");
    expect(html).toContain("MOT expired: 2");
    expect(html).toContain("MOT due within 30 days: 3");
    expect(html).toContain("No MOT date: 1");
    expect(html).toContain('href="/dealer/workflow/mot"');
    for (const invented of ["Market", "FlipScore", "Insights", "Brain", "Supernova", "AI "]) {
      expect(html, invented).not.toContain(invented);
    }
  });

  it("is a labelled region, with a phone toggle that says it is collapsed and what it controls", () => {
    const html = render({ stats: stats() });
    expect(html).toContain('aria-label="Stock snapshot"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="hud-pills"');
    expect(html).toContain('id="hud-pills"');
    // the phone line carries the same facts in one sentence
    expect(html).toContain("5 in stock · 34 days average · MOT: 2 expired, 3 due within 30 days, 1 with no date");
  });

  it("says plainly that there is no stock, with a link to add a car, rather than showing zeros", () => {
    const html = render({ stats: stats({ inStock: 0, avgDaysInStock: null, daysCounted: 0, motExpired: 0, motDueSoon: 0, motNoDate: 0 }) });
    expect(html).toContain("No vehicles in stock right now.");
    expect(html).toContain('href="/new-flip"');
    expect(html).not.toContain("In stock: 0");
    expect(html).not.toContain('id="hud-pills"');
  });

  it("says it is loading during the first fetch, announced politely, and not 'no vehicles'", () => {
    const html = render({ loading: true, stats: stats({ inStock: 0 }) });
    expect(html).toContain("Loading your stock");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("No vehicles in stock");
  });

  it("does not flatter a fleet: all-in-date only when every car has a date and is in date", () => {
    const clean = render({ stats: stats({ motExpired: 0, motDueSoon: 0, motNoDate: 0 }) });
    expect(clean).toContain("MOT: all in date");
    const unknown = render({ stats: stats({ motExpired: 0, motDueSoon: 0, motNoDate: 2 }) });
    expect(unknown).not.toContain("MOT: all in date");
    expect(unknown).toContain("No MOT date: 2");
  });
});
