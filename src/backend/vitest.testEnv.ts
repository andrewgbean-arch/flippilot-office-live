import os from "node:os";
import path from "node:path";

// The backend tests exercise the REAL database layer: they sign up throwaway
// dealerships through the real flow and delete them again afterwards. Left to
// itself db.ts falls back to src/backend/data (the developer's own dev
// database) and app.ts loads the real .env — so a plain `vitest run` used to
// write into real data and could pick up real vendor keys.
//
// This pins every run to a private, disposable environment instead. One
// directory per test process (so two runs at once can't collide either),
// removed again when the run ends (see vitest.globalSetup.ts).
export function testDataDir(): string {
  return path.join(os.tmpdir(), `flippilot-backend-test-${process.pid}`);
}

// dotenv never overrides a variable that is already set — even to an empty
// string — so setting these to "" is what stops a real value in .env from
// coming through. Every environment variable the backend reads is listed:
// a key added to the code later should be added here too.
export const BLANKED_VARIABLES = [
  "ADMIN_EMAIL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_API_URL",
  "AUTOTRADER_API_KEY",
  "API_KEY",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "DVLA_API_KEY",
  "EBAY_CLIENT_ID",
  "EBAY_CLIENT_SECRET",
  "EBAY_SELLER_TOKEN",
  "EMAIL_FROM",
  "MOTORS_API_KEY",
  "OPENAI_API_KEY",
  "PUBLIC_API_URL",
  "RENDER_GIT_COMMIT",
  "RESEND_API_KEY",
  "SCOPE_URL",
  "SERPAPI_KEY",
  "STRIPE_PILOT_BRAIN_PRICE_ID",
  "STRIPE_PRICE_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TOKEN_URL",
];
