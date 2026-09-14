import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import registerIntelligenceV3 from "./routes/intelligenceV3";
import registerSearchRoute from "./routes/search";
import registerLookupRoute from "./routes/lookup";
import registerInventoryRoute from "./routes/inventory";
import registerIntelligenceRoute from "./routes/intelligence";
import registerLeadsRoute from "./routes/leads";
import registerStaffRoute from "./routes/staff";
import registerBookkeepingRoute from "./routes/bookkeeping";
import registerDVLA from "./dvla";
import registerSyndicationRoute from "./routes/syndication";
import registerAuthRoute from "./routes/auth";
import registerDealershipRoute from "./routes/dealership";
import registerBillingRoute, { handleStripeWebhook } from "./routes/billing";
import { requireAuth } from "./auth";
import { requireActiveSubscription } from "./subscriptionGate";

// Express app setup, separated from server.ts's app.listen() call so
// integration tests can exercise the real app (supertest(app)) without
// binding to an actual port or needing the dev server running.
const app = express();

app.use(cors());

// Stripe needs the RAW request body to verify its webhook signature, so
// this has to be registered before the global express.json() below —
// once that runs, the body is already parsed into an object and the
// raw bytes Stripe signed are gone.
app.post(
  "/billing/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(express.json({ limit: "10mb" }));
app.use(helmet());
app.use(morgan("dev"));

const missingStripeEnv = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"].filter(
  key => !process.env[key]
);
if (missingStripeEnv.length > 0) {
  console.warn(
    `⚠️  Missing environment variable(s): ${missingStripeEnv.join(", ")} — billing (checkout/portal) will fail until these are set in backend/.env. Trials still work without them.`
  );
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn(
    "⚠️  STRIPE_WEBHOOK_SECRET is not set — /billing/webhook will reject events until this is set (needed to actually mark a dealership as subscribed after checkout)."
  );
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "FlipPilot Office backend running",
    timestamp: new Date().toISOString()
  });
});

// No brute-force protection existed on login at all before this — an
// attacker could try passwords as fast as the network allowed. 10
// attempts per 15 minutes per IP is generous for a real user (who
// mistypes a password a handful of times, not dozens) but blocks
// automated guessing. Signup gets a looser limit — it's not a guessing
// target the same way, just worth capping against account-creation spam.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many login attempts — try again in 15 minutes." },
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many signup attempts — try again later." },
});
app.use("/auth/login", loginLimiter);
app.use("/auth/signup", signupLimiter);
app.use("/auth/join", signupLimiter);
app.use("/auth/forgot-password", loginLimiter);

registerAuthRoute(app);
registerDealershipRoute(app);
registerBillingRoute(app);

registerSearchRoute(app);
registerLookupRoute(app);
registerIntelligenceRoute(app);
registerIntelligenceV3(app);

// The dealer's actual business data — previously these had zero access
// control, so anyone who found the URL could read or overwrite
// inventory/leads/staff. requireAuth runs first (who are you), then
// requireActiveSubscription (is your dealership's trial/subscription
// still valid) — /dealership/me and /billing/* deliberately only need
// requireAuth, not the subscription gate, since a dealer with an
// expired trial still needs to see their status and subscribe.
app.use(["/inventory", "/leads", "/staff", "/bookkeeping", "/dvla"], requireAuth, requireActiveSubscription);
registerInventoryRoute(app);
registerLeadsRoute(app);
registerStaffRoute(app);
registerBookkeepingRoute(app);
// Real DVSA MOT History + DVLA Vehicle Enquiry Service integration
// (ported from the sibling flippilotlatest backend's proven pattern) —
// previously called a placeholder domain that was never a real provider.
// /dvla was missing from the auth gate above until a security review
// caught it: real DVSA/DVLA credentials, with real usage limits, were
// reachable by anyone on the internet with no login at all — every
// call spent the business's own API quota for free, with nothing
// stopping it being scraped at scale.
registerDVLA(app);
registerSyndicationRoute(app);

export default app;
