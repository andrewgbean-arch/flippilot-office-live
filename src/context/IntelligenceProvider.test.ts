import { describe, it, expect, vi, beforeEach } from "vitest";

// Runs the REAL IntelligenceProvider through a stand-in for React's hooks (see
// lib/testing/hookRuntime.ts).
//
// The bug this pins: the provider's `loading` starts true and its effect
// returned early for a dealer with no cars WITHOUT clearing it, so a new
// dealer's header stayed on "Refreshing..." and the Risk Hub on "Loading..."
// for ever.

const inventory = vi.hoisted(() => ({ vehicles: [] as unknown[] }));

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
vi.mock("./InventoryProvider", () => ({ useInventory: () => ({ vehicles: inventory.vehicles }) }));

import { mount } from "@/lib/testing/hookRuntime";
import { IntelligenceProvider } from "./IntelligenceProvider";

interface Value {
  motHealth: Record<string, { riskLevel: string }>;
  loading: boolean;
}

// What the provider's consumers would receive, once its effect has run and
// the state it set has been rendered.
async function valueAfterMount(): Promise<{ value: Value }> {
  const mounted = mount(IntelligenceProvider as never, { children: null });
  await Promise.resolve();
  return { value: (mounted.result as { props: { value: Value } }).props.value };
}

const carWith = (id: string, expiry: string) => ({ id, mileage: 50_000, mot: { expiry, advisories: [] } });

beforeEach(() => {
  inventory.vehicles = [];
});

describe("IntelligenceProvider", () => {
  it("stops loading when the dealer has no cars, instead of loading for ever", async () => {
    const { value } = await valueAfterMount();
    expect(value.loading).toBe(false);
    expect(value.motHealth).toEqual({});
  });

  it("stops loading once it has worked out the MOT health of the cars it was given", async () => {
    inventory.vehicles = [carWith("a", "2020-01-01"), carWith("b", "2099-01-01")];
    const { value } = await valueAfterMount();
    expect(value.loading).toBe(false);
    expect(Object.keys(value.motHealth).sort()).toEqual(["a", "b"]);
    // an expired MOT is high risk, a distant one is not
    expect(value.motHealth.a?.riskLevel).toBe("high");
    expect(value.motHealth.b?.riskLevel).toBe("low");
  });

  it("no longer offers the invented readings it used to compute", async () => {
    inventory.vehicles = [carWith("a", "2099-01-01")];
    const { value } = await valueAfterMount();
    expect(Object.keys(value).sort()).toEqual(["loading", "motHealth"]);
  });

  it("clears the previous stock's results when the last car goes", async () => {
    inventory.vehicles = [carWith("a", "2099-01-01")];
    const mounted = mount(IntelligenceProvider as never, { children: null });
    await Promise.resolve();
    const read = () => (mounted.result as { props: { value: Value } }).props.value;
    expect(Object.keys(read().motHealth)).toEqual(["a"]);

    inventory.vehicles = [];
    mounted.rerender();
    await Promise.resolve();
    expect(read().motHealth).toEqual({});
    expect(read().loading).toBe(false);
  });
});
