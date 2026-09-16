import { Express } from "express";
import rateLimit from "express-rate-limit";
import { fetchEbayCarComps } from "../ebayCarMarket";

// Authenticated (requireAuth already runs before this — see server.ts)
// but rate-limited per IP regardless, same reasoning as this backend's
// other real-external-API routes: even a free tier has a shared daily
// call budget (eBay: 5,000/day for the whole app), so nothing here
// should be able to burn through it on its own.
const marketCompsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many market lookup requests — please try again later." },
});

export default function registerMarketCompsRoute(app: Express) {
  app.get("/market/ebay-comps", marketCompsLimiter, async (req, res) => {
    const make = typeof req.query.make === "string" ? req.query.make : "";
    const model = typeof req.query.model === "string" ? req.query.model : "";
    const yearRaw = req.query.year;
    const mileageRaw = req.query.mileage;
    const year = typeof yearRaw === "string" && yearRaw.trim() !== "" ? Number(yearRaw) : null;
    const mileage =
      typeof mileageRaw === "string" && mileageRaw.trim() !== "" ? Number(mileageRaw) : null;

    if (!make || !model) {
      return res.status(400).json({ ok: false, error: "make and model are required" });
    }

    const comps = await fetchEbayCarComps(
      make,
      model,
      Number.isFinite(year) ? year : null,
      Number.isFinite(mileage) ? mileage : null
    );

    if (!comps) {
      return res.json({ ok: true, available: false });
    }

    return res.json({ ok: true, available: true, comps });
  });
}
