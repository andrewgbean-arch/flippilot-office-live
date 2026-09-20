import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Add Cost and Add Transaction forms through the hook stand-in.
// The amount is REQUIRED and must be above £0: a blank used to be saved as a £0
// cost or transaction, and "£120" or "1,200" was read as nothing.

const spies = vi.hoisted(() => ({
  addCost: null as null | ((entry: any) => void),
  addTransaction: null as null | ((entry: any) => void),
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
    addCost: (e: any) => spies.addCost!(e),
    addTransaction: (e: any) => spies.addTransaction!(e),
  }),
}));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ vehicles: [{ id: "v1", make: "Ford", model: "Focus" }] }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { byId, buttonByText, typeInto, alerts } from "@/lib/testing/elementTree";
import AddCostModal from "./AddCostModal";
import AddTransactionModal from "./AddTransactionModal";

let mounted: Mounted<any, any>;
let costs: any[];
let transactions: any[];
let closed: number;

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

beforeEach(() => {
  costs = [];
  transactions = [];
  closed = 0;
  spies.addCost = (e) => void costs.push(e);
  spies.addTransaction = (e) => void transactions.push(e);
});
afterEach(() => mounted?.unmount());

const BAD: [string, string][] = [
  ["abc", "Enter an amount in pounds"],
  ["0", "greater than £0"],
  ["0.00", "greater than £0"],
  ["-20", "no minus sign"],
  ["1,2", "Commas can only separate thousands"],
  ["1.200,50", "European"],
  ["1e2", "Enter an amount in pounds"],
  ["Infinity", "Enter an amount in pounds"],
];
const GOOD: [string, number][] = [
  ["120", 120],
  ["1,200", 1200],
  ["£120.50", 120.5],
  ["  75  ", 75],
];

describe("Add Cost", () => {
  async function open() {
    mounted = mount(AddCostModal as (p: any) => unknown, { vehicleId: "v1", onClose: () => void closed++ }) as Mounted<any, any>;
    await settle();
  }

  it("a blank amount saves nothing and says what to enter (only once they try)", async () => {
    await open();
    expect(alerts(screen())).toEqual([]);
    await press("Save Cost");
    expect(costs).toEqual([]);
    expect(closed).toBe(0);
    expect(alerts(screen())).toEqual(["Enter the cost amount."]);
  });

  it.each(BAD)("amount %j is refused with its own message, live, and saves nothing", async (text, expected) => {
    await open();
    await type("addcostmodal-amount", text);
    expect(alerts(screen())[0]).toContain(expected);
    await press("Save Cost");
    expect(costs).toEqual([]);
    expect(closed).toBe(0);
  });

  it.each(GOOD)("amount %j is saved as %d", async (text, expected) => {
    await open();
    await type("addcostmodal-amount", text);
    expect(alerts(screen())).toEqual([]);
    await press("Save Cost");
    expect(costs).toHaveLength(1);
    expect(costs[0].amount).toBe(expected);
    expect(costs[0].vehicleId).toBe("v1");
    expect(closed).toBe(1);
  });

  it("works the VAT out from the amount that was read: 120 incl 20% is 20 VAT, net 100", async () => {
    await open();
    await type("addcostmodal-amount", "£120");
    await press("Save Cost");
    expect(costs[0]).toMatchObject({ amount: 120, vatRate: 0.2, vatIncluded: true, vatReclaimable: true });
    expect(costs[0].vatAmount).toBeCloseTo(20, 10);
    expect(costs[0].netAmount).toBeCloseTo(100, 10);
  });
});

describe("Add Transaction", () => {
  async function open() {
    mounted = mount(AddTransactionModal as (p: any) => unknown, { onClose: () => void closed++ }) as Mounted<any, any>;
    await settle();
  }

  it("a blank amount saves nothing and says what to enter (only once they try)", async () => {
    await open();
    expect(alerts(screen())).toEqual([]);
    await press("Save Transaction");
    expect(transactions).toEqual([]);
    expect(closed).toBe(0);
    expect(alerts(screen())).toEqual(["Enter the amount."]);
  });

  it.each(BAD)("amount %j is refused with its own message, live, and saves nothing", async (text, expected) => {
    await open();
    await type("addtransactionmodal-amount", text);
    expect(alerts(screen())[0]).toContain(expected);
    await press("Save Transaction");
    expect(transactions).toEqual([]);
    expect(closed).toBe(0);
  });

  it.each(GOOD)("amount %j is saved as %d", async (text, expected) => {
    await open();
    await type("addtransactionmodal-category", "Rent");
    await type("addtransactionmodal-amount", text);
    expect(alerts(screen())).toEqual([]);
    await press("Save Transaction");
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ amount: expected, category: "Rent", type: "expense" });
    expect(closed).toBe(1);
  });

  it("an income transaction keeps its type", async () => {
    await open();
    await type("addtransactionmodal-type", "income");
    await type("addtransactionmodal-amount", "250");
    await press("Save Transaction");
    expect(transactions[0]).toMatchObject({ type: "income", amount: 250 });
  });
});
