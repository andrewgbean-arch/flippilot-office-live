import { Express } from "express";
import rateLimit from "express-rate-limit";
import { readTenantCollection } from "../db";

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
  images?: string[] | null;
  vatScheme?: string;
  status: string;
};

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
    v.notes ?? "",
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
  // download it for manual upload. Scoped by dealershipId in the path
  // rather than requireAuth: a portal's feed importer fetches this on a
  // schedule with no login flow of its own, so the URL itself (built
  // from a real UUID, same unguessable-by-design pattern as e.g. a
  // private iCal feed link) is the access control here, not a session.
  //
  // A security review caught this reading from the GLOBAL `vehicles`
  // collection — a completely different, disconnected data source from
  // where real per-dealer inventory actually lives
  // (data/dealerships/<id>/vehicles.json via readTenantCollection,
  // same as /inventory uses). The global file was never populated by
  // anything, so in practice this always returned an empty feed
  // regardless of what was really in any dealer's stock — not a stub,
  // just silently wired to the wrong place. Fixed to read the real,
  // tenant-scoped inventory for the dealership named in the URL.
  app.get("/syndication/:dealershipId/feed.csv", feedLimiter, (req, res) => {
    const dealershipId = req.params.dealershipId;
    if (!dealershipId) return res.status(400).json({ ok: false, error: "Missing dealership id" });

    const vehicles = readTenantCollection<VehicleLike>(dealershipId, "vehicles");
    const csv = vehiclesToCsv(vehicles);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=stock-feed.csv"
    );
    res.send(csv);
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
