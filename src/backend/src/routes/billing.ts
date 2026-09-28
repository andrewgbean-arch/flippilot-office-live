import { Express, Request, Response } from "express";
import Stripe from "stripe";
import { readCollection, writeCollection } from "../db";
import { requireAuth, requireOwner, type AuthUser, type Dealership } from "../auth";
import { appLink } from "../appUrl";
import { addTopUp, isValidTopUpAmount, TOPUP_AMOUNTS_PENCE } from "../pilotBrainCredit";

// Read at call time, not module load — same dotenv-ordering reasoning
// as getJwtSecret() in auth.ts.
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set in backend/.env");
  }
  return new Stripe(key);
}

// The two real plans (decided 2026-09-21): "Dealer OS" and "Dealer OS +
// Pilot Brain". Each has its own settling-in price for its first 6 months,
// then steps up to its own standard price — not a shared core price with
// Pilot Brain bolted on as an optional extra (249 is not 99 + a top-up; it
// is its own number). Checkout can only start a subscription at ONE flat
// price, so every plan starts on its settling price, and the step-up to
// the standard price is set up as a Stripe Subscription Schedule right
// after the subscription is created (see scheduleStepUp below) — Checkout
// itself has no concept of a schedule.
export type PlanId = "core" | "core_pilot_brain";
const PLAN_IDS: readonly PlanId[] = ["core", "core_pilot_brain"];
const SETTLING_MONTHS = 6;

interface PlanPriceIds {
  settling: string;
  standard: string;
}

function envPriceIds(settlingVar: string, standardVar: string): PlanPriceIds | null {
  const settling = process.env[settlingVar];
  const standard = process.env[standardVar];
  return settling && standard ? { settling, standard } : null;
}

// Undefined until the owner has created both real Stripe Prices for a plan
// and set both env vars — a plan with only one of the two set is treated as
// not offered at all, since starting someone on a settling price with no
// standard price to step up to would leave them on the cheap price forever
// by accident.
function priceIdsFor(plan: PlanId): PlanPriceIds | null {
  return plan === "core"
    ? envPriceIds("STRIPE_CORE_SETTLING_PRICE_ID", "STRIPE_CORE_STANDARD_PRICE_ID")
    : envPriceIds("STRIPE_PILOT_BRAIN_SETTLING_PRICE_ID", "STRIPE_PILOT_BRAIN_STANDARD_PRICE_ID");
}

// Real, current truth about which plan a subscription is on — checked
// against its actual first line item's price every time (never assumed
// from checkout intent, so it stays right if the dealer changes plan later
// via the billing portal), and matches EITHER a plan's settling or its
// standard price, since which one applies depends on where the schedule
// has got to.
function planOfSubscription(subscription: Stripe.Subscription): PlanId | null {
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) return null;
  for (const plan of PLAN_IDS) {
    const ids = priceIdsFor(plan);
    if (ids && (priceId === ids.settling || priceId === ids.standard)) return plan;
  }
  return null;
}

function findDealership(id: string): Dealership | undefined {
  return readCollection<Dealership>("dealerships").find(d => d.id === id);
}

function updateDealership(id: string, patch: Partial<Dealership>) {
  const dealerships = readCollection<Dealership>("dealerships");
  const updated = dealerships.map(d => (d.id === id ? { ...d, ...patch } : d));
  writeCollection("dealerships", updated);
}

// Turns a plain subscription (however Checkout just created it, on the
// plan's settling price) into a two-phase schedule: the settling price for
// its first 6 months, then the standard price for as long as the
// subscription keeps running. end_behavior "release" hands the
// subscription back to renewing normally once the schedule's phases are
// done, rather than the schedule going on managing it forever — there is
// nothing after the standard-price phase for it to do.
async function scheduleStepUp(stripe: Stripe, subscriptionId: string, plan: PlanId): Promise<string | null> {
  const ids = priceIdsFor(plan);
  if (!ids) return null;
  const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });
  const updated = await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      { items: [{ price: ids.settling, quantity: 1 }], duration: { interval: "month", interval_count: SETTLING_MONTHS } },
      { items: [{ price: ids.standard, quantity: 1 }] },
    ],
  });
  return updated.id;
}

// Stripe requires the RAW request body (not JSON-parsed) to verify the
// webhook signature, which is why this handler is wired up in
// server.ts *before* the global express.json() middleware, unlike
// every other route in this backend.
export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).send("Missing Stripe signature or webhook secret");
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const dealershipId = session.metadata?.dealershipId;

      // A one-off usage-credit top-up (see /pilot-brain/credit/topup below) —
      // never a subscription, so it must be told apart before the
      // subscription branch below, which would otherwise ignore it (no
      // session.subscription) and do nothing at all.
      if (dealershipId && session.metadata?.purpose === "pilotBrainCreditTopup") {
        const amountPence = Number(session.metadata?.amountPence);
        if (isValidTopUpAmount(amountPence)) {
          addTopUp(dealershipId, amountPence, session.id);
        } else {
          console.error("billing webhook: top-up session had no valid amountPence", session.id);
        }
        break;
      }

      if (dealershipId && session.subscription) {
        // Real subscription items, not checkout-time intent — a dealer
        // could in theory have their checkout line items differ from
        // what actually lands on the subscription, so this is derived
        // from Stripe's own subscription record, not assumed.
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        const plan = planOfSubscription(subscription);

        let scheduleId: string | undefined;
        if (plan) {
          try {
            scheduleId = (await scheduleStepUp(stripe, subscription.id, plan)) ?? undefined;
          } catch (err) {
            // The subscription itself is real and already active — a
            // schedule failure here must never be mistaken for the
            // checkout itself failing. Logged loudly rather than silently
            // leaving the dealer on the settling price forever; this needs
            // fixing by hand (retry scheduleStepUp for this subscription)
            // until there's an automatic retry for it.
            console.error("billing webhook: could not schedule the price step-up for", dealershipId, err);
          }
        }

        updateDealership(dealershipId, {
          subscriptionStatus: "active",
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: subscription.id,
          pilotBrainEnabled: plan === "core_pilot_brain",
          subscribedAt: new Date().toISOString(),
          ...(scheduleId ? { stripeScheduleId: scheduleId } : {}),
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const dealerships = readCollection<Dealership>("dealerships");
      const dealership = dealerships.find(
        d => d.stripeSubscriptionId === subscription.id
      );
      if (dealership) {
        const status =
          subscription.status === "active"
            ? "active"
            : subscription.status === "past_due"
            ? "past_due"
            : "canceled";
        // Re-derived on every update, not just at checkout — this is what
        // makes the price step-up ITSELF (the schedule updating the
        // subscription's item at month 6) and a dealer changing plan later
        // via the billing portal both actually take effect here too.
        // subscribedAt is deliberately left alone: this fires again for the
        // very step-up this file set up, and that is not a new
        // subscription starting.
        updateDealership(dealership.id, {
          subscriptionStatus: status,
          pilotBrainEnabled: planOfSubscription(subscription) === "core_pilot_brain",
        });
      }
      break;
    }
  }

  res.json({ received: true });
}

export default function registerBillingRoute(app: Express) {
  // Subscription/payment control is more sensitive than the dealership
  // profile edits and team invites elsewhere in this app that already
  // require the owner role — a plain staff account (sales/general/etc)
  // must not be able to start a subscription or reach the real Stripe
  // billing portal for the dealership's card details.
  // Which plans can really be bought right now, so the Billing screen only
  // offers a plan when checkout would really work (both its real Stripe
  // Prices are configured).
  app.get("/billing/options", requireAuth, requireOwner, (req, res) => {
    // subscribedAt is answered here, owner-only, rather than added to
    // /dealership/me's teammate whitelist — a billing date is exactly the
    // kind of thing "billing identifiers no teammate has any use for"
    // (see dealership.ts's own comment) already keeps off that list.
    const user = (req as Request & { user: AuthUser }).user;
    const dealership = findDealership(user.dealershipId);
    res.json({
      ok: true,
      plans: {
        core: priceIdsFor("core") !== null,
        core_pilot_brain: priceIdsFor("core_pilot_brain") !== null,
      },
      settlingMonths: SETTLING_MONTHS,
      subscribedAt: dealership?.subscribedAt ?? null,
    });
  });

  app.post("/billing/create-checkout-session", requireAuth, requireOwner, async (req, res) => {
    try {
      const user = (req as Request & { user: AuthUser }).user;
      const dealership = findDealership(user.dealershipId);
      if (!dealership) {
        return res.status(404).json({ ok: false, error: "Dealership not found" });
      }

      const plan: PlanId = req.body?.plan === "core_pilot_brain" ? "core_pilot_brain" : "core";
      const ids = priceIdsFor(plan);
      if (!ids) {
        return res.status(400).json({ ok: false, error: "That plan isn't set up yet — contact support." });
      }

      const session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: ids.settling, quantity: 1 }],
        ...(dealership.stripeCustomerId
          ? { customer: dealership.stripeCustomerId }
          : { customer_email: user.email }),
        metadata: { dealershipId: dealership.id },
        subscription_data: { metadata: { dealershipId: dealership.id } },
        success_url: appLink("/billing?success=true"),
        cancel_url: appLink("/billing?canceled=true"),
      });

      res.json({ ok: true, url: session.url });
    } catch (err: any) {
      console.error("create-checkout-session failed:", err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // A one-off top-up of Pilot Brain's usage credit (web lookups + voice) —
  // a real card charge, not a subscription, so its own Checkout mode
  // ("payment") and its own branch in the webhook above. No Stripe Price
  // needs configuring for this: the amount is built inline from the
  // dealer's choice, restricted to the three amounts actually offered.
  app.post("/pilot-brain/credit/topup", requireAuth, requireOwner, async (req, res) => {
    try {
      const amountPence = Number(req.body?.amountPence);
      if (!isValidTopUpAmount(amountPence)) {
        return res.status(400).json({ ok: false, error: `Choose one of: ${TOPUP_AMOUNTS_PENCE.map(p => `£${p / 100}`).join(", ")}` });
      }
      const user = (req as Request & { user: AuthUser }).user;
      const dealership = findDealership(user.dealershipId);
      if (!dealership) {
        return res.status(404).json({ ok: false, error: "Dealership not found" });
      }

      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: amountPence,
              product_data: { name: "FlipPilot Pilot Brain usage credit top-up" },
            },
            quantity: 1,
          },
        ],
        ...(dealership.stripeCustomerId ? { customer: dealership.stripeCustomerId } : { customer_email: user.email }),
        metadata: { dealershipId: dealership.id, purpose: "pilotBrainCreditTopup", amountPence: String(amountPence) },
        success_url: appLink("/billing?topupSuccess=true"),
        cancel_url: appLink("/billing?topupCanceled=true"),
      });

      res.json({ ok: true, url: session.url });
    } catch (err: any) {
      console.error("pilot-brain/credit/topup failed:", err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post("/billing/portal", requireAuth, requireOwner, async (req, res) => {
    try {
      const user = (req as Request & { user: AuthUser }).user;
      const dealership = findDealership(user.dealershipId);
      if (!dealership?.stripeCustomerId) {
        return res
          .status(400)
          .json({ ok: false, error: "No billing account yet — subscribe first" });
      }

      const session = await getStripe().billingPortal.sessions.create({
        customer: dealership.stripeCustomerId,
        return_url: appLink("/billing"),
      });

      res.json({ ok: true, url: session.url });
    } catch (err: any) {
      console.error("billing/portal failed:", err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}
