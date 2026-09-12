import { Express } from "express";

export default function registerSearchRoute(app: Express) {
  app.get("/search", async (req, res) => {
    const q = (req.query.q as string) || "default";

    // Temporary mock data until real market backend is restored
    const results = [
      {
        id: 1,
        title: "Ford Fiesta 2016",
        price: 4995,
        mileage: 62000,
        location: "Paignton"
      },
      {
        id: 2,
        title: "Vauxhall Corsa 2017",
        price: 5495,
        mileage: 58000,
        location: "Torquay"
      }
    ];

    res.json({
      ok: true,
      query: q,
      results
    });
  });
}
