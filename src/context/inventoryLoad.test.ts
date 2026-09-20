import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL InventoryProvider through a stand-in for React's hooks (see
// lib/testing/hookRuntime.ts) against a fake server that behaves like the real
// stock route (GET returns what is stored; PUT is an upsert).
//
// The bug this pins (found by an independent review): the server accepts a
// stored car with no `mot` object, and the provider then failed the whole load,
// showing a load error and NO cars although the server held every one. One odd
// record must not hide the rest of the stock.

const auth = vi.hoisted(() => ({ user: null as { dealershipId: string } | null }));

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
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/features/dealer-notifications/DealerNotificationsContext", () => ({
  useDealerNotifications: () => ({ addNotification: () => {} }),
}));

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { BASE_URL } from "@/lib/apiBaseUrl";
import { InventoryProvider } from "./InventoryProvider";

/* ------------------------------ fake server ------------------------------ */

interface Call {
  method: string;
  path: string;
  body: any;
}

let stored: any[];
let calls: Call[];

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// Answers with copies, as real responses are.
const fakeFetch = async (input: unknown, init?: { method?: string; body?: unknown }) => {
  const method = (init?.method ?? "GET").toUpperCase();
  const path = String(input).replace(BASE_URL, "");
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  calls.push({ method, path, body });

  if (method === "GET" && path === "/inventory") return reply(200, { ok: true, items: structuredClone(stored) });
  if (method === "PUT" && path === "/inventory") {
    // Upsert, like routes/inventory.ts: sent cars replace stored ones by id,
    // stored cars that weren't sent stay, only deletedIds remove.
    const deleted = new Set<string>(body.deletedIds ?? []);
    const sent = new Map<string, any>(
      (body.items as any[]).filter(c => c && typeof c.id === "string").map(c => [c.id, c] as [string, any])
    );
    const merged: any[] = [];
    const seen = new Set<string>();
    for (const item of stored) {
      const id = item && typeof item.id === "string" ? item.id : null;
      if (id === null) merged.push(item);
      else if (!deleted.has(id)) {
        seen.add(id);
        merged.push(sent.has(id) ? sent.get(id) : item);
      }
    }
    for (const [id, item] of sent) if (!seen.has(id) && !deleted.has(id)) merged.push(item);
    stored = merged;
    return reply(200, { ok: true, items: structuredClone(stored) });
  }
  return reply(404, { ok: false, error: `unhandled ${method} ${path}` });
};

/* ------------------------------ test plumbing ----------------------------- */

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

let mounted: Mounted<{ children?: unknown }, any> | null = null;
const ctx = () => mounted!.result.props.value as any;

async function open() {
  mounted = mount(InventoryProvider as (props: { children?: unknown }) => unknown, { children: null }) as Mounted<
    { children?: unknown },
    any
  >;
  await settle();
}

// The "AI" fields older versions computed and saved with every car. They were
// invented (see dealer/intelligence/dealerAI.ts), so nothing writes them any
// more and a car read from the server has them removed.
const RETIRED_FIELDS = [
  "marketHeat",
  "riskScore",
  "supernovaScore",
  "flipDifficulty",
  "valuationConfidence",
  "photoQuality",
  "auctionDelta",
  "buyerPersona",
  "sellerPsychology",
  "predictedRepairs",
];
const expectNoRetiredFields = (car: any) => {
  for (const key of RETIRED_FIELDS) expect(car, key).not.toHaveProperty(key);
};

// A car as the shipped screens build it (see buildVehicle in InventoryProvider).
const goodCar = (id: string) => ({
  id,
  make: "Ford",
  model: "Fiesta",
  year: 2018,
  mileage: 50000,
  priceRetail: 9000,
  priceTrade: 7000,
  condition: "Unknown",
  mot: { expiry: "2030-01-01", advisories: [], historyScore: 0, history: [] },
  depreciationCurve: [],
  finance: { apr: 0, depositMin: 0, lenderTier: "A" },
  img: "/placeholder-car.png",
  status: "new",
});

// A car as an OLDER version saved it, with all ten retired fields filled in.
const oldCar = (id: string) => ({
  ...goodCar(id),
  marketHeat: 0,
  riskScore: 0,
  supernovaScore: 41,
  flipDifficulty: 93,
  valuationConfidence: 61,
  photoQuality: 50,
  auctionDelta: 12,
  buyerPersona: ["Budget-Conscious Commuter"],
  sellerPsychology: [],
  predictedRepairs: [{ component: "Clutch / Drivetrain", likelihood: 60, cost: 700 }],
});

// The reviewer's example: an id, a make and a model, and nothing else.
const bareCar = (id: string) => ({ id, make: "Ford", model: "Focus" });

beforeEach(() => {
  stored = [];
  calls = [];
  auth.user = { dealershipId: "dealer-a" };
  vi.stubGlobal("fetch", fakeFetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  auth.user = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ----------------------------------- tests ----------------------------------- */

describe("loading the stock when one stored car is odd", () => {
  it("a car with no mot object next to a good car: both are shown, and it is not a load error", async () => {
    stored = [bareCar("odd"), goodCar("good")];
    await open();

    expect(ctx().loadError).toBe(false);
    expect(ctx().loading).toBe(false);
    expect(ctx().vehicles.map((v: any) => v.id)).toEqual(["odd", "good"]);
  });

  it("the odd car is readable by the screens: its missing pieces are filled in, its own fields kept", async () => {
    stored = [bareCar("odd")];
    await open();

    const [odd] = ctx().vehicles;
    expect(odd).toMatchObject({ id: "odd", make: "Ford", model: "Focus" });
    expect(odd.mot).toEqual({ expiry: "", advisories: [], historyScore: 0, history: [] });
    expect(odd.depreciationCurve).toEqual([]);
    expectNoRetiredFields(odd); // no invented numbers on it either
  });

  it("the good car is shown as stored: nothing invented is added to it", async () => {
    stored = [bareCar("odd"), goodCar("good")];
    await open();
    const good = ctx().vehicles.find((v: any) => v.id === "good");
    expect(good).toMatchObject({ make: "Ford", model: "Fiesta", priceRetail: 9000, priceTrade: 7000 });
    expectNoRetiredFields(good);
  });

  it("a car an older version saved with the invented scores has them cleared, on screen and in the server's copy after the next save", async () => {
    stored = [oldCar("old")];
    await open();

    expectNoRetiredFields(ctx().vehicles[0]);
    expect(ctx().vehicles[0]).toMatchObject({ id: "old", make: "Ford", priceRetail: 9000 });

    ctx().updateVehicle("old", { notes: "Two keys" });
    await settle();

    expectNoRetiredFields(stored[0]);
    expect(stored[0]).toMatchObject({ id: "old", notes: "Two keys", priceRetail: 9000 });
  });

  it("entries that aren't cars at all (left in the stored list) don't hide the real ones", async () => {
    stored = [null, 5, "x", [], goodCar("good"), bareCar("odd")];
    await open();

    expect(ctx().loadError).toBe(false);
    expect(ctx().vehicles.map((v: any) => v.id)).toEqual(["good", "odd"]);
  });

  it("every car the server held is still there after an ordinary edit is saved", async () => {
    stored = [bareCar("odd"), goodCar("good")];
    await open();

    ctx().updateVehicle("good", { notes: "Two keys" });
    await settle();

    expect(calls.filter(c => c.method === "PUT")).toHaveLength(1);
    expect(stored.map(c => c.id).sort()).toEqual(["good", "odd"]);
    expect(stored.find(c => c.id === "good").notes).toBe("Two keys");
    expect(stored.find(c => c.id === "odd")).toMatchObject({ make: "Ford", model: "Focus" });
    expect(ctx().vehicles.map((v: any) => v.id)).toEqual(["odd", "good"]);
    expect(ctx().saveError).toBeNull();
  });
});

describe("cars the app creates itself carry none of the invented fields", () => {
  it("a car added by hand", async () => {
    await open();

    const added = ctx().addManualVehicle({
      make: "Ford",
      model: "Fiesta",
      year: 2019,
      mileage: 40000,
      buyPrice: 5000,
      sellPrice: 7000,
      images: ["photo.jpg"],
    });
    await settle();

    expectNoRetiredFields(added);
    expect(stored).toHaveLength(1);
    expectNoRetiredFields(stored[0]);
    expect(stored[0]).toMatchObject({ make: "Ford", priceTrade: 5000, priceRetail: 7000, images: ["photo.jpg"] });
  });

  it("a car created from an MOT lookup", async () => {
    await open();

    const added = ctx().createVehicleFromMOT({ make: "Ford", model: "Focus", year: 2017, mileage: 60000, expiry: "2030-01-01" });
    await settle();

    expectNoRetiredFields(added);
    expect(stored).toHaveLength(1);
    expectNoRetiredFields(stored[0]);
    expect(stored[0].mot.expiry).toBe("2030-01-01");
  });

  it("cars imported in bulk", async () => {
    await open();

    const built = ctx().importVehicles([
      { make: "Ford", model: "Ka" },
      { make: "Vauxhall", model: "Corsa", images: ["a.jpg", "b.jpg"] },
    ]);
    await settle();

    expect(built).toHaveLength(2);
    built.forEach(expectNoRetiredFields);
    expect(stored).toHaveLength(2);
    stored.forEach(expectNoRetiredFields);
  });
});
