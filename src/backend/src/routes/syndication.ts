import { randomBytes, timingSafeEqual } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, writeCollection } from "../db";
import { isSampleVehicleId } from "../sampleVehicles";
import { requireAuth, requireOwner, type AuthUser, type Dealership } from "../auth";
import { publicOrigin } from "./photos";

// Same unauthenticated-by-design reasoning as the URL itself (see
// below) — but with no limiter at all, a known feed URL could be
// polled at unlimited rate to scrape a dealer's full live stock/
// pricing forever. Real feed importers poll on a schedule (hourly/
// daily at most), so this costs nothing for legitimate use.
const feedLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests — please try again shortly." },
});

/* --------------------------------------------------
   ⭐ Marketplace syndication

   Real dealer software pushes stock to portals like AutoTrader,
   Motors.co.uk, eBay Motors etc. Those integrations need actual
   business/API relationships with each portal (see the "status"
   endpoint below) — but a plain CSV stock feed is a real, common
   integration path several portals accept directly (no API keys
   needed), so that part is fully working today, not a stub.
-------------------------------------------------- */

type VehicleLike = {
  id: string;
  reg?: string;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  colour?: string;
  priceRetail: number | null;
  condition: string;
  notes?: string | null;
  listingDescription?: string | null;
  images?: string[] | null;
  vatScheme?: string;
  status: string;
};

// The feed carries the advert description, VAT scheme, condition and every
// photo — more than the genuinely public storefront/passport show — so it
// can't rely on dealershipId alone being hard to find (the same id is
// embedded in the public /store/:id link a dealer shares on purpose). This
// generates a random per-dealership token the first time anyone asks for
// one (Marketplace Sync, on load) rather than needing a migration for every
// dealership that existed before this fix.
export function getOrCreateSyndicationToken(dealershipId: string): string | null {
  const dealerships = readCollection<Dealership>("dealerships");
  const dealership = dealerships.find(d => d.id === dealershipId);
  if (!dealership) return null;

  if (!dealership.syndicationFeedToken) {
    dealership.syndicationFeedToken = randomBytes(24).toString("hex");
    writeCollection("dealerships", dealerships);
  }
  return dealership.syndicationFeedToken;
}

function tokenMatches(expected: string, given: unknown): boolean {
  if (typeof given !== "string" || given.length === 0) return false;
  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(given);
  return expectedBuf.length === givenBuf.length && timingSafeEqual(expectedBuf, givenBuf);
}

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function vehiclesToCsv(vehicles: VehicleLike[]): string {
  const headers = [
    "Registration",
    "Make",
    "Model",
    "Year",
    "Mileage",
    "Colour",
    "Price",
    "Condition",
    "Description",
    "ImageURLs",
    "VatScheme",
    "AdvertStatus",
  ];

  const rows = vehicles.map(v => [
    v.reg ?? "",
    v.make,
    v.model,
    v.year ?? "",
    v.mileage ?? "",
    v.colour ?? "",
    v.priceRetail ?? "",
    v.condition ?? "",
    // Deliberately listingDescription, not notes — notes is the
    // internal-only field (staff commentary, negotiation notes), never
    // meant to leave the dealer's own account. A security review found
    // this feed was sending it straight to any external portal that
    // pulls this file, matching the exact "internal vs public copy"
    // distinction the rest of the app already draws for this vehicle.
    v.listingDescription ?? "",
    (v.images ?? []).join(";"),
    v.vatScheme ?? "",
    v.status ?? "",
  ]);

  return [headers, ...rows]
    .map(row => row.map(csvEscape).join(","))
    .join("\r\n");
}

export default function registerSyndicationRoute(app: Express) {
  // Works today, no external credentials needed — point a portal's feed
  // importer (or Motors.co.uk's daily feed intake) at this URL, or just
  // download it for manual upload. Scoped by dealershipId in the path and a
  // secret ?token= in the query string, rather than requireAuth, so a
  // portal's feed importer can fetch this on a schedule with no login flow
  // of its own — same "whoever holds the link can read it" shape as a
  // private iCal link.
  //
  // dealershipId alone is NOT a secret in this app — it's the same id
  // embedded in the genuinely public /store/:id storefront a dealer shares
  // on purpose — but this feed carries fields that storefront deliberately
  // doesn't (advert description, VAT scheme, condition, every photo, not
  // just one thumbnail), so an earlier version of this route that trusted
  // dealershipId alone was handing that out to anyone who'd ever seen the
  // dealer's public store link. The token (getOrCreateSyndicationToken,
  // above) is the part that actually has to stay secret; see
  // GET /syndication/feed-url for how a dealer gets their own.
  //
  // A separate, earlier fix caught this reading from the GLOBAL
  // `vehicles` collection — a completely different, disconnected data
  // source from where real per-dealer inventory actually lives
  // (data/dealerships/<id>/vehicles.json via readTenantCollection,
  // same as /inventory uses). The global file was never populated by
  // anything, so in practice this always returned an empty feed
  // regardless of what was really in any dealer's stock — not a stub,
  // just silently wired to the wrong place. Fixed to read the real,
  // tenant-scoped inventory for the dealership named in the URL.
  app.get("/syndication/:dealershipId/feed.csv", feedLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const expectedToken = getOrCreateSyndicationToken(dealershipId);
    // Same reply whether the dealership doesn't exist or the token is
    // wrong/missing — no reason to confirm a dealershipId is real to
    // someone who can't produce its token.
    if (!expectedToken || !tokenMatches(expectedToken, req.query.token)) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const vehicles = readTenantCollection<VehicleLike>(dealershipId, "vehicles")
      .filter(v => String(v.status ?? "").toLowerCase() !== "sold")
      .filter(v => !isSampleVehicleId(v.id));
    const csv = vehiclesToCsv(vehicles);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=stock-feed.csv"
    );
    res.send(csv);
  });

  // Lets Marketplace Sync show/copy the real, token-bearing feed URL without
  // the web app ever constructing it from dealershipId alone. Any signed-in
  // teammate can fetch it — the page itself has never been owner-only, and
  // whoever can already see Manage Team's invite links could get the same
  // information by asking an owner to paste it, so restricting this
  // specifically would just be friction, not a real boundary.
  app.get("/syndication/feed-url", requireAuth, (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const token = getOrCreateSyndicationToken(user.dealershipId);
    if (!token) return res.status(404).json({ ok: false, error: "Dealership not found" });

    res.json({
      ok: true,
      feedUrl: `${publicOrigin(req)}/syndication/${user.dealershipId}/feed.csv?token=${token}`,
    });
  });

  // If a token leaks (shared with the wrong portal, pasted somewhere public),
  // the owner needs a way to cut it off without FlipPilot support being
  // involved — the old link 404s immediately, and the dealer re-shares the
  // new one with whoever should still have it. Owner-only: the token is a
  // credential for a business integration, not a preference every teammate
  // should be able to invalidate for the others.
  app.post("/syndication/regenerate-token", requireAuth, requireOwner, (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const dealerships = readCollection<Dealership>("dealerships");
    const dealership = dealerships.find(d => d.id === user.dealershipId);
    if (!dealership) return res.status(404).json({ ok: false, error: "Dealership not found" });

    dealership.syndicationFeedToken = randomBytes(24).toString("hex");
    writeCollection("dealerships", dealerships);

    res.json({
      ok: true,
      feedUrl: `${publicOrigin(req)}/syndication/${user.dealershipId}/feed.csv?token=${dealership.syndicationFeedToken}`,
    });
  });

  // Lets the UI show real connection status per platform instead of
  // guessing — flips to "connected" automatically once real credentials
  // are added to .env, same pattern as the eBay pricing integration.
  app.get("/syndication/status", (_req, res) => {
    res.json({
      ok: true,
      platforms: {
        genericFeed: {
          available: true,
          method: "csv",
          note: "Live CSV feed at /syndication/feed.csv — no credentials needed.",
        },
        autotrader: {
          available: Boolean(process.env.AUTOTRADER_API_KEY),
          method: "api",
          note: "Requires a paid AutoTrader dealer account and AutoTrader Connect partner onboarding (developers.autotrader.co.uk) — not self-serve.",
        },
        motorsCoUk: {
          available: Boolean(process.env.MOTORS_API_KEY),
          method: "api-or-csv",
          note: "Requires contacting Motors.co.uk (info@motors.co.uk) for API/feed access, or use the generic CSV feed above.",
        },
        ebayMotors: {
          available: Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_SELLER_TOKEN),
          method: "api",
          note: "Reuses the existing eBay developer credentials, but publishing real listings needs a separate eBay seller authorization (3-legged OAuth), not just the app-level pricing token already configured.",
        },
        gumtree: {
          available: false,
          method: "none",
          note: "No official dealer API exists — only unofficial scrapers, which we don't use.",
        },
      },
    });
  });
}
