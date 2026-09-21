import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Add Purchase form through the hook stand-in (lib/testing/
// hookRuntime.ts) and drives it like a person: type, choose, press Save.
//
// Two things are pinned. (1) The purchase price is REQUIRED and must be above
// £0: a blank used to be saved as £0 and "4,500" used to be lost, which made a
// later sale look like pure profit. (2) A Margin Scheme purchase has no VAT
// invoice, so it is saved with NO VAT (rate 0, not "included", VAT 0): the form
// defaulted to Margin AND to 20% included, storing 1,000 of VAT that never
// existed on a 6,000 purchase.

const spies = vi.hoisted(() => ({
  addPurchase: null as null | ((entry: any) => void),
  addManualVehicle: null as null | ((data: any) => any),
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
vi.mock("@/bookkeeping/BookkeepingProvider", () => ({
  useBookkeeping: () => ({ addPurchase: (e: any) => spies.addPurchase!(e) }),
}));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ addManualVehicle: (d: any) => spies.addManualVehicle!(d) }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { byId, buttonByText, typeInto, alerts, screenText, findAll } from "@/lib/testing/elementTree";
import AddPurchaseModal from "./AddPurchaseModal";

let mounted: Mounted<any, any>;
let purchases: any[];
let vehicles: any[];
let closed: number;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const screen = () => mounted.result;

async function open() {
  mounted = mount(AddPurchaseModal as (p: any) => unknown, { vehicleId: null, onClose: () => void closed++ }) as Mounted<any, any>;
  await settle();
}
async function type(id: string, value: string) {
  typeInto(byId(screen(), id), value);
  await settle();
}
async function fillCar() {
  await type("addpurchasemodal-make", "Ford");
  await type("addpurchasemodal-model", "Fiesta");
}
const price = (v: string) => type("addpurchasemodal-purchase-price", v);
const scheme = (v: "margin" | "standard") => type("addpurchasemodal-vat-scheme-for-when-this-vehicle-is-sold", v);
async function save() {
  buttonByText(screen(), "Save Purchase")!.props.onClick();
  await settle();
}

beforeEach(() => {
  purchases = [];
  vehicles = [];
  closed = 0;
  spies.addPurchase = (e) => void purchases.push(e);
  spies.addManualVehicle = (d) => {
    vehicles.push(d);
    return { id: "new-car" };
  };
});
afterEach(() => mounted?.unmount());

describe("the purchase price is required and must be above £0", () => {
  it("a blank price saves nothing, creates no car, and says what to enter", async () => {
    await open();
    await fillCar();
    expect(alerts(screen())).toEqual([]); // no scolding before they have tried
    await save();
    expect(purchases).toEqual([]);
    expect(vehicles).toEqual([]);
    expect(closed).toBe(0);
    expect(alerts(screen())).toEqual(["Enter the purchase price."]);
  });

  it.each([
    ["abc", "Enter an amount in pounds"],
    ["0", "greater than £0"],
    ["0.00", "greater than £0"],
    ["-500", "no minus sign"],
    ["4,5", "Commas can only separate thousands"],
    ["1,23,456", "Commas can only separate thousands"],
    ["4.500,00", "European"],
    ["1e3", "Enter an amount in pounds"],
    ["Infinity", "Enter an amount in pounds"],
    ["4500.999", "2 decimal places"],
  ])("price %j is refused with its own message, live, and saves nothing", async (text, expected) => {
    await open();
    await fillCar();
    await price(text);
    expect(alerts(screen())[0]).toContain(expected); // shown as they type
    await save();
    expect(purchases).toEqual([]);
    expect(vehicles).toEqual([]);
    expect(closed).toBe(0);
  });

  it.each([
    ["4500", 4500],
    ["4,500", 4500],
    ["£4,500", 4500],
    ["£4,500.50", 4500.5],
    ["  6000  ", 6000],
  ])("price %j is saved as %d", async (text, expected) => {
    await open();
    await fillCar();
    await price(text);
    expect(alerts(screen())).toEqual([]);
    await save();
    expect(purchases).toHaveLength(1);
    expect(purchases[0].purchasePrice).toBe(expected);
    expect(vehicles[0].buyPrice).toBe(expected);
    expect(vehicles[0].sellPrice).toBeUndefined(); // the form does not invent one
    expect(closed).toBe(1);
  });

  it("still needs a make and a model, and does nothing without them", async () => {
    await open();
    await price("4500");
    await save();
    expect(purchases).toEqual([]);
    expect(vehicles).toEqual([]);
  });

  it("links the purchase to the car it just created", async () => {
    await open();
    await fillCar();
    await price("4500");
    await save();
    expect(purchases[0].vehicleId).toBe("new-car");
  });
});

describe("a Margin Scheme purchase is saved with NO VAT", () => {
  it("the shipped defaults (Margin, 20%, included) on a 6,000 purchase store 0 VAT and net 6,000", async () => {
    await open();
    await fillCar();
    await price("6000");
    await save();
    expect(purchases).toHaveLength(1);
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

  it("a 20% rate typed in before choosing Margin is still stored as 0", async () => {
    await open();
    await fillCar();
    await price("6000");
    await scheme("standard");
    await type("addpurchasemodal-vat-rate-on-this-purchase", "20");
    await type("addpurchasemodal-vat-included", "yes");
    await scheme("margin");
    await save();
    expect(purchases[0]).toMatchObject({ vatScheme: "margin", vatRate: 0, vatIncluded: false, vatAmount: 0, netAmount: 6000 });
  });

  it("the margin form does not show the VAT rate or VAT included boxes, and says why", async () => {
    await open();
    expect(byId(screen(), "addpurchasemodal-vat-rate-on-this-purchase")).toBeUndefined();
    expect(byId(screen(), "addpurchasemodal-vat-included")).toBeUndefined();
    expect(screenText(screen())).toContain("Margin Scheme purchases carry no VAT");
    expect(findAll(screen(), (el) => el.props.role === "note")).toHaveLength(1);
  });

  it("Standard VAT shows the boxes again, and a real VAT invoice keeps its VAT: 6,000 incl 20% is 1,000 VAT, net 5,000", async () => {
    await open();
    await fillCar();
    await price("6000");
    await scheme("standard");
    expect(byId(screen(), "addpurchasemodal-vat-rate-on-this-purchase")).toBeDefined();
    expect(byId(screen(), "addpurchasemodal-vat-included")).toBeDefined();
    expect(screenText(screen())).not.toContain("Margin Scheme purchases carry no VAT");
    await save();
    expect(purchases[0]).toMatchObject({
      vatScheme: "standard",
      vatRate: 0.2,
      vatIncluded: true,
      netAmount: 5000,
    });
    expect(purchases[0].vatAmount).toBeCloseTo(1000, 10);
    expect(vehicles[0].vatScheme).toBe("standard");
  });

  it("Standard VAT with the price entered net (VAT on top): 5,000 + 20% is 1,000 VAT, net 5,000", async () => {
    await open();
    await fillCar();
    await price("5000");
    await scheme("standard");
    await type("addpurchasemodal-vat-included", "no");
    await save();
    expect(purchases[0]).toMatchObject({ vatScheme: "standard", vatRate: 0.2, vatIncluded: false, netAmount: 5000 });
    expect(purchases[0].vatAmount).toBeCloseTo(1000, 10);
  });

  it("Standard VAT at 5%: 1,050 included is 50 VAT, net 1,000", async () => {
    await open();
    await fillCar();
    await price("1050");
    await scheme("standard");
    await type("addpurchasemodal-vat-rate-on-this-purchase", "5");
    await save();
    expect(purchases[0]).toMatchObject({ vatRate: 0.05, vatIncluded: true });
    expect(purchases[0].vatAmount).toBeCloseTo(50, 10);
    expect(purchases[0].netAmount).toBeCloseTo(1000, 10);
  });
});
