import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL New Vehicle screen through the hook stand-in and drives it.
//
// The Buy Price becomes the car's purchase in the books, so it is REQUIRED and
// must be above £0 ("4,500" used to be lost and saved as empty, so a later
// £5,000 sale showed £5,000 profit at a 100% margin). The Sell Price is
// OPTIONAL: blank is stored as unset, never as £0. And a Margin Scheme purchase
// is saved with NO VAT (the screen defaulted to Margin AND 20% included, storing
// 1,000 of VAT on a 6,000 purchase that does not exist).

const spies = vi.hoisted(() => ({
  addManualVehicle: null as null | ((data: any) => any),
  addPurchase: null as null | ((entry: any) => void),
  navigate: null as null | ((to: string) => void),
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
vi.mock("react-router-dom", () => ({ useNavigate: () => (to: string) => spies.navigate!(to) }));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ addManualVehicle: (d: any) => spies.addManualVehicle!(d) }),
}));
vi.mock("@/bookkeeping/BookkeepingProvider", () => ({
  useBookkeeping: () => ({ addPurchase: (e: any) => spies.addPurchase!(e) }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { byId, byLabel, buttonByText, typeInto, alerts, screenText, findAll } from "@/lib/testing/elementTree";
import NewVehicle from "./NewVehicle";

let mounted: Mounted<any, any>;
let vehicles: any[];
let purchases: any[];
let navigated: string[];

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const screen = () => mounted.result;

async function open() {
  mounted = mount(NewVehicle as (p: any) => unknown, {}) as Mounted<any, any>;
  await settle();
}
async function typeLabel(label: string, value: string) {
  const el = byLabel(screen(), label);
  if (!el) throw new Error(`no field labelled ${label}`);
  el.props.onChange(value);
  await settle();
}
async function fillCar() {
  await typeLabel("Make", "Ford");
  await typeLabel("Model", "Fiesta");
}
const buy = (v: string) => typeLabel("Buy Price (£)", v);
const sell = (v: string) => typeLabel("Sell Price (£)", v);
async function save() {
  findAll(screen(), (el) => el.props.label === "Save Vehicle")[0]!.props.onClick();
  await settle();
}
const saveError = () => findAll(screen(), (el) => el.type === "p" && String(el.props.className).includes("text-red-400") && el.props.role !== "alert").map((el) => screenText(el))[0];

beforeEach(() => {
  vehicles = [];
  purchases = [];
  navigated = [];
  spies.addManualVehicle = (d) => {
    vehicles.push(d);
    return { id: "car-1" };
  };
  spies.addPurchase = (e) => void purchases.push(e);
  spies.navigate = (to) => void navigated.push(to);
});
afterEach(() => mounted?.unmount());

describe("the Buy Price is required and must be above £0", () => {
  it("a blank Buy Price saves nothing and says so, with the message it always had", async () => {
    await open();
    await fillCar();
    await save();
    expect(vehicles).toEqual([]);
    expect(purchases).toEqual([]);
    expect(navigated).toEqual([]);
    expect(saveError()).toBe("Enter a Buy Price before saving.");
    expect(alerts(screen())).toEqual(["Buy Price: Enter a Buy Price before saving."]);
  });

  it.each([
    ["abc", "Enter an amount in pounds"],
    ["0", "greater than £0"],
    ["-4500", "no minus sign"],
    ["4,5", "Commas can only separate thousands"],
    ["4.500,00", "European"],
    ["1e3", "Enter an amount in pounds"],
    ["Infinity", "Enter an amount in pounds"],
    ["4500.999", "2 decimal places"],
  ])("Buy Price %j is refused with its own message and nothing is saved", async (text, expected) => {
    await open();
    await fillCar();
    await buy(text);
    expect(alerts(screen())[0]).toContain(expected); // live
    await save();
    expect(vehicles).toEqual([]);
    expect(purchases).toEqual([]);
    expect(navigated).toEqual([]);
    expect(saveError()).toContain(expected);
  });

  it("the audit's case: '4,500' is read as 4500 (it used to be saved as empty), then a 5,000 sale is a 500 profit", async () => {
    await open();
    await fillCar();
    await buy("4,500");
    expect(alerts(screen())).toEqual([]);
    await save();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].buyPrice).toBe(4500);
    expect(purchases).toHaveLength(1);
    expect(purchases[0].purchasePrice).toBe(4500);
    expect(purchases[0].vehicleId).toBe("car-1");
    expect(navigated).toEqual(["/dealer/inventory/car-1"]);
  });

  it.each([
    ["4500", 4500],
    ["£4500", 4500],
    ["£4,500.50", 4500.5],
    ["  6,000 ", 6000],
  ])("Buy Price %j is saved as %d", async (text, expected) => {
    await open();
    await fillCar();
    await buy(text);
    await save();
    expect(vehicles[0].buyPrice).toBe(expected);
    expect(purchases[0].purchasePrice).toBe(expected);
  });

  it("still needs a make and model", async () => {
    await open();
    await buy("4500");
    await save();
    expect(vehicles).toEqual([]);
    expect(saveError()).toBe("Enter at least a Make and Model (or a Vehicle Title) before saving.");
  });
});

describe("the Sell Price is optional: blank is unset, never £0", () => {
  it("a blank Sell Price is stored as null", async () => {
    await open();
    await fillCar();
    await buy("4500");
    await save();
    expect(vehicles[0].sellPrice).toBeNull();
    expect(vehicles[0].sellPrice).not.toBe(0);
  });

  it("a typed 0 is unset too", async () => {
    await open();
    await fillCar();
    await buy("4500");
    await sell("0");
    await save();
    expect(vehicles[0].sellPrice).toBeNull();
  });

  it.each([
    ["7250", 7250],
    ["7,250", 7250],
    ["£7,250.50", 7250.5],
  ])("Sell Price %j is saved as %d", async (text, expected) => {
    await open();
    await fillCar();
    await buy("4500");
    await sell(text);
    await save();
    expect(vehicles[0].sellPrice).toBe(expected);
  });

  it.each([
    ["7,25", "Commas can only separate thousands"],
    ["abc", "Enter an amount in pounds"],
    ["-5", "no minus sign"],
    ["7.250,00", "European"],
  ])("a Sell Price of %j that cannot be read is refused, not dropped to blank", async (text, expected) => {
    await open();
    await fillCar();
    await buy("4500");
    await sell(text);
    expect(alerts(screen())[0]).toContain(`Sell Price: `);
    expect(alerts(screen())[0]).toContain(expected);
    await save();
    expect(vehicles).toEqual([]);
    expect(purchases).toEqual([]);
    expect(saveError()).toContain(`Sell Price: `);
  });
});

describe("Live Profit needs both prices, and is never a made-up £0", () => {
  it("says to enter both while either is blank or unreadable", async () => {
    await open();
    expect(screenText(screen())).toContain("Enter buy & sell to see profit");
    await buy("4500");
    expect(screenText(screen())).toContain("Enter buy & sell to see profit");
    await sell("abc");
    expect(screenText(screen())).toContain("Enter buy & sell to see profit");
    expect(screenText(screen())).not.toContain("£0 profit");
  });

  it("shows the profit once both read: 7,250 less 4,500 is 2,750", async () => {
    await open();
    await buy("4,500");
    await sell("£7,250");
    expect(screenText(screen())).toContain("£2,750 profit");
  });

  it("shows a loss as negative", async () => {
    await open();
    await buy("5000");
    await sell("4000");
    expect(screenText(screen())).toContain("-£1,000 profit");
  });
});

describe("a Margin Scheme purchase is saved with NO VAT", () => {
  it("the shipped defaults (Margin, 20%, included) on a 6,000 purchase store 0 VAT and net 6,000", async () => {
    await open();
    await fillCar();
    await buy("6000");
    await save();
    expect(purchases[0]).toMatchObject({
      purchasePrice: 6000,
      vatScheme: "margin",
      vatRate: 0,
      vatIncluded: false,
      vatAmount: 0,
      netAmount: 6000,
    });
    expect(vehicles[0].vatScheme).toBe("margin");
  });

  it("does not show the VAT rate or VAT included controls for margin, and says why", async () => {
    await open();
    expect(byId(screen(), "newvehicle-vat-rate-on-this-purchase")).toBeUndefined();
    expect(buttonByText(screen(), "Yes")).toBeUndefined();
    expect(screenText(screen())).toContain("Margin Scheme purchases carry no VAT");
  });

  it("Standard VAT shows the controls again and keeps a real VAT invoice's VAT: 6,000 incl 20% is 1,000 VAT, net 5,000", async () => {
    await open();
    await fillCar();
    await buy("6000");
    typeInto(byId(screen(), "newvehicle-vat-scheme-for-when-this-vehicle-is-sold"), "standard");
    await settle();
    expect(byId(screen(), "newvehicle-vat-rate-on-this-purchase")).toBeDefined();
    expect(buttonByText(screen(), "Yes")).toBeDefined();
    expect(screenText(screen())).not.toContain("Margin Scheme purchases carry no VAT");
    await save();
    expect(purchases[0]).toMatchObject({ vatScheme: "standard", vatRate: 0.2, vatIncluded: true, netAmount: 5000 });
    expect(purchases[0].vatAmount).toBeCloseTo(1000, 10);
    expect(vehicles[0].vatScheme).toBe("standard");
  });

  it("Standard VAT at 5% with the price entered net (toggle VAT included off)", async () => {
    await open();
    await fillCar();
    await buy("1000");
    typeInto(byId(screen(), "newvehicle-vat-scheme-for-when-this-vehicle-is-sold"), "standard");
    await settle();
    typeInto(byId(screen(), "newvehicle-vat-rate-on-this-purchase"), "5");
    await settle();
    buttonByText(screen(), "Yes")!.props.onClick();
    await settle();
    await save();
    expect(purchases[0]).toMatchObject({ vatScheme: "standard", vatRate: 0.05, vatIncluded: false, netAmount: 1000 });
    expect(purchases[0].vatAmount).toBeCloseTo(50, 10);
  });

  it("a 20% rate chosen under Standard and then Margin picked again is still saved as 0", async () => {
    await open();
    await fillCar();
    await buy("6000");
    typeInto(byId(screen(), "newvehicle-vat-scheme-for-when-this-vehicle-is-sold"), "standard");
    await settle();
    typeInto(byId(screen(), "newvehicle-vat-scheme-for-when-this-vehicle-is-sold"), "margin");
    await settle();
    await save();
    expect(purchases[0]).toMatchObject({ vatScheme: "margin", vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 6000 });
  });
});
