import { Express } from "express";
import { readCollection, writeCollection } from "../db";

// Was hardcoded mock data (Ford Fiesta / BMW 1 Series) that never
// changed no matter what the frontend did — now backed by the real
// file store, and the frontend's whole-collection load/save pattern
// (see InventoryProvider.tsx) maps directly to GET/PUT here.
export default function registerInventoryRoute(app: Express) {
  app.get("/inventory", (_req, res) => {
    res.json({ ok: true, items: readCollection("vehicles") });
  });

  app.put("/inventory", (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeCollection("vehicles", items);
    res.json({ ok: true, items });
  });
}
