import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Vehicle } from "@/types/Vehicle";
import type { Lead } from "@/dealer/leads/leadTypes";

// Renders the real screens to static HTML (no browser needed) against a fake
// stock, fake leads and a fake set of books, and reads what would be on the
// page. Two things are pinned here that the model tests can't see: the states
// a NEW dealer meets (no cars must never read "Loading" for ever), and that
// none of the invented figures these screens used to show has crept back.

const inventory = vi.hoisted(() => ({ vehicles: [] as unknown[], loading: false }));
const leadStore = vi.hoisted(() => ({ leads: [] as unknown[], loading: false }));
const books = vi.hoisted(() => ({ costs: [] as unknown[], purchases: [] as unknown[], sales: [] as unknown[] }));

vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ vehicles: inventory.vehicles, loading: inventory.loading }),
}));
vi.mock("@/context/LeadsContext", () => ({
  useLeads: () => ({ leads: leadStore.leads, loading: leadStore.loading }),
}));
vi.mock("@/bookkeeping/BookkeepingProvider", () => ({
  useBookkeeping: () => books,
}));

import DealerMotorsDashboard from "./DealerMotorsDashboard";
import DealerRiskHub from "./DealerRiskHub";
import DealerCRMIntelligence from "./DealerCRMIntelligence";
import PricingWorkflow from "@/dealer/workflow/PricingWorkflow";

const DAY = 86_400_000;
const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY).toISOString();

let nextId = 0;
function car(over: Partial<{ make: string; model: string; status: string; priceRetail: number | null; priceTrade: number | null; expiry: string; advisories: number; createdAt: string }> = {}): Vehicle {
  return {
    id: `car-${++nextId}`,
    make: over.make ?? "Ford",
    model: over.model ?? "Fiesta",
    status: over.status ?? "in stock",
    priceRetail: over.priceRetail === undefined ? null : over.priceRetail,
    priceTrade: over.priceTrade === undefined ? null : over.priceTrade,
    ...(over.createdAt === undefined ? {} : { createdAt: over.createdAt }),
    mot: { expiry: over.expiry ?? "", advisories: Array.from({ length: over.advisories ?? 0 }, (_, i) => `A${i}`) },
  } as unknown as Vehicle;
}

const render = (ui: React.ReactElement, at = "/") =>
  renderToStaticMarkup(<MemoryRouter initialEntries={[at]}>{ui}</MemoryRouter>);

beforeEach(() => {
  inventory.vehicles = [];
  inventory.loading = false;
  leadStore.leads = [];
  leadStore.loading = false;
  books.costs = [];
  books.purchases = [];
  books.sales = [];
});

// Words and figures the audit found invented on these screens.
const INVENTED = [
  "FlipScore",
  "Market Volatility",
  "Stock Stability",
  "Conversion Chance",
  "Engagement",
  "3×",
  "price suppression",
  "AI Insight",
  "AI‑powered",
  "AI-powered",
  "AI Valuation",
  "Market Heat",
  "Total Valuation",
];

function expectNoInvention(html: string) {
  for (const word of INVENTED) expect(html, word).not.toContain(word);
}

describe("Motors dashboard", () => {
  it("for a dealer with no cars says so, instead of loading for ever or showing zeros as results", () => {
    const html = render(<DealerMotorsDashboard />);
    expect(html).toContain("No vehicles in stock");
    expect(html).not.toContain("Loading");
    expectNoInvention(html);
  });

  it("says it is loading only while the very first fetch runs", () => {
    inventory.loading = true;
    expect(render(<DealerMotorsDashboard />)).toContain("Loading your stock");
    inventory.vehicles = [car({ priceRetail: 5000 })];
    expect(render(<DealerMotorsDashboard />)).not.toContain("Loading your stock");
  });

  it("shows counts from the stock: asking total, margin, MOTs to sort and the cars with no MOT date", () => {
    inventory.vehicles = [
      car({ make: "Vauxhall", model: "Corsa", priceRetail: 3295, priceTrade: 2100, expiry: iso(-10).slice(0, 10) }),
      car({ make: "BMW", model: "3 Series", priceRetail: 11495, priceTrade: 9200, expiry: iso(200).slice(0, 10) }),
      car({ make: "Audi", model: "A3", priceRetail: 14995, priceTrade: 12800 }), // no MOT date
      car({ make: "Skoda", model: "Fabia", status: "sold", priceRetail: 99999 }),
    ];
    const html = render(<DealerMotorsDashboard />);
    expect(html).toContain("Stock at asking price");
    expect(html).toContain("£29,785"); // 3295 + 11495 + 14995: the sold car's price is not in it
    expect(html).not.toContain("99,999");
    expect(html).toContain("Vauxhall Corsa");
    expect(html).toContain("expired 10 days ago");
    expect(html).toContain("1 car with no MOT date recorded");
    expect(html).toContain("Audi A3");
    expectNoInvention(html);
  });
});

describe("Risk hub", () => {
  it("for a dealer with no cars shows an honest empty state, NOT 'Loading' for ever", () => {
    const html = render(<DealerRiskHub />);
    expect(html).toContain("Nothing to check yet");
    expect(html).not.toContain("Loading");
  });

  it("says it is loading only during the first fetch", () => {
    inventory.loading = true;
    expect(render(<DealerRiskHub />)).toContain("Loading your stock");
  });

  it("shows numbers of cars, not percentages or scores", () => {
    inventory.vehicles = [
      car({ make: "Vauxhall", model: "Corsa", expiry: iso(-5).slice(0, 10), advisories: 4, createdAt: iso(-120) }),
      car({ make: "Kia", model: "Rio", expiry: iso(200).slice(0, 10) }),
      car({ make: "Audi", model: "A3" }), // no MOT date
    ];
    const html = render(<DealerRiskHub />);
    expect(html).toContain("MOT expired");
    expect(html).toContain("Due within 30 days");
    expect(html).toContain("No MOT date recorded");
    expect(html).toContain("3 or more MOT advisories");
    expect(html).toContain("In stock 90 days or more");
    expect(html).toContain("Vauxhall Corsa");
    expect(html).toContain("MOT expired 5 days ago");
    expect(html).not.toMatch(/\d\s*%/); // no percentage anywhere on the page
    expectNoInvention(html);
  });
});

describe("Lead summary", () => {
  const lead = (over: Partial<Lead> = {}): Lead => ({
    id: `lead-${++nextId}`,
    name: "A Buyer",
    source: "AutoTrader",
    status: "new",
    createdAt: iso(-3),
    ...over,
  });

  it("for a dealer with no leads says so and offers to add one", () => {
    const html = render(<DealerCRMIntelligence />);
    expect(html).toContain("No leads yet");
    expect(html).toContain("/dealer/sales/add");
    expect(html).not.toContain("Loading");
  });

  it("counts leads by stage, source and age, with no chances, percentages or 'AI' insight", () => {
    leadStore.leads = [
      lead({ name: "Ann", status: "won" }),
      lead({ name: "Bob", status: "negotiating", createdAt: iso(-45) }),
      lead({ name: "Cat", source: "Walk-in" }),
    ];
    const html = render(<DealerCRMIntelligence />);
    expect(html).toContain("Lead summary");
    expect(html).toContain("Leads by stage");
    expect(html).toContain("Lead sources");
    expect(html).toContain("2 leads, 1 won"); // AutoTrader: Ann won, Bob open
    expect(html).toContain("Waiting longest");
    expect(html).toContain("added 45 days ago");
    expect(html).not.toMatch(/\d\s*%/);
    expectNoInvention(html);
  });
});

describe("Pricing workflow", () => {
  const at = (id: string) =>
    render(
      <Routes>
        <Route path="/dealer/workflow/pricing/:id" element={<PricingWorkflow />} />
      </Routes>,
      `/dealer/workflow/pricing/${id}`
    );

  it("says a car is missing only when it really is not in stock", () => {
    const html = at("nope");
    expect(html).toContain("Vehicle not found");
  });

  it("shows a car that has no Bookkeeping purchase, and says what is missing, instead of 'Vehicle Not Found'", () => {
    const c = car({ priceRetail: 6000, priceTrade: 4000 });
    inventory.vehicles = [c];
    const html = at(c.id);
    expect(html).not.toContain("Vehicle not found");
    expect(html).toContain("Your asking price");
    expect(html).toContain("£6,000");
    expect(html).toContain("The trade price on the vehicle record");
    expect(html).toContain("£2,000"); // margin: 6000 - 4000
  });

  it("does the margin from the purchase and costs, and never shows a made-up valuation", () => {
    const c = car({ priceRetail: 6000 });
    inventory.vehicles = [c];
    books.purchases = [{ id: "p", vehicleId: c.id, purchasePrice: 4000 }];
    books.costs = [{ id: "c1", vehicleId: c.id, amount: 500 }];
    const html = at(c.id);
    expect(html).toContain("£1,500"); // 6000 - 4000 - 500
    expect(html).toContain("25% of the asking price");
    expect(html).not.toContain("5,400"); // 4000 x 1.35, the old "retail valuation"
    expect(html).not.toContain("4,600"); // 4000 x 1.15, the old "trade valuation"
    expectNoInvention(html);
    expect(html).toContain("not a valuation");
  });
});
