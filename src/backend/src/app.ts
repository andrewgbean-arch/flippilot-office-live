import dotenv from "dotenv";
dotenv.config();

import express from "express";
import "./asyncErrors";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import registerInventoryRoute from "./routes/inventory";
import registerPhotosRoute from "./routes/photos";
import registerLeadsRoute from "./routes/leads";
import registerStaffRoute from "./routes/staff";
import registerBookkeepingRoute from "./routes/bookkeeping";
import registerJobsRoute from "./routes/jobs";
import registerTeamRoute from "./routes/team";
import registerStaffMessagesRoute from "./routes/staffMessages";
import registerTimekeepingRoute from "./routes/timekeeping";
import registerPlannerRoutes from "./routes/planner";
import registerNotificationsRoute from "./routes/notifications";
import registerFeedbackRoute from "./routes/feedback";
import registerConsumablesRoute from "./routes/consumables";
import registerContactsRoute from "./routes/contacts";
import registerCustomersRoute from "./routes/customers";
import registerEmailSettingsRoute from "./routes/emailSettings";
import registerPayRoute from "./routes/pay";
import registerDiaryRoute from "./routes/diary";
import registerAiListingRoute from "./routes/aiListing";
import registerPilotBrainRoute from "./routes/pilotBrain";
import registerMarketIntelligenceRoute from "./routes/marketIntelligence";
import registerOperatorRoute from "./routes/operator";
import registerCofounderRoute from "./routes/cofounder";
import registerDecisionsRoute from "./routes/decisions";
import registerSimulatorRoute from "./routes/simulator";
import registerDecisionAnalysisRoute from "./routes/decisionAnalysis";
import registerMarketCompsRoute from "./routes/marketComps";
import registerGooglePriceGuideRoute from "./routes/googlePriceGuide";
import registerPublicBookingRoute from "./routes/publicBooking";
import registerCarPassportRoute from "./routes/carPassport";
import registerAppointmentsRoute from "./routes/appointments";
import registerBookingSettingsRoute from "./routes/bookingSettings";
import registerDVLA from "./dvla";
import registerSyndicationRoute from "./routes/syndication";
import registerAuthRoute from "./routes/auth";
import registerDealershipRoute from "./routes/dealership";
import registerSupportRoute from "./routes/support";
import registerBillingRoute, { handleStripeWebhook } from "./routes/billing";
import { requireAuth } from "./auth";
import { redactSignedLinks } from "./photoStore";
import { requireApprovedDealership, requireActiveSubscription, requirePilotBrainAccess } from "./subscriptionGate";

// Express app setup, separated from server.ts's app.listen() call so
// integration tests can exercise the real app (supertest(app)) without
// binding to an actual port or needing the dev server running.
const app = express();

// Deployed on Render, every request arrives via Render's reverse proxy,
// so the address that actually opens the connection is the proxy's, not
// the visitor's. Left at Express's default (`false`), req.ip is that
// proxy address for everyone — and every rate limiter below and in
// routes/ keys on req.ip, so ALL users on the platform shared one
// bucket (10 logins per 15 minutes across every dealer combined, 20
// signups an hour platform-wide). express-rate-limit flagged it in
// Render's logs as ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
//
// The value is a hop count, deliberately not `true`: a client can send
// its own X-Forwarded-For and proxies append to it, so the leftmost
// entry (what `true` trusts) is client-controlled and would let anyone
// dodge a limit by rotating a fake value. Trusting exactly 1 hop means
// req.ip is the entry the proxy itself appended — the address it really
// saw connect — which a client can't forge. Too HIGH a count would walk
// back into client-supplied entries (the dangerous direction); too low
// only makes buckets coarser. If Render's chain is ever more than one
// proxy, raise this to match rather than guessing higher.
// (rateLimit.test.ts pins this behaviour.)
app.set("trust proxy", 1);

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
// A private photo's link carries its signature in the query string; without
// this the access log would hold a working link to every photo fetched in
// the last day. (Redefines the `url` token the "dev" format prints.)
morgan.token("url", req => redactSignedLinks((req as { originalUrl?: string }).originalUrl ?? req.url ?? ""));
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
if (!process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.CREDENTIAL_ENCRYPTION_KEY.length !== 64) {
  console.warn(
    '⚠️  CREDENTIAL_ENCRYPTION_KEY is missing or invalid — /email-settings (dealer-supplied SendGrid keys) will fail until this is set to a 64-character hex string in backend/.env. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "FlipPilot Office backend running",
    // Which deploy is live: Render sets RENDER_GIT_COMMIT on every deploy, so
    // this lets anyone confirm what is running. A commit id and nothing more.
    commit: (process.env.RENDER_GIT_COMMIT ?? "").slice(0, 7) || undefined,
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
// The real integration test suite creates far more than 20 real
// accounts/joins per run (tenant isolation, RBAC and planner tests all
// sign up their own throwaway dealerships) — that's real test traffic
// hitting the real route, not something to mock around, so the limit
// is raised only under NODE_ENV=test (Vitest's own default) rather
// than weakened for production.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 20,
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
// Deliberately registered here, not inside the requireActiveSubscription
// gate below — a dealer with an expired trial is exactly the kind of
// person who needs to be able to message support, not locked out of it.
registerSupportRoute(app);
registerBillingRoute(app);

// The dealer's actual business data — previously these had zero access
// control, so anyone who found the URL could read or overwrite
// inventory/leads/staff. requireAuth runs first (who are you), then
// requireActiveSubscription (is your dealership's trial/subscription
// still valid) — /dealership/me and /billing/* deliberately only need
// requireAuth, not the subscription gate, since a dealer with an
// expired trial still needs to see their status and subscribe.
app.use(
  [
    "/inventory",
    "/leads",
    "/staff",
    "/bookkeeping",
    "/dvla",
    "/jobs",
    "/team",
    "/staff-messages",
    "/message-photos",
    "/timekeeping",
    "/work-patterns",
    "/leave",
    "/rota-settings",
    "/shifts",
    "/notifications",
    "/feedback",
    "/consumables",
    "/appointments",
    "/booking-settings",
    "/contacts",
    "/customers",
    "/email-settings",
    "/pay",
    "/diary",
    "/ai",
    "/market",
    "/car-passports",
  ],
  requireAuth,
  requireApprovedDealership,
  requireActiveSubscription
);
// Pilot Brain gets its own extra gate on top of the base subscription
// check — it's a real, separately-priced premium add-on (see
// billing.ts), not just another feature of the core plan.
app.use(
  ["/pilot-brain"],
  requireAuth,
  requireApprovedDealership,
  requireActiveSubscription,
  requirePilotBrainAccess
);
registerInventoryRoute(app);
registerPhotosRoute(app);
registerLeadsRoute(app);
registerStaffRoute(app);
registerBookkeepingRoute(app);
registerJobsRoute(app);
registerTeamRoute(app);
registerStaffMessagesRoute(app);
registerTimekeepingRoute(app);
registerPlannerRoutes(app);
registerNotificationsRoute(app);
registerFeedbackRoute(app);
registerConsumablesRoute(app);
registerContactsRoute(app);
registerCustomersRoute(app);
registerEmailSettingsRoute(app);
registerPayRoute(app);
registerDiaryRoute(app);
registerAiListingRoute(app);
registerPilotBrainRoute(app);
registerMarketIntelligenceRoute(app);
registerOperatorRoute(app);
registerCofounderRoute(app);
registerDecisionsRoute(app);
registerSimulatorRoute(app);
registerDecisionAnalysisRoute(app);
registerMarketCompsRoute(app);
registerGooglePriceGuideRoute(app);
registerAppointmentsRoute(app);
registerBookingSettingsRoute(app);
// Deliberately OUTSIDE the requireAuth gate above — this is the one
// part of the app a stranger on the internet reaches with no account
// at all (a customer booking a viewing/test drive). Rate-limited
// inside the route file itself since the risk here is abuse volume,
// not identity.
registerPublicBookingRoute(app);
// The Car Passport: dealer settings (behind the login gate above, via
// "/car-passports") and the public page a buyer opens (no login, rate-limited
// inside the route file, and it only ever answers for a car the dealer chose
// to publish).
registerCarPassportRoute(app);
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

// The last stop for anything a route throws or rejects (asyncErrors.ts makes a
// rejected async handler arrive here instead of killing the process). Answer in JSON
// and keep serving. An error that carries its own 4xx status (a malformed or oversized
// JSON body, say) keeps that status; anything else is a 500 that never shows internals.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number((err as { status?: unknown } | null)?.status ?? (err as { statusCode?: unknown } | null)?.statusCode);
  const clientError = Number.isInteger(status) && status >= 400 && status < 500;
  if (!clientError) console.error("Unhandled error in a request:", err);
  if (res.headersSent) return;
  res.status(clientError ? status : 500).json({
    ok: false,
    error: clientError ? "That request could not be read." : "Something went wrong on our side. Please try again.",
  });
});

export default app;
