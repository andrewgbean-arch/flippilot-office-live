import { Express } from "express";
import axios from "axios";

export default function registerIntelligenceV3(app: Express) {
  app.post("/intelligence/v3", async (req, res) => {
    const { title, mot, images } = req.body;

    try {
      // Fake AI logic (replace with your real AI provider)
      const listing = `For sale: ${title}. Clean runner, good condition. MOT: ${mot?.expiry ?? "Unknown"}. Mileage: ${mot?.mileage ?? "Unknown"}.`;

      const flipProbability =
        mot?.mileage < 90000 ? 82 : mot?.mileage < 120000 ? 65 : 40;

      const photoScores = (images || []).map((img: string) => ({
        uri: img,
        score: Math.floor(Math.random() * 40) + 60,
      }));

      const damageDetected = false;

      return res.json({
        ok: true,
        listing,
        flipProbability,
        photoScores,
        damageDetected,
      });
    } catch (err) {
      console.error("Intelligence V3 failed:", err);
      return res.status(500).json({ ok: false });
    }
  });
}
