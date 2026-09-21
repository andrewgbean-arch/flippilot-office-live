import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Recon screen through the hook stand-in and adds a recon cost.
// "£120" or "1,200" used to become NaN and be saved as a cost of nothing, which
// then dropped out of the car's profit. The cost must be an amount above £0.

const spies = vi.hoisted(() => ({ addCost: null as null | ((entry: any) => void) }));

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
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "v1" }), useNavigate: () => () => {} }));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ vehicles: [{ id: "v1", make: "Ford", model: "Focus", priceRetail: 8000 }] }),
}));
vi.mock("@/bookkeeping/BookkeepingProvider", () => ({
  useBookkeeping: () => ({ costs: [], sales: [], addCost: (e: any) => spies.addCost!(e), deleteCost: () => {} }),
}));
vi.mock("@/context/ConsumablesContext", () => ({
  useConsumables: () => ({ consumables: [], recordStockMovement: async () => null }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { byLabel, findAll, screenText } from "@/lib/testing/elementTree";
import ReconWorkflow from "./ReconWorkflow";

let mounted: Mounted<any, any>;
let costs: any[];

const settle = async () => {
  for (let i = 0; i < 3; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0));
};
const screen = () => mounted.result;

async function open() {
  mounted = mount(ReconWorkflow as (p: any) => unknown, {}) as Mounted<any, any>;
  await settle();
}
async function typeLabel(label: string, value: string) {
  byLabel(screen(), label)!.props.onChange(value);
  await settle();
}
async function add() {
  findAll(screen(), (el) => el.props.label === "Add")[0]!.props.onClick();
  await settle();
}
const addError = () =>
  findAll(screen(), (el) => el.type === "p" && String(el.props.className).includes("text-red-400")).map((el) => screenText(el))[0];

beforeEach(() => {
  costs = [];
  spies.addCost = (e) => void costs.push(e);
});
afterEach(() => mounted?.unmount());

describe("a recon cost must be an amount above £0", () => {
  it("still needs both an item and a cost, with the message it always had", async () => {
    await open();
    await typeLabel("Recon Item", "Tyres");
    await add();
    expect(costs).toEqual([]);
    expect(addError()).toBe("Enter both an item description and a cost before adding.");
  });

  it.each([
    ["abc", "Enter an amount in pounds"],
    ["0", "greater than £0"],
    ["-50", "no minus sign"],
    ["1,2", "Commas can only separate thousands"],
    ["1e3", "Enter an amount in pounds"],
    ["Infinity", "Enter an amount in pounds"],
  ])("cost %j is refused with its own message and nothing is logged", async (text, expected) => {
    await open();
    await typeLabel("Recon Item", "Tyres");
    await typeLabel("Cost (£)", text);
    await add();
    expect(costs).toEqual([]);
    expect(addError()).toContain("Cost: ");
    expect(addError()).toContain(expected);
  });

  it.each([
    ["150", 150],
    ["£150", 150],
    ["1,200", 1200],
    ["£99.99", 99.99],
  ])("cost %j is logged as %d, with no VAT", async (text, expected) => {
    await open();
    await typeLabel("Recon Item", "Tyres");
    await typeLabel("Cost (£)", text);
    await add();
    expect(costs).toHaveLength(1);
    expect(costs[0]).toMatchObject({ type: "recon", label: "Tyres", amount: expected, netAmount: expected, vatAmount: 0, vehicleId: "v1" });
    expect(Number.isNaN(costs[0].amount)).toBe(false);
  });
});
