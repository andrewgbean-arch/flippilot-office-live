import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Edit Vehicle screen through a stand-in for React's hooks
// (lib/testing/hookRuntime.ts) and drives the Delete Vehicle confirmation.
//
// Two things are pinned. (1) When Bookkeeping holds a purchase, sale or cost for
// the car, the confirmation says so plainly before they press Delete Forever.
// (2) Nothing about the delete itself changed: it is not blocked, it still runs
// on a 10 second countdown, and Undo still stops it.

const state = vi.hoisted(() => ({
  deleteVehicle: null as null | ((id: string) => void),
  navigate: null as null | ((to: string) => void),
  ledger: { sales: [] as any[], purchases: [] as any[], costs: [] as any[] },
}));

vi.mock("react", async importOriginal => {
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
vi.mock("react-router-dom", () => ({ useNavigate: () => state.navigate }));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({
    vehicles: [
      {
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
      },
    ],
    updateVehicle: () => {},
    deleteVehicle: (id: string) => state.deleteVehicle!(id),
  }),
}));
vi.mock("@/bookkeeping/BookkeepingProvider", () => ({ useBookkeeping: () => state.ledger }));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import EditVehicle from "./EditVehicle";

/* --------------------------- reading the element tree --------------------------- */

interface El {
  type: unknown;
  props: Record<string, any>;
}
const isElement = (node: unknown): node is El => typeof node === "object" && node !== null && "props" in node;

function walk(node: unknown, visit: (el: El) => void) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!isElement(node)) return;
  visit(node);
  walk(node.props.children, visit);
}
function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isElement(node)) return textOf(node.props.children);
  return "";
}
function findAll(root: unknown, match: (el: El) => boolean): El[] {
  const found: El[] = [];
  walk(root, el => {
    if (match(el)) found.push(el);
  });
  return found;
}

/* --------------------------------- plumbing --------------------------------- */

let mounted: Mounted<{ vehicleId: string }, any> | null = null;
let deleted: string[];
let navigatedTo: string[];

// Timers are faked (the delete runs on a countdown), so "let everything settle"
// means flushing microtasks, not waiting on a real timer.
const settle = () => vi.advanceTimersByTimeAsync(0);
const screen = () => mounted!.result;
const screenText = () => textOf(screen());

async function open() {
  mounted = mount(EditVehicle as (props: { vehicleId: string }) => unknown, { vehicleId: "v1" }) as Mounted<
    { vehicleId: string },
    any
  >;
  await settle();
}

const press = async (find: (el: El) => boolean, what: string) => {
  const target = findAll(screen(), find)[0];
  if (!target) throw new Error(`nothing to press for ${what}`);
  target.props.onClick();
  await settle();
};
const pressDeleteVehicle = () => press(el => el.props.label === "Delete Vehicle", "Delete Vehicle");
const pressButton = (label: string) => press(el => el.type === "button" && textOf(el).trim() === label, label);
const warning = () => findAll(screen(), el => el.type === "p" && el.props.role === "alert")[0];

const fullLedger = () => ({
  sales: [{ vehicleId: "v1" }],
  purchases: [{ vehicleId: "v1" }],
  costs: [{ vehicleId: "v1" }, { vehicleId: "v1" }, { vehicleId: "some-other-car" }],
});

beforeEach(() => {
  vi.useFakeTimers();
  deleted = [];
  navigatedTo = [];
  state.deleteVehicle = id => {
    deleted.push(id);
  };
  state.navigate = to => {
    navigatedTo.push(to);
  };
  state.ledger = { sales: [], purchases: [], costs: [] };
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* ----------------------------------- tests ----------------------------------- */

describe("the delete confirmation for a car with Bookkeeping records", () => {
  it("says plainly how many records there are and what deleting will do to them", async () => {
    state.ledger = fullLedger();
    await open();
    await pressDeleteVehicle();

    expect(screenText()).toContain("Confirm Delete");
    expect(screenText()).toContain("This action cannot be undone.");
    expect(textOf(warning())).toBe(
      "This car has 4 records in Bookkeeping (a sale, a purchase, 2 costs). " +
        "Deleting it leaves those records without a car, and an invoice for it can no longer be opened."
    );
    expect(deleted).toEqual([]); // still only asking
  });

  it("counts only this car's records", async () => {
    state.ledger = { sales: [], purchases: [{ vehicleId: "another" }], costs: [{ vehicleId: "v1" }, { vehicleId: "another" }] };
    await open();
    await pressDeleteVehicle();
    expect(textOf(warning())).toContain("This car has 1 record in Bookkeeping (a cost).");
  });

  it("says nothing extra for a car with no Bookkeeping records", async () => {
    state.ledger = { sales: [{ vehicleId: "another" }], purchases: [], costs: [] };
    await open();
    await pressDeleteVehicle();

    expect(screenText()).toContain("Confirm Delete");
    expect(warning()).toBeUndefined();
    expect(screenText()).not.toContain("Bookkeeping");
  });

  it("doesn't show the warning until they open the confirmation", async () => {
    state.ledger = fullLedger();
    await open();
    expect(warning()).toBeUndefined();
    expect(screenText()).not.toContain("Confirm Delete");
  });
});

describe("the delete itself is unchanged", () => {
  it("is not blocked: Delete Forever starts the countdown, and the car is deleted after 10 seconds", async () => {
    state.ledger = fullLedger();
    await open();
    await pressDeleteVehicle();
    await pressButton("Delete Forever");

    expect(screenText()).toContain("Vehicle Deleted");
    expect(screenText()).toContain("Undo available for 10s");
    expect(screenText()).not.toContain("Confirm Delete"); // the dialog closed
    expect(deleted).toEqual([]);

    await vi.advanceTimersByTimeAsync(9_000);
    expect(deleted).toEqual([]); // still counting down

    await vi.advanceTimersByTimeAsync(1_000);
    expect(deleted).toEqual(["v1"]);
    expect(navigatedTo).toEqual(["/dealer/inventory/list"]);
  });

  it("Undo still stops it", async () => {
    state.ledger = fullLedger();
    await open();
    await pressDeleteVehicle();
    await pressButton("Delete Forever");
    await vi.advanceTimersByTimeAsync(4_000);
    await pressButton("Undo Delete");

    await vi.advanceTimersByTimeAsync(30_000);
    expect(deleted).toEqual([]);
    expect(screenText()).not.toContain("Vehicle Deleted");
  });

  it("Cancel closes the confirmation and deletes nothing", async () => {
    state.ledger = fullLedger();
    await open();
    await pressDeleteVehicle();
    await pressButton("Cancel");

    expect(screenText()).not.toContain("Confirm Delete");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(deleted).toEqual([]);
  });

  it("a car with no records is deleted just the same", async () => {
    await open();
    await pressDeleteVehicle();
    await pressButton("Delete Forever");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deleted).toEqual(["v1"]);
  });
});
