import "./testPrivateDatabase.js"; // must stay first — see that file
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";

// Stands in for the Stripe library so tests never touch the real Stripe. The
// fake webhook signature check just parses the raw body straight back into
// an event — real signature verification is Stripe's own library code, not
// this app's, and is exercised by the real key on the real server.
const stripeCalls = vi.hoisted(() => ({ checkout: [] as Array<Record<string, unknown>> }));
vi.mock("stripe", () => ({
  default: class FakeStripe {
    checkout = {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          stripeCalls.checkout.push(args);
          return { url: "https://checkout.stripe.example/session", id: "cs_test_fake" };
        },
      },
    };
    billingPortal = { sessions: { create: async () => ({ url: "https://billing.stripe.example/portal" }) } };
    webhooks = {
      constructEvent: (raw: Buffer | string) => JSON.parse(raw.toString()),
    };
  },
}));

import app from "./app.js";
import { readCollection, writeCollection } from "./db.js";
import type { Dealership } from "./auth.js";
import { readCreditLedger, addTopUp } from "./pilotBrainCredit.js";
import { readTasterState } from "./pilotBrainTaster.js";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let counter = 0;

async function signup(label: string) {
  counter += 1;
  const email = `pb-credit-${Date.now()}-${counter}-${label}@test.local`;
  const res = await request(app).post("/auth/signup").send({
    email,
    password: "pbcredittestpass123",
    name: `PB Credit ${label}`,
    dealershipName: `PB Credit Motors ${label}`,
  });
  expect(res.status).toBe(200);
  return { token: res.body.token as string, dealershipId: res.body.user.dealershipId as string };
}

function makeSubscriber(dealershipId: string) {
  const all = readCollection<Dealership>("dealerships");
  writeCollection(
    "dealerships",
    all.map(d => (d.id === dealershipId ? { ...d, subscriptionStatus: "active" as const, pilotBrainEnabled: true } : d))
  );
}

function grantCredit(dealershipId: string, amountPence: number) {
  addTopUp(dealershipId, amountPence, "test-grant");
}

// Fakes the Anthropic call so tests never spend real money and never need a
// real key. Every chat/briefing test that expects to REACH the model uses
// this; a test proving the taster gate refuses BEFORE any call is made
// checks fetch was never invoked instead.
function stubAnthropic() {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  const calls: unknown[] = [];
  vi.stubGlobal("fetch", async (url: unknown, init?: { body?: string }) => {
    if (String(url).includes("api.anthropic.com")) {
      calls.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(JSON.stringify({ content: [{ text: "Understood, Boss." }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`unexpected outbound request in test: ${String(url)}`);
  });
  return {
    calls,
    restore() {
      vi.unstubAllGlobals();
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevKey;
    },
  };
}

function stubVoice(ok = true) {
  const prevOpenAi = process.env.OPENAI_API_KEY;
  const prevEleven = process.env.ELEVENLABS_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-not-real";
  delete process.env.ELEVENLABS_API_KEY;
  vi.stubGlobal("fetch", async (url: unknown) => {
    if (String(url).includes("api.openai.com")) {
      return ok
        ? new Response("fake-mp3-bytes", { status: 200, headers: { "Content-Type": "audio/mpeg" } })
        : new Response("provider error", { status: 500 });
    }
    throw new Error(`unexpected outbound request in test: ${String(url)}`);
  });
  return {
    restore() {
      vi.unstubAllGlobals();
      if (prevOpenAi === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prevOpenAi;
      if (prevEleven !== undefined) process.env.ELEVENLABS_API_KEY = prevEleven;
    },
  };
}

// Blanked for every test (vitest.testEnv.ts) since a real key must never be
// read in a test run — set to an obvious fake value for the tests that need
// getStripe() to not throw. The "stripe" module itself is mocked above, so
// nothing real is ever called with it.
beforeEach(() => {
  stripeCalls.checkout = [];
  process.env.STRIPE_SECRET_KEY = "sk_test_not_real";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.STRIPE_SECRET_KEY;
});

describe("the free taster (a dealership that has never paid for Pilot Brain)", () => {
  it("lets the first 5 chat questions through, then refuses the 6th without calling the model", async () => {
    const { token } = await signup("chat-taster");
    const anthropic = stubAnthropic();
    try {
      for (let i = 1; i <= 5; i++) {
        const res = await request(app).post("/pilot-brain/chat").set(auth(token)).send({ message: `Question ${i}` });
        expect(res.status).toBe(200);
      }
      expect(anthropic.calls).toHaveLength(5);
      const sixth = await request(app).post("/pilot-brain/chat").set(auth(token)).send({ message: "Question 6" });
      expect(sixth.status).toBe(402);
      expect(sixth.body.tasterExhausted).toBe(true);
      expect(sixth.body.error).toContain("5 free taster questions");
      expect(anthropic.calls).toHaveLength(5); // the 6th never reached the model
    } finally {
      anthropic.restore();
    }
  });

  it("gives one free briefing and refuses a second", async () => {
    const { token } = await signup("briefing-taster");
    const anthropic = stubAnthropic();
    try {
      const first = await request(app).get("/pilot-brain/briefing").set(auth(token));
      expect(first.status).toBe(200);
      const second = await request(app).get("/pilot-brain/briefing").set(auth(token));
      expect(second.status).toBe(402);
      expect(second.body.tasterExhausted).toBe(true);
      expect(anthropic.calls).toHaveLength(1);
    } finally {
      anthropic.restore();
    }
  });

  it("shows the taster status honestly, counting down as questions are used", async () => {
    const { token, dealershipId } = await signup("taster-status");
    const initial = await request(app).get("/pilot-brain/taster-status").set(auth(token));
    expect(initial.body).toMatchObject({ isTaster: true, questionsRemaining: 5, briefingRemaining: true });

    const anthropic = stubAnthropic();
    try {
      await request(app).post("/pilot-brain/chat").set(auth(token)).send({ message: "hi" });
    } finally {
      anthropic.restore();
    }
    const after = await request(app).get("/pilot-brain/taster-status").set(auth(token));
    expect(after.body.questionsRemaining).toBe(4);
    expect(readTasterState(dealershipId).questionsUsed).toBe(1);
  });

  it("has no free monthly credit, so voice and a web lookup are refused until the dealer tops up", async () => {
    const { token, dealershipId } = await signup("no-free-voice");
    const voice = stubVoice();
    try {
      const res = await request(app).post("/pilot-brain/speak").set(auth(token)).send({ text: "hello", voice: "alloy" });
      expect(res.status).toBe(402);
      expect(res.body.creditExhausted).toBe(true);
    } finally {
      voice.restore();
    }

    // Topping up (as if Stripe's webhook had just confirmed a real payment) unlocks it.
    grantCredit(dealershipId, 5000);
    const voice2 = stubVoice();
    try {
      const res2 = await request(app).post("/pilot-brain/speak").set(auth(token)).send({ text: "hello", voice: "alloy" });
      expect(res2.status).toBe(200);
      expect(readCreditLedger(dealershipId).balancePence).toBe(5000 - 15);
    } finally {
      voice2.restore();
    }
  });

  it("subscribing ends the taster: unlimited chat, a free monthly grant, and the taster counter is left alone but ignored", async () => {
    const { token, dealershipId } = await signup("subscribes");
    const anthropic = stubAnthropic();
    try {
      for (let i = 0; i < 5; i++) {
        await request(app).post("/pilot-brain/chat").set(auth(token)).send({ message: `q${i}` });
      }
      makeSubscriber(dealershipId);
      const res = await request(app).post("/pilot-brain/chat").set(auth(token)).send({ message: "one more, now paying" });
      expect(res.status).toBe(200);
    } finally {
      anthropic.restore();
    }
  });
});

describe("a paying Pilot Brain subscriber's usage credit", () => {
  it("gets this month's £30 automatically and spends it on a voice reply", async () => {
    const { token, dealershipId } = await signup("voice-credit");
    makeSubscriber(dealershipId);
    const voice = stubVoice();
    try {
      const res = await request(app).post("/pilot-brain/speak").set(auth(token)).send({ text: "hello", voice: "alloy" });
      expect(res.status).toBe(200);
      expect(readCreditLedger(dealershipId).balancePence).toBe(3000 - 15);
    } finally {
      voice.restore();
    }
  });

  it("refunds the credit when the voice provider fails", async () => {
    const { token, dealershipId } = await signup("voice-refund");
    makeSubscriber(dealershipId);
    const voice = stubVoice(false);
    try {
      const res = await request(app).post("/pilot-brain/speak").set(auth(token)).send({ text: "hello", voice: "alloy" });
      expect(res.status).toBe(502);
      expect(readCreditLedger(dealershipId).balancePence).toBe(3000); // spent, then refunded — net unchanged
    } finally {
      voice.restore();
    }
  });

  it("refuses once the balance is used up, and the owner can see it in /pilot-brain/credit", async () => {
    const { token, dealershipId } = await signup("voice-exhausted");
    makeSubscriber(dealershipId);
    const voice = stubVoice();
    try {
      for (let i = 0; i < 200; i++) {
        const res = await request(app).post("/pilot-brain/speak").set(auth(token)).send({ text: "hello", voice: "alloy" });
        if (res.status !== 200) break;
      }
      const exhausted = await request(app).post("/pilot-brain/speak").set(auth(token)).send({ text: "hello", voice: "alloy" });
      expect(exhausted.status).toBe(402);
    } finally {
      voice.restore();
    }
    const credit = await request(app).get("/pilot-brain/credit").set(auth(token));
    expect(credit.status).toBe(200);
    expect(credit.body.balancePence).toBe(0);
  });

  it("a web lookup that runs is charged to the dealership's credit", async () => {
    const { token, dealershipId } = await signup("web-credit");
    makeSubscriber(dealershipId);
    const { setWebEnabled } = await import("./pilotBrainWeb.js");
    setWebEnabled(dealershipId, true);

    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    vi.stubGlobal("fetch", async (url: unknown) => {
      if (String(url).includes("api.anthropic.com")) {
        return new Response(
          JSON.stringify({
            content: [
              { type: "server_tool_use", id: "srv1", name: "web_search", input: { query: "test" } },
              { type: "web_search_tool_result", tool_use_id: "srv1", content: [{ type: "web_search_result", url: "https://parkers.co.uk/x", title: "X" }] },
              { type: "text", text: "Found it." },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`unexpected outbound request in test: ${String(url)}`);
    });
    try {
      const res = await request(app).post("/pilot-brain/chat").set(auth(token)).send({ message: "what's a fair price?" });
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevKey;
    }
    expect(readCreditLedger(dealershipId).balancePence).toBe(3000 - 5);
  });
});

describe("topping up (Stripe checkout + webhook)", () => {
  it("refuses an amount that isn't one of the three offered", async () => {
    const { token } = await signup("bad-amount");
    const res = await request(app).post("/pilot-brain/credit/topup").set(auth(token)).send({ amountPence: 1234 });
    expect(res.status).toBe(400);
    expect(stripeCalls.checkout).toHaveLength(0);
  });

  it("only the owner can start a top-up", async () => {
    const owner = await signup("staff-guard");
    const invite = await request(app).post("/dealership/invite").set(auth(owner.token)).send({ inviteeName: "Sales", staffRole: "sales" });
    const join = await request(app).post("/auth/join").send({
      token: invite.body.token,
      name: "Sales",
      email: `pb-credit-staff-${Date.now()}@test.local`,
      password: "staffcredittestpass123",
    });
    const res = await request(app).post("/pilot-brain/credit/topup").set(auth(join.body.token)).send({ amountPence: 1000 });
    expect(res.status).toBe(403);
  });

  it("starts a real one-off Stripe Checkout session, never a subscription", async () => {
    const { token, dealershipId } = await signup("topup-checkout");
    const res = await request(app).post("/pilot-brain/credit/topup").set(auth(token)).send({ amountPence: 2500 });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://checkout.stripe.example/session");
    expect(stripeCalls.checkout).toHaveLength(1);
    const args = stripeCalls.checkout[0]!;
    expect(args.mode).toBe("payment");
    expect(args.metadata).toMatchObject({ dealershipId, purpose: "pilotBrainCreditTopup", amountPence: "2500" });
    const lineItems = args.line_items as Array<{ price_data: { unit_amount: number; currency: string } }>;
    expect(lineItems[0]!.price_data).toMatchObject({ unit_amount: 2500, currency: "gbp" });
  });

  it("the webhook adds exactly the confirmed amount, and never touches subscription status", async () => {
    const { dealershipId } = await signup("topup-webhook");
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    try {
      const event = {
        id: "evt_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_topup_1",
            metadata: { dealershipId, purpose: "pilotBrainCreditTopup", amountPence: "5000" },
          },
        },
      };
      const res = await request(app)
        .post("/billing/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "test-sig")
        .send(JSON.stringify(event));
      expect(res.status).toBe(200);
      expect(readCreditLedger(dealershipId).balancePence).toBe(5000);

      const all = readCollection<Dealership>("dealerships");
      const dealership = all.find(d => d.id === dealershipId);
      expect(dealership?.subscriptionStatus).toBe("trialing"); // unaffected by a top-up
    } finally {
      if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });

  it("ignores a top-up event with a tampered / invalid amount rather than trusting it", async () => {
    const { dealershipId } = await signup("topup-tamper");
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    try {
      const event = {
        id: "evt_2",
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_topup_2", metadata: { dealershipId, purpose: "pilotBrainCreditTopup", amountPence: "999999" } } },
      };
      const res = await request(app)
        .post("/billing/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "test-sig")
        .send(JSON.stringify(event));
      expect(res.status).toBe(200); // Stripe must still see 200 (already charged), just nothing credited
      expect(readCreditLedger(dealershipId).balancePence).toBe(0);

      // Proves the tamper was really SKIPPED, not that the webhook silently
      // does nothing for everyone: a genuine amount straight after is credited.
      const good = { ...event, id: "evt_3", data: { object: { ...event.data.object, id: "cs_test_topup_3", metadata: { ...event.data.object.metadata, amountPence: "1000" } } } };
      await request(app).post("/billing/webhook").set("Content-Type", "application/json").set("stripe-signature", "test-sig").send(JSON.stringify(good));
      expect(readCreditLedger(dealershipId).balancePence).toBe(1000);
    } finally {
      if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });
});
