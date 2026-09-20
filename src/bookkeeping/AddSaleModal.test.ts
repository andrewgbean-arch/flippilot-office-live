import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Record Sale form through the hook stand-in and drives it.
//
// The sale price is REQUIRED and must be above £0. A blank price used to be saved
// as a £0 sale AND marked the car SOLD at £0 (the ledger then printed
// "-Infinity%"), and "£5,000" was read as nothing. Now nothing is saved, and no
// car is marked sold, until the price reads as a real amount.

const spies = vi.hoisted(() => ({
  addSale: null as null | ((entry: any) => void),
  updateSale: null as null | ((id: string, patch: any) => void),
  updateVehicleSale: null as null | ((id: string, price: number) => void),
  vehicle: { id: "v1", make: "Ford", model: "Focus", vatScheme: "standard" } as any,
  purchase: undefined as any,
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
  useBookkeeping: () => ({
    sales: [],
    addSale: (e: any) => spies.addSale!(e),
    updateSale: (id: string, p: any) => spies.updateSale!(id, p),
    getPurchaseForVehicle: () => spies.purchase,
  }),
}));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({
    vehicles: [spies.vehicle],
    updateVehicleSale: (id: string, p: number) => spies.updateVehicleSale!(id, p),
  }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { byId, buttonByText, typeInto, alerts, screenText } from "@/lib/testing/elementTree";
import AddSaleModal from "./AddSaleModal";

let mounted: Mounted<any, any>;
let added: any[];
let updated: { id: string; patch: any }[];
let markedSold: { id: string; price: number }[];
let closed: number;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const screen = () => mounted.result;

async function open(props: Record<string, unknown> = {}) {
  mounted = mount(AddSaleModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => void closed++, ...props }) as Mounted<any, any>;
  await settle();
}
async function type(id: string, value: string) {
  typeInto(byId(screen(), id), value);
  await settle();
}
const price = (v: string) => type("addsalemodal-sale-price", v);
async function save(label = "Save Sale") {
  buttonByText(screen(), label)!.props.onClick();
  await settle();
}

beforeEach(() => {
  added = [];
  updated = [];
  markedSold = [];
  closed = 0;
  spies.vehicle = { id: "v1", make: "Ford", model: "Focus", vatScheme: "standard" };
  spies.purchase = undefined;
  spies.addSale = (e) => void added.push(e);
  spies.updateSale = (id, patch) => void updated.push({ id, patch });
  spies.updateVehicleSale = (id, p) => void markedSold.push({ id, price: p });
});
afterEach(() => mounted?.unmount());

describe("the sale price is required and must be above £0", () => {
  it("a blank price saves no sale and does NOT mark the car sold", async () => {
    await open();
    expect(alerts(screen())).toEqual([]);
    await save();
    expect(added).toEqual([]);
    expect(markedSold).toEqual([]); // the car is not sold at £0
    expect(closed).toBe(0);
    expect(alerts(screen())).toEqual(["Enter the sale price."]);
  });

  it.each([
    ["abc", "Enter an amount in pounds"],
    ["0", "greater than £0"],
    ["0.00", "greater than £0"],
    ["-100", "no minus sign"],
    ["£", "Enter an amount in pounds"],
    ["1,2", "Commas can only separate thousands"],
    ["6.500,00", "European"],
    ["1e4", "Enter an amount in pounds"],
    ["Infinity", "Enter an amount in pounds"],
  ])("price %j is refused with its own message and nothing is saved or marked sold", async (text, expected) => {
    await open();
    await price(text);
    expect(alerts(screen())[0]).toContain(expected);
    await save();
    expect(added).toEqual([]);
    expect(markedSold).toEqual([]);
    expect(closed).toBe(0);
  });

  it.each([
    ["6500", 6500],
    ["6,500", 6500],
    ["£6,500", 6500],
    ["£6,500.50", 6500.5],
  ])("price %j is saved as %d, and the car is marked sold at that price", async (text, expected) => {
    await open();
    await price(text);
    expect(alerts(screen())).toEqual([]);
    await save();
    expect(added).toHaveLength(1);
    expect(added[0].salePrice).toBe(expected);
    expect(markedSold).toEqual([{ id: "v1", price: expected }]);
    expect(closed).toBe(1);
  });

  it("needs a vehicle: with none chosen it saves nothing", async () => {
    vi.stubGlobal("alert", () => {});
    try {
      await open({ vehicleId: null });
      await price("6500");
      await save();
      expect(added).toEqual([]);
      expect(markedSold).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("editing a sale: clearing the price saves nothing", async () => {
    const existing = {
      id: "s1",
      vehicleId: "v1",
      salePrice: 6000,
      invoiceNumber: "INV-0001",
      date: "2026-03-10",
      vatScheme: "standard",
      vatRate: 0.2,
      vatIncluded: true,
      vatAmount: 1000,
      netAmount: 5000,
    };
    await open({ existing });
    expect((byId(screen(), "addsalemodal-sale-price")!.props.value as string)).toBe("6000");
    await price("");
    await save("Update Sale");
    expect(updated).toEqual([]);
    expect(alerts(screen())).toEqual(["Enter the sale price."]);
    // and a real edit goes through
    await price("£6,250");
    await save("Update Sale");
    expect(updated).toHaveLength(1);
    expect(updated[0]!.patch.salePrice).toBe(6250);
  });

  it("a sale saved earlier at £0 must be corrected before it can be saved again", async () => {
    await open({
      existing: {
        id: "s1",
        vehicleId: "v1",
        salePrice: 0,
        invoiceNumber: "INV-0001",
        date: "2026-03-10",
        vatScheme: "standard",
        vatRate: 0.2,
        vatIncluded: true,
        vatAmount: 0,
        netAmount: 0,
      },
    });
    await save("Update Sale");
    expect(updated).toEqual([]);
    expect(alerts(screen())[0]).toContain("greater than £0");
  });
});

describe("what is saved for the price entered", () => {
  it("standard VAT included is stored as typed with the flag on", async () => {
    await open();
    await price("1200");
    await save();
    expect(added[0]).toMatchObject({ salePrice: 1200, vatScheme: "standard", vatRate: 0.2, vatIncluded: true });
    expect(added[0].vatAmount).toBeCloseTo(200, 10);
    expect(added[0].netAmount).toBeCloseTo(1000, 10);
  });

  it("standard VAT added on top is stored with the net price and the flag off", async () => {
    await open();
    await price("1000");
    await type("addsalemodal-vat-included", "no");
    await save();
    expect(added[0]).toMatchObject({ salePrice: 1000, vatScheme: "standard", vatIncluded: false });
    expect(added[0].vatAmount).toBeCloseTo(200, 10);
    expect(added[0].netAmount).toBe(1000);
  });

  it("carries the buyer's details, trimmed, and a real invoice number", async () => {
    await open();
    await price("1200");
    await type("addsalemodal-buyer-name", "  Sam Buyer ");
    await save();
    expect(added[0].buyer).toBe("Sam Buyer");
    expect(added[0].invoiceNumber).toBe("INV-0001");
  });
});

describe("the margin-scheme preview does not show a made-up £0", () => {
  it("shows dashes while the price is blank or unreadable, and the real margin once it is typed", async () => {
    spies.vehicle = { id: "v1", make: "Ford", model: "Focus", vatScheme: "margin" };
    spies.purchase = { id: "p1", vehicleId: "v1", purchasePrice: 5000 };
    await open();
    expect(screenText(screen())).toContain("Purchase Price £5,000.00 Margin — VAT Due (Margin Scheme) —");
    await price("abc");
    expect(screenText(screen())).toContain("Margin — VAT Due (Margin Scheme) —");
    await price("6,000");
    // margin 1,000; VAT = 1,000 x 20/120 = 166.67
    expect(screenText(screen())).toContain("Margin £1,000.00 VAT Due (Margin Scheme) £166.67");
  });

  it("saves a margin sale with the margin VAT and the purchase price it was worked from", async () => {
    spies.vehicle = { id: "v1", make: "Ford", model: "Focus", vatScheme: "margin" };
    spies.purchase = { id: "p1", vehicleId: "v1", purchasePrice: 5000 };
    await open();
    await price("£6,000");
    await save();
    expect(added[0]).toMatchObject({ salePrice: 6000, vatScheme: "margin", marginPurchasePrice: 5000 });
    expect(added[0].vatAmount).toBeCloseTo(166.6667, 3);
  });
});
