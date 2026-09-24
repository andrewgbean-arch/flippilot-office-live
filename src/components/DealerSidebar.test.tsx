import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/useIsSupportAdmin", () => ({ useIsSupportAdmin: () => false }));

import DealerSidebar from "./DealerSidebar";
import DashboardFooter from "./DashboardFooter";

vi.mock("@/features/dealer-notifications/DealerNotificationsContext", () => ({
  useDealerNotifications: () => ({ notifications: [], clearNotification: () => {}, clearAll: () => {} }),
}));

const sidebarAt = (path: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <DealerSidebar />
    </MemoryRouter>
  );

// The link marked as the current page, by its visible text.
const currentLinks = (html: string) =>
  [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g)].map((m) => (m[1] ?? "").trim());

describe("sidebar shows where you are", () => {
  it("opens the group for the current page and marks only that page", () => {
    const html = sidebarAt("/dealer/sales/leads");
    expect(currentLinks(html)).toEqual(["Leads Dashboard"]);
    // Sales Hub (/dealer/sales) also matches by prefix, but must not light up too.
    expect(html).toContain("Sales Hub");
    expect(html).not.toMatch(/aria-current="page"[^>]*>Sales Hub/);
  });

  it("works for a page inside a group that starts closed", () => {
    expect(currentLinks(sidebarAt("/pilot-brain/operations"))).toEqual(["Operations (Approvals)"]);
  });

  it("marks the closest parent for a page that is not itself in the menu", () => {
    // A single vehicle's page belongs to the Inventory Hub entry.
    expect(currentLinks(sidebarAt("/dealer/inventory/abc-123"))).toEqual(["Inventory Hub"]);
  });

  it("marks nothing on a page the menu does not know", () => {
    expect(currentLinks(sidebarAt("/some/unknown/page"))).toEqual([]);
  });
});

describe("bottom bar shows where you are", () => {
  const footerAt = (path: string) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <DashboardFooter />
      </MemoryRouter>
    );

  it("lights up the button for the current page", () => {
    const html = footerAt("/dealer/inventory/mot-lookup");
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/aria-current="page"[\s\S]*?MOT Check/);
  });

  it("lights up nothing elsewhere", () => {
    expect(footerAt("/dealer/sales/leads")).not.toContain('aria-current="page"');
  });
});
