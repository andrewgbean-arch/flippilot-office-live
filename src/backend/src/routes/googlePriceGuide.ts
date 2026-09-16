import { Express } from "express";
import rateLimit from "express-rate-limit";
import { fetchGoogleCarPriceGuide } from "../googleCarMarket";

// SerpAPI's free tier is 100 searches/month TOTAL, shared with the
// sibling flippilotlatest project's own barcode-scanner price lookups —
// a much tighter budget than eBay's 5,000/day. This is only ever called
// when a dealer explicitly clicks "Check Google dealer prices" (never
// automatically on page load), and this limiter is the backstop against
// anything hammering it faster than that.
const googlePriceGuideLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Daily Google price-check limit reached — try again tomorrow." },
});

export default function registerGooglePriceGuideRoute(app: Express) {
  app.get("/market/google-price-guide", googlePriceGuideLimiter, async (req, res) => {
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

    const guide = await fetchGoogleCarPriceGuide(
      make,
      model,
      Number.isFinite(year) ? year : null,
      Number.isFinite(mileage) ? mileage : null
    );

    if (!guide) {
      return res.json({ ok: true, available: false });
    }

    return res.json({ ok: true, available: true, guide });
  });
}
