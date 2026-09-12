import { Express } from "express";

export default function registerInventoryRoute(app: Express) {
  app.get("/inventory", (req, res) => {
    res.json({
      ok: true,
      items: [
        { id: 1, title: "Ford Fiesta", price: 4995 },
        { id: 2, title: "BMW 1 Series", price: 8995 }
      ]
    });
  });
}
