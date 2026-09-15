import { Express, Request, Response } from "express";
import Stripe from "stripe";
import { readCollection, writeCollection } from "../db";
import { requireAuth, requireOwner, type AuthUser, type Dealership } from "../auth";

const FRONTEND_URL = "http://localhost:5173";

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
      if (dealershipId) {
        updateDealership(dealershipId, {
          subscriptionStatus: "active",
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: String(session.subscription),
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
        updateDealership(dealership.id, { subscriptionStatus: status });
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
  app.post("/billing/create-checkout-session", requireAuth, requireOwner, async (req, res) => {
    try {
      const user = (req as Request & { user: AuthUser }).user;
      const dealership = findDealership(user.dealershipId);
      if (!dealership) {
        return res.status(404).json({ ok: false, error: "Dealership not found" });
      }

      const session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: getPriceId(), quantity: 1 }],
        ...(dealership.stripeCustomerId
          ? { customer: dealership.stripeCustomerId }
          : { customer_email: user.email }),
        metadata: { dealershipId: dealership.id },
        subscription_data: { metadata: { dealershipId: dealership.id } },
        success_url: `${FRONTEND_URL}/billing?success=true`,
        cancel_url: `${FRONTEND_URL}/billing?canceled=true`,
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
        return_url: `${FRONTEND_URL}/billing`,
      });

      res.json({ ok: true, url: session.url });
    } catch (err: any) {
      console.error("billing/portal failed:", err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}
