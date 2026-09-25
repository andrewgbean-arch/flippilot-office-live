import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// A cost entered by mistake could be offset by a negative cost, and that was the ONLY
// way to correct one: the car's cost list had no delete or edit. Once every amount had
// to be strictly positive with no minus sign, a mistaken cost could not be corrected at
// all. So: a labelled "credit or refund" option on Add Cost (entered as a positive
// amount, stored negative), and a Delete on the car's cost list (not for costs raised
// against stock: the Recon screen gives the parts back with them).
//
// Runs the REAL Add Cost form, the REAL provider (through the stand-in for React's
// hooks, against a fake server holding the ledger) and the REAL car ledger page.

const state = vi.hoisted(() => ({
  doc: { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [] } as Record<string, any[]>,
  provider: null as any,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const runtime = await import("@/lib/testing/hookRuntime");
  const base = (actual as unknown as { default?: object }).default ?? actual;
  const patched = {
    ...base,
    useState: runtime.useState,
    useEffect: runtime.useEffect,
    useRef: runtime.useRef,
    useCallback: runtime.useCallback,
    useMemo: runtime.useMemo,
  };
  return { ...patched, default: patched };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { dealershipId: "dealer-a", role: "owner" } }) }));
vi.mock("@/bookkeeping/BookkeepingProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/bookkeeping/BookkeepingProvider")>();
  return { ...actual, useBookkeeping: () => state.provider.result.props.value };
});
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ vehicles: [{ id: "v1", make: "Ford", model: "Focus", vatScheme: "margin" }] }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => {}, useParams: () => ({ vehicleId: "v1" }) }));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { BookkeepingProvider } from "@/bookkeeping/BookkeepingProvider";
import AddCostModal from "@/bookkeeping/AddCostModal";
import BookkeepingEntryScreen from "@/bookkeeping/BookkeepingEntryScreen";
import { byId, buttonByText, typeInto, alerts, screenText, findAll } from "@/lib/testing/elementTree";

const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0));
};
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let books: Mounted<{ children?: unknown }, any> | null = null;
let screen: Mounted<any, any> | null = null;
let closed: number;
let asked: string[];

beforeEach(() => {
  closed = 0;
  asked = [];
  vi.stubGlobal("fetch", async (_url: unknown, init?: { method?: string; body?: string }) => {
    if ((init?.method ?? "GET").toUpperCase() === "PUT") {
      const body = JSON.parse(init!.body!);
      state.doc = body;
      return reply(200, { ok: true, ...body });
    }
    return reply(200, { ok: true, ...state.doc });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  screen?.unmount();
  books?.unmount();
  screen = null;
  books = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openBooks(doc: Partial<Record<string, any[]>>) {
  state.doc = { costs: [], purchases: [], sales: [], transactions: [], suppliers: [], categories: [], ...doc };
  books = mount(BookkeepingProvider as (p: { children?: unknown }) => unknown, { children: null }) as Mounted<{ children?: unknown }, any>;
  state.provider = books;
  await settle();
}
const ctx = () => books!.result.props.value as any;

const cost = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  vehicleId: "v1",
  type: "parts",
  amount: 120,
  vatRate: 0,
  vatIncluded: false,
  vatReclaimable: false,
  vatAmount: 0,
  netAmount: 120,
  supplier: "Euro Car Parts",
  date: "2026-03-05",
  ...over,
});
const purchase = { id: "p1", vehicleId: "v1", purchasePrice: 4000, source: "Auction", date: "2026-03-01", vatScheme: "margin", vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 4000 };
const sale = { id: "s1", vehicleId: "v1", salePrice: 5000, invoiceNumber: "INV-0001", date: "2026-03-10", vatScheme: "margin", vatRate: 0.2, vatIncluded: false, vatAmount: 166.67, netAmount: 4833.33, marginPurchasePrice: 4000 };

async function openCostForm() {
  screen = mount(AddCostModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => void closed++ }) as Mounted<any, any>;
  await settle();
}
async function typeCost(id: string, value: string) {
  typeInto(byId(screen!.result, id), value);
  await settle();
}
async function tickCredit(on = true) {
  byId(screen!.result, "addcostmodal-credit")!.props.onChange({ target: { checked: on } });
  await settle();
}
async function saveCost() {
  buttonByText(screen!.result, "Save Cost")!.props.onClick();
  await settle();
}

describe("a credit or refund on Add Cost", () => {
  it("is off by default, so an ordinary cost is a positive amount", async () => {
    await openBooks({});
    await openCostForm();
    expect(byId(screen!.result, "addcostmodal-credit")!.props.checked).toBe(false);
    await typeCost("addcostmodal-amount", "120");
    await saveCost();
    expect(state.doc.costs![0].amount).toBe(120);
  });

  it("ticked, a positive amount is stored as a NEGATIVE cost, with its VAT and net negative too", async () => {
    await openBooks({});
    await openCostForm();
    await typeCost("addcostmodal-amount", "£120");
    await tickCredit();
    await saveCost();
    const stored = state.doc.costs![0];
    expect(stored.amount).toBe(-120);
    expect(stored.vatAmount).toBeCloseTo(-20, 10); // 20% VAT included in a 120 credit
    expect(stored.netAmount).toBeCloseTo(-100, 10);
    expect(closed).toBe(1);
  });

  it("takes money off the car's costs and puts it on its profit", async () => {
    // bought 4,000, sold 5,000, a 300 cost: profit 700. A 100 refund on that cost: 800.
    await openBooks({ purchases: [purchase], sales: [sale], costs: [cost({ amount: 300, netAmount: 300 })] });
    expect(ctx().getProfitForVehicle("v1").profit).toBe(700);
    await openCostForm();
    await typeCost("addcostmodal-amount", "100");
    await tickCredit();
    await saveCost();
    expect(ctx().getTotalCostForVehicle("v1")).toBe(200);
    expect(ctx().getProfitForVehicle("v1").profit).toBe(800);
  });

  it("a minus sign is still refused, and the message says how to enter a credit", async () => {
    await openBooks({});
    await openCostForm();
    await typeCost("addcostmodal-amount", "-50");
    expect(alerts(screen!.result)[0]).toContain("without a minus sign");
    expect(alerts(screen!.result)[0]).toContain("credit or refund");
    await saveCost();
    expect(state.doc.costs).toEqual([]);
    // ticking the box does not let a minus through either: no double negative
    await tickCredit();
    await saveCost();
    expect(state.doc.costs).toEqual([]);
  });

  it("a credit of nothing is refused like a cost of nothing", async () => {
    await openBooks({});
    await openCostForm();
    await tickCredit();
    await typeCost("addcostmodal-amount", "0");
    await saveCost();
    expect(state.doc.costs).toEqual([]);
    expect(alerts(screen!.result)[0]).toContain("greater than £0");
  });

  it("a blank credit is refused too", async () => {
    await openBooks({});
    await openCostForm();
    await tickCredit();
    await saveCost();
    expect(state.doc.costs).toEqual([]);
    expect(alerts(screen!.result)).toContain("Enter the cost amount.");
  });
});

describe("removing a cost entered by mistake", () => {
  const page = () => {
    screen = mount(BookkeepingEntryScreen as (p: object) => unknown, {}) as Mounted<any, any>;
    return screen;
  };
  const stubConfirm = (answer: boolean) =>
    vi.stubGlobal("window", {
      confirm: (message: string) => {
        asked.push(message);
        return answer;
      },
    });

  it("a plain cost has a Delete button", async () => {
    await openBooks({ purchases: [purchase], costs: [cost()] });
    expect(buttonByText(page().result, "Delete cost")).toBeDefined();
  });

  it("asks first, saying what it is, and removes it on a yes: the car's costs and profit follow", async () => {
    await openBooks({ purchases: [purchase], sales: [sale], costs: [cost({ id: "mistake", amount: 900, netAmount: 900 }), cost({ id: "real", amount: 100, netAmount: 100 })] });
    expect(ctx().getProfitForVehicle("v1").profit).toBe(0); // 5,000 - 4,000 - 1,000
    stubConfirm(true);
    buttonByText(page().result, "Delete cost")!.props.onClick();
    await settle();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("parts cost of £900.00");
    expect(state.doc.costs!.map((c) => c.id)).toEqual(["real"]);
    expect(ctx().getProfitForVehicle("v1").profit).toBe(900);
  });

  it("does nothing on a no", async () => {
    await openBooks({ purchases: [purchase], costs: [cost()] });
    stubConfirm(false);
    buttonByText(page().result, "Delete cost")!.props.onClick();
    await settle();
    expect(state.doc.costs).toHaveLength(1);
  });

  it("a cost raised against stock cannot be deleted here (its parts have to be given back on the Recon screen)", async () => {
    await openBooks({ purchases: [purchase], costs: [cost({ type: "recon", consumableId: "part-1", quantityUsed: 2 })] });
    const p = page();
    expect(buttonByText(p.result, "Delete cost")).toBeUndefined();
    expect(screenText(p.result)).toContain("Raised against stock: remove it from the Recon screen.");
  });

  it("each cost has its own button and removes only itself", async () => {
    await openBooks({ purchases: [purchase], costs: [cost({ id: "a" }), cost({ id: "b" })] });
    stubConfirm(true);
    const buttons = findAll(page().result, (el) => el.type === "button" && screenText(el) === "Delete cost");
    expect(buttons).toHaveLength(2);
    buttons[1]!.props.onClick();
    await settle();
    expect(state.doc.costs!.map((c) => c.id)).toEqual(["a"]);
  });
});
