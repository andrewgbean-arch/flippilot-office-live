import { Express } from "express";
import { readCollection, writeCollection } from "../db";

// Staff previously lived only in browser localStorage (staffStorage.web.ts)
// — nothing on the backend at all. Same whole-collection GET/PUT pattern
// as inventory/leads, matching what StaffContext already expects from
// loadStaff()/saveStaff().
export default function registerStaffRoute(app: Express) {
  app.get("/staff", (_req, res) => {
    res.json({ ok: true, items: readCollection("staff") });
  });

  app.put("/staff", (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeCollection("staff", items);
    res.json({ ok: true, items });
  });
}
