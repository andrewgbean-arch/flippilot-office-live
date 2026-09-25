import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// The card is rendered to static HTML against fake records, the way the
// intelligence screens are tested: no browser, no effects, just what a new
// dealer would see on the page.

const inventory = vi.hoisted(() => ({ vehicles: [] as unknown[], loading: false }));
const books = vi.hoisted(() => ({ sales: [] as unknown[] }));
const bookings = vi.hoisted(() => ({ appointments: [] as unknown[], loading: false }));
const auth = vi.hoisted(() => ({ user: { id: "u1", role: "owner" } as { id: string; role: string; staffRole?: string } }));

vi.mock("@/context/InventoryProvider", () => ({ useInventory: () => inventory }));
vi.mock("@/bookkeeping/BookkeepingProvider", () => ({ useBookkeeping: () => books }));
vi.mock("@/context/AppointmentsContext", () => ({ useAppointments: () => bookings }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/lib/decisionsApi", () => ({ fetchDecisions: vi.fn(async () => ({ ok: true, decisions: [], stats: { total: 0 } })) }));

import GettingStartedCard from "./GettingStartedCard";

const render = () => renderToStaticMarkup(<MemoryRouter><GettingStartedCard /></MemoryRouter>);

beforeEach(() => {
  inventory.vehicles = [];
  books.sales = [];
  bookings.appointments = [];
  auth.user = { id: "u1", role: "owner" };
});

describe("Getting started card", () => {
  it("shows a new owner the four things to do, each linking to the right screen", () => {
    const html = render();
    expect(html).toContain("Getting started");
    expect(html).toContain("0 of 4 done");
    for (const [title, href] of [
      ["Record a sale", "/bookkeeping/add-sale"],
      ["Mark how bookings went", "/appointments"],
      ["A photo and an MOT date on every car", "/new-flip"],
      ["Write one decision down", "/pilot-brain/decisions"],
    ]) {
      expect(html).toContain(title);
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("Hide this");
  });

  it("does not offer the Decision Journal, or a sale they are not sent the books for, to sales staff", () => {
    auth.user = { id: "u2", role: "staff", staffRole: "sales" };
    const html = render();
    expect(html).toContain("0 of 2 done");
    expect(html).not.toContain("Write one decision down");
    expect(html).not.toContain("Record a sale");
  });

  it("ticks off what has been done and disappears once everything has", () => {
    inventory.vehicles = [{ id: "v1", status: "in_stock", images: ["a.jpg"], mot: { expiry: "2027-06-01", advisories: [] } }];
    books.sales = [{ id: "s1", vehicleId: "v1", salePrice: 5000, date: "2026-09-01" }];
    // finance: sent the books, but not the Decision Journal
    auth.user = { id: "u2", role: "staff", staffRole: "finance" };
    let html = render();
    expect(html).toContain("2 of 3 done");
    expect(html).toContain("1 sale recorded.");

    bookings.appointments = [{ id: "a1", type: "viewing", status: "completed", requestedDate: "2026-01-01", requestedTime: "10:00", outcome: "showed" }];
    html = render();
    expect(html).toBe("");
  });
});
