import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";

// Stands in for the Stripe library so the test can read the addresses the app
// asks Stripe to send the customer back to. Nothing here touches the real Stripe.
const stripeCalls = vi.hoisted(() => ({
  checkout: [] as Array<Record<string, unknown>>,
  portal: [] as Array<Record<string, unknown>>,
}));
vi.mock("stripe", () => ({
  default: class FakeStripe {
    checkout = {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          stripeCalls.checkout.push(args);
          return { url: "https://checkout.stripe.example/session" };
        },
      },
    };
    billingPortal = {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          stripeCalls.portal.push(args);
          return { url: "https://billing.stripe.example/portal" };
        },
      },
    };
  },
}));

import app from "./app.js";
import { appLink, appUrl, DEFAULT_APP_URL } from "./appUrl.js";
import { readCollection, writeCollection } from "./db.js";
import { signupOwner } from "./resetTestSupport.js";

// Every link the server hands out (password-reset emails, Stripe's success /
// cancel / portal-return pages) is built from ONE trusted address. Billing used to
// send every customer back to http://localhost:5173 after paying.

const saved: Record<string, string | undefined> = {};
const KEYS = ["APP_URL", "NODE_ENV", "STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_PILOT_BRAIN_PRICE_ID"];
beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
  delete process.env.APP_URL;
  stripeCalls.checkout.length = 0;
  stripeCalls.portal.length = 0;
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("appUrl: which web address the server trusts", () => {
  it("falls back to the live web app when APP_URL is missing or empty", () => {
    expect(appUrl()).toBe(DEFAULT_APP_URL);
    process.env.APP_URL = "";
    expect(appUrl()).toBe(DEFAULT_APP_URL);
    process.env.APP_URL = "   ";
    expect(appUrl()).toBe(DEFAULT_APP_URL);
  });

  it("uses APP_URL when it is a valid https address, reduced to scheme + host", () => {
    process.env.APP_URL = "https://app.dealer.example";
    expect(appUrl()).toBe("https://app.dealer.example");
    process.env.APP_URL = "https://app.dealer.example/some/path/?x=1#frag";
    expect(appUrl()).toBe("https://app.dealer.example");
    process.env.APP_URL = "  https://app.dealer.example:8443/  ";
    expect(appUrl()).toBe("https://app.dealer.example:8443");
  });

  it("rejects http for anything that is not localhost", () => {
    for (const bad of ["http://app.dealer.example", "http://evil.example:5173", "http://127.0.0.1:5173", "http://localhost.evil.example:5173"]) {
      process.env.APP_URL = bad;
      expect(appUrl(), bad).toBe(DEFAULT_APP_URL);
    }
  });

  it("accepts http://localhost:<port> only outside production, and only with a port", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_URL = "http://localhost:5173";
    expect(appUrl()).toBe("http://localhost:5173");
    process.env.APP_URL = "http://localhost";
    expect(appUrl()).toBe(DEFAULT_APP_URL);

    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://localhost:5173";
    expect(appUrl()).toBe(DEFAULT_APP_URL);
  });

  it("rejects garbage, other schemes and addresses with a login in them", () => {
    for (const bad of [
      "not a url",
      "evil.example",
      "//evil.example",
      "javascript:alert(1)",
      "ftp://app.dealer.example",
      "https://",
      "https://user:pass@app.dealer.example",
      "https://good.example@evil.example",
    ]) {
      process.env.APP_URL = bad;
      expect(appUrl(), bad).toBe(DEFAULT_APP_URL);
    }
  });

  it("appLink puts a path on the trusted address", () => {
    process.env.APP_URL = "https://app.dealer.example";
    expect(appLink("/billing?success=true")).toBe("https://app.dealer.example/billing?success=true");
    expect(appLink("billing")).toBe("https://app.dealer.example/billing");
  });
});

describe("billing: Stripe's return addresses come from the helper, not localhost", () => {
  async function ownerWithBilling() {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_PRICE_ID = "price_placeholder";
    delete process.env.STRIPE_PILOT_BRAIN_PRICE_ID;
    const owner = await signupOwner(app, "billing");
    const user = readCollection<{ id: string; dealershipId: string }>("users").find(u => u.id === owner.id)!;
    // The portal needs a Stripe customer on the dealership.
    writeCollection(
      "dealerships",
      readCollection<{ id: string }>("dealerships").map(d =>
        d.id === user.dealershipId ? { ...d, stripeCustomerId: "cus_placeholder" } : d
      )
    );
    return owner;
  }

  it("checkout success and cancel addresses use the default web app address", async () => {
    const owner = await ownerWithBilling();
    const res = await request(app)
      .post("/billing/create-checkout-session")
      .set("Authorization", `Bearer ${owner.token}`)
      .set("Origin", "https://evil.example")
      .send({});
    expect(res.status).toBe(200);
    expect(stripeCalls.checkout).toHaveLength(1);
    expect(stripeCalls.checkout[0]!.success_url).toBe(`${DEFAULT_APP_URL}/billing?success=true`);
    expect(stripeCalls.checkout[0]!.cancel_url).toBe(`${DEFAULT_APP_URL}/billing?canceled=true`);
  });

  it("and use APP_URL when it is set to a valid https address (portal return too)", async () => {
    const owner = await ownerWithBilling();
    process.env.APP_URL = "https://app.dealer.example";

    await request(app).post("/billing/create-checkout-session").set("Authorization", `Bearer ${owner.token}`).send({});
    await request(app).post("/billing/portal").set("Authorization", `Bearer ${owner.token}`).send({});

    expect(stripeCalls.checkout[0]!.success_url).toBe("https://app.dealer.example/billing?success=true");
    expect(stripeCalls.checkout[0]!.cancel_url).toBe("https://app.dealer.example/billing?canceled=true");
    expect(stripeCalls.portal).toHaveLength(1);
    expect(stripeCalls.portal[0]!.return_url).toBe("https://app.dealer.example/billing");
    for (const call of [...stripeCalls.checkout, ...stripeCalls.portal]) {
      expect(JSON.stringify(call)).not.toContain("localhost");
    }
  });
});
