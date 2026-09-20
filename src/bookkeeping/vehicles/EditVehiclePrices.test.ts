import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Edit Vehicle screen through the hook stand-in and drives the two
// price fields. Both are OPTIONAL stock fields: blank (or 0) is stored as unset
// (null), never £0; "£6,500" and "6,500" are read; and something typed that
// cannot be read ("6,5", "abc") is refused instead of being quietly dropped.

const state = vi.hoisted(() => ({
  updates: [] as { id: string; patch: any }[],
  navigated: [] as string[],
  car: null as any,
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
vi.mock("react-router-dom", () => ({ useNavigate: () => (to: string) => void state.navigated.push(to) }));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({
    vehicles: [state.car],
    updateVehicle: (id: string, patch: any) => void state.updates.push({ id, patch }),
    deleteVehicle: () => {},
  }),
}));
vi.mock("@/bookkeeping/BookkeepingProvider", () => ({
  useBookkeeping: () => ({ sales: [], purchases: [], costs: [] }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { byLabel, alerts, screenText, findAll } from "@/lib/testing/elementTree";
import EditVehicle from "./EditVehicle";

let mounted: Mounted<any, any>;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const screen = () => mounted.result;

const car = (over: Record<string, unknown> = {}) => ({
  id: "v1",
  make: "Ford",
  model: "Fiesta",
  year: 2018,
  mileage: 40000,
  priceTrade: 6000,
  priceRetail: 8000,
  vatScheme: "margin",
  notes: null,
  images: null,
  mot: { reg: "AB12CDE", colour: "Blue" },
  ...over,
});

async function open() {
  mounted = mount(EditVehicle as (p: any) => unknown, { vehicleId: "v1" }) as Mounted<any, any>;
  await settle();
}
async function typeLabel(label: string, value: string) {
  byLabel(screen(), label)!.props.onChange(value);
  await settle();
}
const trade = (v: string) => typeLabel("Trade Price (£)", v);
const retail = (v: string) => typeLabel("Retail Price (£)", v);
async function save() {
  findAll(screen(), (el) => el.props.label === "Save Vehicle")[0]!.props.onClick();
  await settle();
}
const savedPatch = () => state.updates[0]?.patch;
const shownError = () =>
  findAll(screen(), (el) => el.type === "p" && el.props.role !== "alert" && String(el.props.className).includes("text-red-400")).map((el) => screenText(el))[0];

beforeEach(() => {
  state.updates = [];
  state.navigated = [];
  state.car = car();
});
afterEach(() => mounted?.unmount());

describe("saving the prices", () => {
  it("saves the prices as they are when nothing was changed", async () => {
    await open();
    await save();
    expect(savedPatch()).toMatchObject({ priceTrade: 6000, priceRetail: 8000 });
    expect(state.navigated).toEqual(["/dealer/inventory/v1"]);
  });

  it.each([
    ["6500", 6500],
    ["6,500", 6500],
    ["£6,500", 6500],
    ["£6,500.50", 6500.5],
    ["  7,250 ", 7250],
  ])("a Trade Price of %j is saved as %d", async (text, expected) => {
    await open();
    await trade(text);
    await save();
    expect(savedPatch().priceTrade).toBe(expected);
  });

  it("blank prices are stored as unset (null), never 0", async () => {
    await open();
    await trade("");
    await retail("   ");
    await save();
    expect(savedPatch().priceTrade).toBeNull();
    expect(savedPatch().priceRetail).toBeNull();
    expect(savedPatch().priceTrade).not.toBe(0);
    expect(savedPatch().priceRetail).not.toBe(0);
  });

  it("a typed 0 is unset too", async () => {
    await open();
    await trade("0");
    await retail("0.00");
    await save();
    expect(savedPatch().priceTrade).toBeNull();
    expect(savedPatch().priceRetail).toBeNull();
  });

  it("a car saved earlier with prices of 0 is cleaned to unset when it is next saved", async () => {
    state.car = car({ priceTrade: 0, priceRetail: 0 });
    await open();
    await save();
    expect(savedPatch().priceTrade).toBeNull();
    expect(savedPatch().priceRetail).toBeNull();
  });

  it("a car with no prices at all opens blank and saves null", async () => {
    state.car = car({ priceTrade: null, priceRetail: null });
    await open();
    expect(byLabel(screen(), "Trade Price (£)")!.props.value).toBe("");
    await save();
    expect(savedPatch()).toMatchObject({ priceTrade: null, priceRetail: null });
  });
});

describe("a price that cannot be read is refused, not dropped", () => {
  it.each([
    ["6,5", "Commas can only separate thousands"],
    ["abc", "Enter an amount in pounds"],
    ["-100", "no minus sign"],
    ["6.500,00", "European"],
    ["1e3", "Enter an amount in pounds"],
    ["Infinity", "Enter an amount in pounds"],
    ["6500.999", "2 decimal places"],
  ])("Trade Price %j shows its message live and saves nothing", async (text, expected) => {
    await open();
    await trade(text);
    expect(alerts(screen())[0]).toContain("Trade Price: ");
    expect(alerts(screen())[0]).toContain(expected);
    await save();
    expect(state.updates).toEqual([]);
    expect(state.navigated).toEqual([]);
    expect(shownError()).toContain("Trade Price: ");
  });

  it("the Retail Price is checked the same way", async () => {
    await open();
    await retail("8,0");
    expect(alerts(screen())[0]).toContain("Retail Price: ");
    await save();
    expect(state.updates).toEqual([]);
    expect(shownError()).toContain("Retail Price: ");
  });

  it("nothing is refused for good or blank prices", async () => {
    await open();
    await trade("£6,000");
    await retail("");
    expect(alerts(screen())).toEqual([]);
  });
});

describe("Live Profit is never a made-up £0", () => {
  it("shows the profit when both prices read: 8,000 less 6,000 is 2,000", async () => {
    await open();
    expect(screenText(screen())).toContain("£2,000 profit");
    await trade("£6,500");
    await retail("7,250");
    expect(screenText(screen())).toContain("£750 profit");
  });

  it("says to enter both when either is blank, 0 or unreadable, never '£0 profit'", async () => {
    await open();
    await trade("");
    expect(screenText(screen())).toContain("Enter buy & sell to see profit");
    await trade("6000");
    await retail("0");
    expect(screenText(screen())).toContain("Enter buy & sell to see profit");
    await retail("8,0");
    expect(screenText(screen())).toContain("Enter buy & sell to see profit");
    expect(screenText(screen())).not.toContain("£0 profit");
  });
});
