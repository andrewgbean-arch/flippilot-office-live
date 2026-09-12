import axios from "axios";
import { Express } from "express";

export default function registerDVLA(app: Express) {
  app.get("/dvla", async (req, res) => {
    const reg = req.query.reg as string;

    if (!reg) {
      return res.status(400).json({ ok: false, error: "Missing reg" });
    }

    try {
      // Example external API call (replace with your real DVLA/MOT provider)
      const { data } = await axios.get(
        `https://api.vehicleinfo.dev/mot?reg=${encodeURIComponent(reg)}`
      );

      return res.json({
        ok: true,
        vehicle: {
          reg,
          make: data.make,
          model: data.model,
          year: data.year,
          colour: data.colour,
          mileage: data.mileage ?? null,
          expiry: data.expiry ?? null,
          history: data.history ?? [],
        }
      });
    } catch (err) {
      console.error("DVLA lookup failed:", err);
      return res.status(500).json({ ok: false, error: "DVLA lookup failed" });
    }
  });
}


