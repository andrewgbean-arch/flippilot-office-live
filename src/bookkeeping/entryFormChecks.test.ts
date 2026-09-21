import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Two things about the money entry forms (Record Sale, Add Cost, Add Purchase), run
// through the REAL forms with the hook stand-in (lib/testing/hookRuntime.ts).
//
// 1. The VAT rate box. It was read with (Number(text) || 0) / 100: a blank or
//    unreadable rate silently became 0% VAT, a negative or absurd rate was stored, and
//    "0.2" (a dealer thinking in fractions) was saved as 0.2%. A sale saved with a blank
//    rate printed "VAT (0%) £0.00" with a Total Due equal to the price.
//
// 2. What happens when Save is refused. The message under a field can be screens above
//    the Save button in a scrolling modal, so on a phone pressing Save with a bad price
//    looked as if nothing had happened. There is now a line beside the button, and the
//    first field to fix is scrolled to and focused. Add Purchase also used to return with
//    nothing said when the make or model was blank.

const spies = vi.hoisted(() => ({
  addSale: null as null | ((entry: any) => void),
  updateSale: null as null | ((id: string, patch: any) => void),
  addCost: null as null | ((entry: any) => void),
  addPurchase: null as null | ((entry: any) => void),
  addManualVehicle: null as null | ((data: any) => any),
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
    addCost: (e: any) => spies.addCost!(e),
    addPurchase: (e: any) => spies.addPurchase!(e),
    getPurchaseForVehicle: () => spies.purchase,
  }),
}));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({
    vehicles: [spies.vehicle],
    updateVehicleSale: () => {},
    addManualVehicle: (d: any) => spies.addManualVehicle!(d),
  }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { byId, buttonByText, typeInto, alerts, screenText, findAll } from "@/lib/testing/elementTree";
import AddSaleModal from "./AddSaleModal";
import AddCostModal from "./AddCostModal";
import AddPurchaseModal from "./AddPurchaseModal";

let mounted: Mounted<any, any>;
let sales: any[];
let updates: { id: string; patch: any }[];
let costs: any[];
let purchases: any[];
let closed: number;
let focused: string[];

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const screen = () => mounted.result;
async function type(id: string, value: string) {
  typeInto(byId(screen(), id), value);
  await settle();
}
async function press(label: string) {
  buttonByText(screen(), label)!.props.onClick();
  await settle();
}
const saveError = (id: string) => {
  const el = byId(screen(), id);
  return el ? screenText(el) : null;
};

beforeEach(() => {
  sales = [];
  updates = [];
  costs = [];
  purchases = [];
  closed = 0;
  focused = [];
  spies.vehicle = { id: "v1", make: "Ford", model: "Focus", vatScheme: "standard" };
  spies.purchase = undefined;
  spies.addSale = (e) => void sales.push(e);
  spies.updateSale = (id, patch) => void updates.push({ id, patch });
  spies.addCost = (e) => void costs.push(e);
  spies.addPurchase = (e) => void purchases.push(e);
  spies.addManualVehicle = () => ({ id: "new-car" });
  // The DOM is not there in these tests: a stand-in that records what was focused.
  vi.stubGlobal("document", {
    getElementById: (id: string) => ({
      scrollIntoView: () => {},
      focus: () => void focused.push(id),
    }),
  });
});
afterEach(() => {
  mounted?.unmount();
  vi.unstubAllGlobals();
});

// The reviewer's own cases, and the ones around them.
const BAD_RATES: [string, string][] = [
  ["", "Enter the VAT rate as a percentage, like 20."],
  ["   ", "Enter the VAT rate as a percentage, like 20."],
  ["abc", "Enter the VAT rate as a percentage"],
  ["1e2", "Enter the VAT rate as a percentage"],
  ["20 20", "Enter the VAT rate as a percentage"],
  ["-20", "can't be negative"],
  ["200", "can't be more than 100%"],
  ["100.01", "can't be more than 100%"],
  ["17.555", "at most 2 decimal places"],
  ["0.2", "reads as under 1%"],
  ["0.5", "reads as under 1%"],
];
const GOOD_RATES: [string, number][] = [
  ["20", 0.2],
  ["5", 0.05],
  ["0", 0], // a real rate, but it has to be typed: a blank is never 0
  ["17.5", 0.175],
  ["20%", 0.2],
  [" 20 ", 0.2],
  ["100", 1],
  ["1", 0.01],
];

/* ------------------------------------------------------------------ Record Sale */

describe("Record Sale: the VAT rate", () => {
  async function open(props: Record<string, unknown> = {}) {
    mounted = mount(AddSaleModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => void closed++, ...props }) as Mounted<any, any>;
    await settle();
  }
  const NO_VAT_ON_TOP = async () => {
    await type("addsalemodal-sale-price", "1000");
    await type("addsalemodal-vat-included", "no");
  };

  it("the audit's case: 1,000 with VAT added on top and the rate box CLEARED is refused, not saved as 0%", async () => {
    await open();
    await NO_VAT_ON_TOP();
    await type("addsalemodal-vat-rate", "");
    await press("Save Sale");
    expect(sales).toEqual([]);
    expect(closed).toBe(0);
    expect(alerts(screen())).toContain("Enter the VAT rate as a percentage, like 20.");
  });

  it.each(BAD_RATES)("rate %j is refused with its own message, live, and nothing is saved", async (text, expected) => {
    await open();
    await type("addsalemodal-sale-price", "1000");
    await type("addsalemodal-vat-rate", text);
    expect(alerts(screen()).join(" ")).toContain(expected);
    await press("Save Sale");
    expect(sales).toEqual([]);
    expect(closed).toBe(0);
  });

  it.each(GOOD_RATES)("rate %j is saved as %d, worked out on the price", async (text, expected) => {
    await open();
    await NO_VAT_ON_TOP();
    await type("addsalemodal-vat-rate", text);
    expect(alerts(screen())).toEqual([]);
    await press("Save Sale");
    expect(sales).toHaveLength(1);
    expect(sales[0].vatRate).toBe(expected);
    expect(sales[0].vatAmount).toBeCloseTo(1000 * expected, 8); // VAT on top of a net 1,000
    expect(closed).toBe(1);
  });

  it("the default 20 still saves the ordinary way", async () => {
    await open();
    await type("addsalemodal-sale-price", "1200");
    await press("Save Sale");
    expect(sales[0]).toMatchObject({ vatRate: 0.2, vatIncluded: true });
    expect(sales[0].vatAmount).toBeCloseTo(200, 10);
  });

  it("a Margin Scheme sale needs a real rate too (its VAT is worked from it)", async () => {
    spies.vehicle = { id: "v1", make: "Ford", model: "Focus", vatScheme: "margin" };
    spies.purchase = { id: "p1", vehicleId: "v1", purchasePrice: 5000 };
    await open();
    await type("addsalemodal-sale-price", "6000");
    await type("addsalemodal-vat-rate", "");
    // the preview shows dashes, not a VAT of 0
    expect(screenText(screen())).toContain("VAT Due (Margin Scheme) —");
    await press("Save Sale");
    expect(sales).toEqual([]);
  });

  it("the rate error is shown at once when the box starts empty or wrong, and goes when it is fixed", async () => {
    await open();
    expect(alerts(screen())).toEqual([]); // the shipped 20 is fine
    await type("addsalemodal-vat-rate", "0.2");
    expect(alerts(screen())).toHaveLength(1);
    await type("addsalemodal-vat-rate", "20");
    expect(alerts(screen())).toEqual([]);
  });

  describe("editing a sale", () => {
    const stored = (over: Record<string, unknown> = {}) => ({
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
      ...over,
    });
    const rateBox = () => byId(screen(), "addsalemodal-vat-rate")!.props.value as string;

    it("shows the stored rate as the percentage it is", async () => {
      await open({ existing: stored() });
      expect(rateBox()).toBe("20");
    });

    it("shows a rate like 7% without floating-point noise (0.07 x 100 is 7.000000000000001)", async () => {
      await open({ existing: stored({ vatRate: 0.07 }) });
      expect(rateBox()).toBe("7");
      expect(alerts(screen())).toEqual([]);
      await press("Update Sale");
      expect(updates[0]!.patch.vatRate).toBe(0.07);
    });

    it("a stored rate of 17.5% edits cleanly", async () => {
      await open({ existing: stored({ vatRate: 0.175 }) });
      expect(rateBox()).toBe("17.5");
    });

    it("a sale saved with a rate of 200% (stored as 2) opens with the problem showing, and cannot be re-saved until it is fixed", async () => {
      await open({ existing: stored({ vatRate: 2 }) });
      expect(rateBox()).toBe("200");
      expect(alerts(screen())[0]).toContain("can't be more than 100%");
      await press("Update Sale");
      expect(updates).toEqual([]);
      await type("addsalemodal-vat-rate", "20");
      await press("Update Sale");
      expect(updates[0]!.patch.vatRate).toBe(0.2);
    });

    it("a sale saved with a rate that is nothing (NaN saved as null) opens with an empty box and asks for one", async () => {
      await open({ existing: stored({ vatRate: null }) });
      expect(rateBox()).toBe("");
      await press("Update Sale");
      expect(updates).toEqual([]);
      expect(alerts(screen())).toContain("Enter the VAT rate as a percentage, like 20.");
    });
  });
});

/* -------------------------------------------------------------------- Add Cost */

describe("Add Cost: the VAT rate", () => {
  async function open() {
    mounted = mount(AddCostModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => void closed++ }) as Mounted<any, any>;
    await settle();
  }

  it("a cost with the rate box cleared is refused, not saved as 0% VAT", async () => {
    await open();
    await type("addcostmodal-amount", "120");
    await type("addcostmodal-vat-rate", "");
    await press("Save Cost");
    expect(costs).toEqual([]);
    expect(alerts(screen())).toContain("Enter the VAT rate as a percentage, like 20.");
  });

  it.each(BAD_RATES)("rate %j is refused with its own message and nothing is saved", async (text, expected) => {
    await open();
    await type("addcostmodal-amount", "120");
    await type("addcostmodal-vat-rate", text);
    expect(alerts(screen()).join(" ")).toContain(expected);
    await press("Save Cost");
    expect(costs).toEqual([]);
  });

  it.each(GOOD_RATES)("rate %j is saved as %d", async (text, expected) => {
    await open();
    await type("addcostmodal-amount", "120");
    await type("addcostmodal-vat-rate", text);
    await press("Save Cost");
    expect(costs).toHaveLength(1);
    expect(costs[0].vatRate).toBe(expected);
  });
});

/* ---------------------------------------------------------------- Add Purchase */

describe("Add Purchase: the VAT rate (Standard VAT purchases only)", () => {
  async function open() {
    mounted = mount(AddPurchaseModal as (p: any) => unknown, { vehicleId: null, onClose: () => void closed++ }) as Mounted<any, any>;
    await settle();
  }
  async function fillCar() {
    await type("addpurchasemodal-make", "Ford");
    await type("addpurchasemodal-model", "Fiesta");
  }
  const standard = () => type("addpurchasemodal-vat-scheme-for-when-this-vehicle-is-sold", "standard");
  const rate = (v: string) => type("addpurchasemodal-vat-rate-on-this-purchase", v);

  it("a Standard VAT purchase with the rate cleared is refused, not saved as 0% VAT", async () => {
    await open();
    await fillCar();
    await type("addpurchasemodal-purchase-price", "6000");
    await standard();
    await rate("");
    await press("Save Purchase");
    expect(purchases).toEqual([]);
    expect(alerts(screen())).toContain("Enter the VAT rate as a percentage, like 20.");
  });

  it.each(BAD_RATES)("rate %j is refused for a Standard VAT purchase and nothing is saved", async (text, expected) => {
    await open();
    await fillCar();
    await type("addpurchasemodal-purchase-price", "6000");
    await standard();
    await rate(text);
    expect(alerts(screen()).join(" ")).toContain(expected);
    await press("Save Purchase");
    expect(purchases).toEqual([]);
  });

  it.each(GOOD_RATES)("rate %j is saved as %d for a Standard VAT purchase", async (text, expected) => {
    await open();
    await fillCar();
    await type("addpurchasemodal-purchase-price", "6000");
    await standard();
    await rate(text);
    await press("Save Purchase");
    expect(purchases).toHaveLength(1);
    expect(purchases[0].vatRate).toBe(expected);
  });

  it("a Margin Scheme purchase has no rate box, so a bad one left behind cannot stop it saving", async () => {
    await open();
    await fillCar();
    await type("addpurchasemodal-purchase-price", "6000");
    await standard();
    await rate("abc");
    await type("addpurchasemodal-vat-scheme-for-when-this-vehicle-is-sold", "margin");
    expect(byId(screen(), "addpurchasemodal-vat-rate-on-this-purchase")).toBeUndefined();
    expect(alerts(screen())).toEqual([]);
    await press("Save Purchase");
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({ vatScheme: "margin", vatRate: 0, vatAmount: 0 });
  });
});

/* ----------------------------------------------- a refused Save says so, beside Save */

describe("a refused Save is explained beside the Save button and the field is focused", () => {
  it("Record Sale: nothing beside the button until Save is tried, then the first problem", async () => {
    mounted = mount(AddSaleModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => {} }) as Mounted<any, any>;
    await settle();
    expect(saveError("addsalemodal-save-error")).toBeNull();
    await press("Save Sale");
    expect(saveError("addsalemodal-save-error")).toBe("Can't save yet: Enter the sale price.");
    expect(focused).toEqual(["addsalemodal-sale-price"]);
  });

  it("Record Sale: with a good price and a bad rate, it points at the rate", async () => {
    mounted = mount(AddSaleModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => {} }) as Mounted<any, any>;
    await settle();
    await type("addsalemodal-sale-price", "6000");
    await type("addsalemodal-vat-rate", "");
    await press("Save Sale");
    expect(saveError("addsalemodal-save-error")).toContain("Enter the VAT rate");
    expect(focused).toEqual(["addsalemodal-vat-rate"]);
  });

  it("Record Sale: the line is not a second alert (the field's own message is the one announced)", async () => {
    mounted = mount(AddSaleModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => {} }) as Mounted<any, any>;
    await settle();
    await press("Save Sale");
    expect(alerts(screen())).toEqual(["Enter the sale price."]);
    expect(byId(screen(), "addsalemodal-save-error")!.props.role).toBe("status");
  });

  it("Add Cost: the same, and focused on the amount", async () => {
    mounted = mount(AddCostModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => {} }) as Mounted<any, any>;
    await settle();
    expect(saveError("addcostmodal-save-error")).toBeNull();
    await press("Save Cost");
    expect(saveError("addcostmodal-save-error")).toBe("Can't save yet: Enter the cost amount.");
    expect(focused).toEqual(["addcostmodal-amount"]);
  });

  it("Add Purchase: a blank form says what is missing (it used to return without a word)", async () => {
    mounted = mount(AddPurchaseModal as (p: any) => unknown, { vehicleId: null, onClose: () => {} }) as Mounted<any, any>;
    await settle();
    expect(saveError("addpurchasemodal-save-error")).toBeNull();
    await press("Save Purchase");
    expect(purchases).toEqual([]);
    expect(saveError("addpurchasemodal-save-error")).toBe("Can't save yet: Enter the make and model of the car.");
    expect(alerts(screen())).toEqual(["Enter the make and model of the car.", "Enter the purchase price."]);
    expect(focused).toEqual(["addpurchasemodal-make"]);
  });

  it("Add Purchase: with a price but no make or model, that is what it says (nothing was said before)", async () => {
    mounted = mount(AddPurchaseModal as (p: any) => unknown, { vehicleId: null, onClose: () => {} }) as Mounted<any, any>;
    await settle();
    await type("addpurchasemodal-purchase-price", "4500");
    await press("Save Purchase");
    expect(purchases).toEqual([]);
    expect(alerts(screen())).toContain("Enter the make and model of the car.");
  });

  it("Add Purchase: with a make but no model, focus goes to the model", async () => {
    mounted = mount(AddPurchaseModal as (p: any) => unknown, { vehicleId: null, onClose: () => {} }) as Mounted<any, any>;
    await settle();
    await type("addpurchasemodal-make", "Ford");
    await type("addpurchasemodal-purchase-price", "4500");
    await press("Save Purchase");
    expect(focused).toEqual(["addpurchasemodal-model"]);
  });

  it("Add Purchase: the Save button is no longer greyed out, so pressing it can explain itself", async () => {
    mounted = mount(AddPurchaseModal as (p: any) => unknown, { vehicleId: null, onClose: () => {} }) as Mounted<any, any>;
    await settle();
    const button = buttonByText(screen(), "Save Purchase")!;
    expect(button.props.disabled).toBeFalsy();
  });

  it("Add Purchase: a good form saves and shows no explanation", async () => {
    mounted = mount(AddPurchaseModal as (p: any) => unknown, { vehicleId: null, onClose: () => void closed++ }) as Mounted<any, any>;
    await settle();
    await type("addpurchasemodal-make", "Ford");
    await type("addpurchasemodal-model", "Fiesta");
    await type("addpurchasemodal-purchase-price", "4500");
    await press("Save Purchase");
    expect(purchases).toHaveLength(1);
    expect(closed).toBe(1);
    expect(findAll(screen(), (el) => el.props.role === "alert")).toHaveLength(0);
  });

  it("with no document at all (a server render, a test) a refused Save still just refuses", async () => {
    vi.unstubAllGlobals();
    mounted = mount(AddCostModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => {} }) as Mounted<any, any>;
    await settle();
    await press("Save Cost");
    expect(costs).toEqual([]);
    expect(saveError("addcostmodal-save-error")).toBe("Can't save yet: Enter the cost amount.");
  });
});
