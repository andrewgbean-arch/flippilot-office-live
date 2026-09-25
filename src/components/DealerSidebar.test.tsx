import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/useIsSupportAdmin", () => ({ useIsSupportAdmin: () => false }));
vi.mock("@/tour/TourProvider", () => ({ useTour: () => ({ startTour: () => {} }) }));
// The owner by default: everything in the menu. The role tests below change it.
const auth = vi.hoisted(() => ({ user: { id: "u1", role: "owner", dealershipId: "d1" } as Record<string, string> }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));

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
  [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g)].map((m) => (m[1] ?? "").replace(/&amp;/g, "&").trim());

describe("sidebar shows where you are", () => {
  it("opens the group for the current page and marks only that page", () => {
    const html = sidebarAt("/dealer/sales/leads");
    expect(currentLinks(html)).toEqual(["Leads"]);
    // Sales Overview (/dealer/sales) also matches by prefix, but must not light up too.
    expect(html).toContain("Sales Overview");
    expect(html).not.toMatch(/aria-current="page"[^>]*>Sales Overview/);
  });

  it("works for a page inside a group that starts closed", () => {
    expect(currentLinks(sidebarAt("/pilot-brain/operations"))).toEqual(["Approvals"]);
  });

  it("marks the closest parent for a page that is not itself in the menu", () => {
    // A single vehicle's page belongs to the Stock Overview entry.
    expect(currentLinks(sidebarAt("/dealer/inventory/abc-123"))).toEqual(["Stock Overview"]);
  });

  it("marks the Reports tab a report page belongs to", () => {
    // Inventory Analytics sits under the Stock tab of Reports.
    expect(currentLinks(sidebarAt("/dealer/analytics/inventory"))).toEqual(["Stock"]);
    expect(currentLinks(sidebarAt("/dealer/intelligence/risk"))).toEqual(["MOT & Risk"]);
  });

  it("shows Dashboard as one link with no sub-menu", () => {
    const html = sidebarAt("/dealer-dashboard");
    const dashLink = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]).find((tag) => tag.includes('href="/dealer-dashboard"') && !tag.includes("aria-label"));
    expect(dashLink).toContain('aria-current="page"');
    expect(html).not.toContain("Dealer Dashboard");
  });

  it("lists the nine groups in order", () => {
    const html = sidebarAt("/some/unknown/page");
    const order = ["Dashboard", "Wendy · Pilot Brain", "Stock", "Sales", "Customers", "Workshop", "Money", "Team", "Reports", "Settings"];
    let last = -1;
    for (const g of order) { const at = html.indexOf(`</svg>${g}<`); expect(at, g).toBeGreaterThan(last); last = at; }
  });

  it("marks nothing on a page the menu does not know", () => {
    expect(currentLinks(sidebarAt("/some/unknown/page"))).toEqual([]);
  });
});

describe("the menu only offers what the person's role can open", () => {
  // A group's links are only drawn while it is open, so each check stands on
  // a page inside the group it looks at.
  const as = (staffRole: string | null) => {
    auth.user = staffRole ? { id: "u2", role: "staff", staffRole, dealershipId: "d1" } : { id: "u1", role: "owner", dealershipId: "d1" };
  };
  const links = (path: string) => [...sidebarAt(path).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

  it("gives the owner everything", () => {
    as(null);
    expect(links("/dealer/finance/calculator")).toEqual(expect.arrayContaining(["/bookkeeping", "/dealer/finance/profit-breakdown"]));
    expect(links("/my-rota")).toContain("/dealer/staff/add");
    expect(links("/dealer/settings")).toContain("/billing");
    expect(links("/dealer/sales/leads")).toContain("/dealer/sales/wanted");
  });

  it("keeps the books, staff admin and billing from sales staff, but leaves them the customer finance tools", () => {
    as("sales");
    const money = links("/dealer/finance/calculator");
    expect(money).not.toContain("/bookkeeping");
    expect(money).not.toContain("/dealer/finance/profit-breakdown");
    expect(money).toContain("/dealer/finance/deal-sheet");
    expect(links("/my-rota")).not.toContain("/dealer/staff/add");
    expect(links("/my-rota")).toContain("/dealer/staff/permissions");
    expect(links("/dealer/settings")).not.toContain("/billing");
    expect(links("/dealer/sales/leads")).toContain("/dealer/sales/wanted");
  });

  it("gives finance the books but not billing or staff admin", () => {
    as("finance");
    expect(links("/dealer/finance/calculator")).toContain("/bookkeeping");
    expect(links("/dealer/settings")).not.toContain("/billing");
    expect(links("/my-rota")).not.toContain("/dealer/staff/add");
    expect(links("/dealer/sales/leads")).not.toContain("/dealer/sales/wanted");
  });

  it("gives managers the books and staff admin, but billing stays with the owner", () => {
    as("manager");
    expect(links("/dealer/finance/calculator")).toContain("/bookkeeping");
    expect(links("/my-rota")).toContain("/dealer/staff/add");
    expect(links("/dealer/settings")).not.toContain("/billing");
  });

  it("still lists every group for general staff, with Wanted Cars left out", () => {
    as("general");
    expect(links("/dealer/sales/leads")).not.toContain("/dealer/sales/wanted");
    expect(links("/dealer/sales/leads")).toContain("/dealer/sales/leads");
    as(null);
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
