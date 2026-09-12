import axios from "axios";
import { Express } from "express";

export default function registerIntelligenceUpgrade(app: Express) {
  app.post("/intelligence/score", async (req, res) => {
    const { make, model, year, mileage, expiry } = req.body;

    if (!make || !model || !year) {
      return res.status(400).json({ ok: false, error: "Missing vehicle data" });
    }

    try {
      // Example market data API (replace with your real source)
      const { data: comps } = await axios.get(
        `https://api.vehicleinfo.dev/comps?make=${make}&model=${model}&year=${year}`
      );

      // Basic valuation logic
      const avgPrice =
        comps.reduce((sum: number, c: any) => sum + c.price, 0) / comps.length;

      const mileagePenalty = mileage ? Math.max(0, (mileage - 60000) * 0.03) : 0;
      const motPenalty = expiry ? 0 : 200;

      const valuation = Math.round(avgPrice - mileagePenalty - motPenalty);

      const conditionScore = Math.max(
        0,
        100 -
          (mileage ? mileage / 1000 : 0) -
          (expiry ? 0 : 10)
      );

      const riskScore = Math.min(
        100,
        (mileage ? mileage / 800 : 0) + (expiry ? 0 : 20)
      );

      return res.json({
        ok: true,
        valuation,
        comps,
        conditionScore,
        riskScore,
      });
    } catch (err) {
      console.error("Intelligence scoring failed:", err);
      return res.status(500).json({ ok: false, error: "Intelligence scoring failed" });
    }
  });
}
