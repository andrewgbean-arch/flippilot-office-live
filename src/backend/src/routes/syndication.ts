import { Express } from "express";
import { readCollection } from "../db";

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
  // download it for manual upload.
  app.get("/syndication/feed.csv", (_req, res) => {
    const vehicles = readCollection<VehicleLike>("vehicles");
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
