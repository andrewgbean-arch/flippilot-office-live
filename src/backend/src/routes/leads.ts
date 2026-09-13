import { Express } from "express";
import { readCollection, writeCollection } from "../db";

// Leads previously lived only in browser localStorage (leadStorage.web.ts)
// — nothing on the backend at all. Same whole-collection GET/PUT pattern
// as inventory, matching what LeadsContext already expects from
// loadLeads()/saveLeads().
export default function registerLeadsRoute(app: Express) {
  app.get("/leads", (_req, res) => {
    res.json({ ok: true, items: readCollection("leads") });
  });

  app.put("/leads", (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeCollection("leads", items);
    res.json({ ok: true, items });
  });
}
