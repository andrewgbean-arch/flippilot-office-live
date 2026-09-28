import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";

// Stands in for the Stripe library so tests never touch the real Stripe.
// Subscriptions are a little in-memory store keyed by id, set up per test
// with setSubscription(), so the webhook's subscriptions.retrieve() and the
// re-derivation on customer.subscription.updated both read something real.
const stripeState = vi.hoisted(() => ({
  checkout: [] as Array<Record<string, unknown>>,
  scheduleCreates: [] as Array<Record<string, unknown>>,
  scheduleUpdates: [] as Array<{ id: string; params: Record<string, unknown> }>,
  subscriptions: new Map<string, any>(),
  nextScheduleId: 1,
  failScheduleCreate: false,
}));

function resetStripeState() {
  stripeState.checkout = [];
  stripeState.scheduleCreates = [];
  stripeState.scheduleUpdates = [];
  stripeState.subscriptions = new Map();
  stripeState.nextScheduleId = 1;
  stripeState.failScheduleCreate = false;
}

vi.mock("stripe", () => ({
  default: class FakeStripe {
    checkout = {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          stripeState.checkout.push(args);
          return { url: "https://checkout.stripe.example/session", id: "cs_test_fake" };
        },
      },
    };
    billingPortal = { sessions: { create: async () => ({ url: "https://billing.stripe.example/portal" }) } };
    subscriptions = {
      retrieve: async (id: string) => {
        const sub = stripeState.subscriptions.get(id);
        if (!sub) throw new Error(`no fake subscription for ${id}`);
        return sub;
      },
    };
    subscriptionSchedules = {
      create: async (args: Record<string, unknown>) => {
        if (stripeState.failScheduleCreate) throw new Error("simulated Stripe failure");
        stripeState.scheduleCreates.push(args);
        return { id: `sub_sched_${stripeState.nextScheduleId++}` };
      },
      update: async (id: string, params: Record<string, unknown>) => {
        stripeState.scheduleUpdates.push({ id, params });
        return { id };
      },
    };
    webhooks = {
      constructEvent: (raw: Buffer | string) => JSON.parse(raw.toString()),
    };
  },
}));

import app from "./app.js";
import { readCollection, writeCollection } from "./db.js";
import type { Dealership } from "./auth.js";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let counter = 0;

async function signup(label: string) {
  counter += 1;
  const email = `billing-plan-${Date.now()}-${counter}-${label}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "billingplantestpass123",
    name: `Billing Plan ${label}`,
    dealershipName: `Billing Plan Motors ${label}`,
  });
  expect(res.status).toBe(200);
  return { token: res.body.token as string, dealershipId: res.body.user.dealershipId as string };
}

function dealershipRow(id: string): Dealership {
  return readCollection<Dealership>("dealerships").find(d => d.id === id)!;
}

// A fake subscription with one item on the given price, matching only the
// fields the app actually reads (id, status, items.data[0].price.id) —
// same "just enough to be real" pattern as the rest of this app's Stripe tests.
function fakeSubscription(id: string, priceId: string, status = "active") {
  const sub = { id, status, items: { data: [{ price: { id: priceId } }] } };
  stripeState.subscriptions.set(id, sub);
  return sub;
}

async function completeCheckout(dealershipId: string, subscriptionId: string, customerId = "cus_fake") {
  const event = {
    id: `evt_${subscriptionId}`,
    type: "checkout.session.completed",
    data: { object: { id: `cs_${subscriptionId}`, customer: customerId, subscription: subscriptionId, metadata: { dealershipId } } },
  };
  return request(app).post("/billing/webhook").set("Content-Type", "application/json").set("stripe-signature", "test-sig").send(JSON.stringify(event));
}

async function updateSubscriptionEvent(subscriptionId: string, priceId: string, status = "active") {
  fakeSubscription(subscriptionId, priceId, status);
  const event = {
    id: `evt_update_${subscriptionId}_${Date.now()}`,
    type: "customer.subscription.updated",
    data: { object: { id: subscriptionId, status, items: { data: [{ price: { id: priceId } }] } } },
  };
  return request(app).post("/billing/webhook").set("Content-Type", "application/json").set("stripe-signature", "test-sig").send(JSON.stringify(event));
}

const PRICE_ENV = {
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_WEBHOOK_SECRET: "whsec_test_fake",
  STRIPE_CORE_SETTLING_PRICE_ID: "price_core_settling",
  STRIPE_CORE_STANDARD_PRICE_ID: "price_core_standard",
  STRIPE_PILOT_BRAIN_SETTLING_PRICE_ID: "price_pb_settling",
  STRIPE_PILOT_BRAIN_STANDARD_PRICE_ID: "price_pb_standard",
};
const KEYS = Object.keys(PRICE_ENV);
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  resetStripeState();
  for (const key of KEYS) saved[key] = process.env[key];
  Object.assign(process.env, PRICE_ENV);
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("which plans checkout can start", () => {
  it("offers only the plans whose Stripe Prices are both set", async () => {
    const { token } = await signup("options-both");
    const both = await request(app).get("/billing/options").set(auth(token));
    expect(both.body.plans).toEqual({ core: true, core_pilot_brain: true });

    delete process.env.STRIPE_PILOT_BRAIN_STANDARD_PRICE_ID; // only one of the pair set — not offered
    const oneMissing = await request(app).get("/billing/options").set(auth(token));
    expect(oneMissing.body.plans).toEqual({ core: true, core_pilot_brain: false });
  });

  it("starts checkout on the chosen plan's SETTLING price, and defaults to core when no plan is sent", async () => {
    const { token } = await signup("checkout-plan");
    const core = await request(app).post("/billing/create-checkout-session").set(auth(token)).send({});
    expect(core.status).toBe(200);
    expect(stripeState.checkout[0]!.line_items).toEqual([{ price: "price_core_settling", quantity: 1 }]);

    const pb = await request(app).post("/billing/create-checkout-session").set(auth(token)).send({ plan: "core_pilot_brain" });
    expect(pb.status).toBe(200);
    expect(stripeState.checkout[1]!.line_items).toEqual([{ price: "price_pb_settling", quantity: 1 }]);
  });

  it("refuses a plan whose Prices aren't both configured, and starts nothing", async () => {
    delete process.env.STRIPE_PILOT_BRAIN_SETTLING_PRICE_ID;
    const { token } = await signup("checkout-unavailable");
    const res = await request(app).post("/billing/create-checkout-session").set(auth(token)).send({ plan: "core_pilot_brain" });
    expect(res.status).toBe(400);
    expect(stripeState.checkout).toHaveLength(0);
  });
});

describe("the webhook sets up the 6-month price step-up", () => {
  it("schedules core: settling for 6 months, then the standard price forever, end_behavior release", async () => {
    const { dealershipId } = await signup("schedule-core");
    fakeSubscription("sub_core_1", "price_core_settling");

    const res = await completeCheckout(dealershipId, "sub_core_1");
    expect(res.status).toBe(200);

    expect(stripeState.scheduleCreates).toEqual([{ from_subscription: "sub_core_1" }]);
    expect(stripeState.scheduleUpdates).toHaveLength(1);
    expect(stripeState.scheduleUpdates[0]!.params).toEqual({
      end_behavior: "release",
      phases: [
        { items: [{ price: "price_core_settling", quantity: 1 }], duration: { interval: "month", interval_count: 6 } },
        { items: [{ price: "price_core_standard", quantity: 1 }] },
      ],
    });

    const row = dealershipRow(dealershipId);
    expect(row).toMatchObject({
      subscriptionStatus: "active",
      stripeSubscriptionId: "sub_core_1",
      stripeCustomerId: "cus_fake",
      pilotBrainEnabled: false,
      stripeScheduleId: "sub_sched_1",
    });
    expect(row.subscribedAt).toBeDefined();
    expect(Date.now() - Date.parse(row.subscribedAt!)).toBeLessThan(5000);
  });

  it("schedules the Pilot Brain plan with ITS OWN prices, and marks pilotBrainEnabled", async () => {
    const { dealershipId } = await signup("schedule-pb");
    fakeSubscription("sub_pb_1", "price_pb_settling");

    await completeCheckout(dealershipId, "sub_pb_1");

    expect(stripeState.scheduleUpdates[0]!.params).toMatchObject({
      phases: [
        { items: [{ price: "price_pb_settling", quantity: 1 }], duration: { interval: "month", interval_count: 6 } },
        { items: [{ price: "price_pb_standard", quantity: 1 }] },
      ],
    });
    expect(dealershipRow(dealershipId).pilotBrainEnabled).toBe(true);
  });

  it("the checkout still counts as a real subscription even if scheduling the step-up fails", async () => {
    const { dealershipId } = await signup("schedule-fails");
    fakeSubscription("sub_fail_1", "price_core_settling");
    stripeState.failScheduleCreate = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await completeCheckout(dealershipId, "sub_fail_1");
    expect(res.status).toBe(200); // Stripe must still see this as handled

    const row = dealershipRow(dealershipId);
    expect(row.subscriptionStatus).toBe("active");
    expect(row.stripeSubscriptionId).toBe("sub_fail_1");
    expect(row.stripeScheduleId).toBeUndefined(); // never set — nothing to reference
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("a subscription on a price nobody recognises still activates, with no schedule and no plan assumed", async () => {
    const { dealershipId } = await signup("schedule-unknown-price");
    fakeSubscription("sub_unknown_1", "price_from_a_different_product_entirely");

    const res = await completeCheckout(dealershipId, "sub_unknown_1");
    expect(res.status).toBe(200);
    expect(stripeState.scheduleCreates).toHaveLength(0);

    const row = dealershipRow(dealershipId);
    expect(row.subscriptionStatus).toBe("active");
    expect(row.pilotBrainEnabled).toBe(false);
    expect(row.stripeScheduleId).toBeUndefined();
  });
});

describe("keeping pilotBrainEnabled and status true to the real subscription", () => {
  it("a later customer.subscription.updated re-derives the plan from the CURRENT price, and never touches subscribedAt", async () => {
    const { dealershipId } = await signup("update-replan");
    fakeSubscription("sub_up_1", "price_core_settling");
    await completeCheckout(dealershipId, "sub_up_1");
    const subscribedAt = dealershipRow(dealershipId).subscribedAt;

    // The schedule doing exactly what it was set up to do: stepping the
    // price up after 6 months. Still the core plan — pilotBrainEnabled must
    // stay false, and this must not look like a brand-new subscription.
    await updateSubscriptionEvent("sub_up_1", "price_core_standard");
    let row = dealershipRow(dealershipId);
    expect(row.pilotBrainEnabled).toBe(false);
    expect(row.subscribedAt).toBe(subscribedAt);

    // The dealer adds Pilot Brain later via the real Stripe billing portal —
    // this app finds out only through this same event.
    await updateSubscriptionEvent("sub_up_1", "price_pb_standard");
    row = dealershipRow(dealershipId);
    expect(row.pilotBrainEnabled).toBe(true);
    expect(row.subscribedAt).toBe(subscribedAt);
  });

  it("customer.subscription.updated with a cancelled/past_due status is reflected, plan gates aside", async () => {
    const { dealershipId } = await signup("update-status");
    fakeSubscription("sub_status_1", "price_core_settling");
    await completeCheckout(dealershipId, "sub_status_1");

    await updateSubscriptionEvent("sub_status_1", "price_core_settling", "past_due");
    expect(dealershipRow(dealershipId).subscriptionStatus).toBe("past_due");

    await updateSubscriptionEvent("sub_status_1", "price_core_settling", "canceled");
    expect(dealershipRow(dealershipId).subscriptionStatus).toBe("canceled");
  });
});
