import { Express, Request, Response } from "express";
import Stripe from "stripe";
import { readCollection, writeCollection } from "../db";
import { requireAuth, requireOwner, type AuthUser, type Dealership } from "../auth";
import { appLink } from "../appUrl";


// Read at call time, not module load — same dotenv-ordering reasoning
// as getJwtSecret() in auth.ts.
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set in backend/.env");
  }
  return new Stripe(key);
}

function getPriceId(): string {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id) {
    throw new Error("STRIPE_PRICE_ID is not set in backend/.env");
  }
  return id;
}

// The Pilot Brain premium add-on — a separate real Stripe Price,
// optional at checkout. Genuinely optional, not required: unset simply
// means the add-on can't be purchased yet, not a hard error, since the
// core product must keep working before this exists.
function getPilotBrainPriceId(): string | undefined {
  return process.env.STRIPE_PILOT_BRAIN_PRICE_ID || undefined;
}

// Real, current truth about whether this subscription includes the
// Pilot Brain add-on — checked against its actual line items every
// time, never assumed from what was originally purchased.
function subscriptionHasPilotBrain(subscription: Stripe.Subscription): boolean {
  const pilotBrainPriceId = getPilotBrainPriceId();
  if (!pilotBrainPriceId) return false;
  return subscription.items.data.some(item => item.price.id === pilotBrainPriceId);
}

function findDealership(id: string): Dealership | undefined {
  return readCollection<Dealership>("dealerships").find(d => d.id === id);
}

function updateDealership(id: string, patch: Partial<Dealership>) {
  const dealerships = readCollection<Dealership>("dealerships");
  const updated = dealerships.map(d => (d.id === id ? { ...d, ...patch } : d));
  writeCollection("dealerships", updated);
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

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
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
      if (dealershipId && session.subscription) {
        // Real subscription items, not checkout-time intent — a dealer
        // could in theory have their checkout line items differ from
        // what actually lands on the subscription, so this is derived
        // from Stripe's own subscription record, not assumed.
        const subscription = await getStripe().subscriptions.retrieve(String(session.subscription));
        updateDealership(dealershipId, {
          subscriptionStatus: "active",
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: subscription.id,
          pilotBrainEnabled: subscriptionHasPilotBrain(subscription),
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
        // Re-derived on every update, not just at checkout — this is
        // what makes adding/removing the add-on later via the real
        // Stripe billing portal actually take effect here too.
        updateDealership(dealership.id, {
          subscriptionStatus: status,
          pilotBrainEnabled: subscriptionHasPilotBrain(subscription),
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
  // must not be able to cancel the subscription or reach the real
  // Stripe billing portal for the dealership's card details.
  // What can actually be bought right now, so the Billing screen only offers
  // Pilot Brain when checkout would really include it (its Stripe price is set).
  app.get("/billing/options", requireAuth, requireOwner, (_req, res) => {
    res.json({ ok: true, pilotBrainAvailable: Boolean(getPilotBrainPriceId()) });
  });

  app.post("/billing/create-checkout-session", requireAuth, requireOwner, async (req, res) => {
    try {
      const user = (req as Request & { user: AuthUser }).user;
      const dealership = findDealership(user.dealershipId);
      if (!dealership) {
        return res.status(404).json({ ok: false, error: "Dealership not found" });
      }

      // Pilot Brain is opt-in at checkout — only added as a real line
      // item when explicitly requested and only when a real price for
      // it has actually been configured, so an unset env var can never
      // silently charge for something that doesn't exist yet.
      const includePilotBrain = Boolean(req.body?.includePilotBrain) && Boolean(getPilotBrainPriceId());
      const lineItems = [{ price: getPriceId(), quantity: 1 }];
      if (includePilotBrain) {
        lineItems.push({ price: getPilotBrainPriceId()!, quantity: 1 });
      }

      const session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: lineItems,
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
