import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Was hardcoded mock data (Ford Fiesta / BMW 1 Series), then a single
// shared file for every dealer — now scoped per-dealership so one
// dealer's inventory is never visible to another (requireAuth runs
// before this in server.ts, so req.user is always populated here).
export default function registerInventoryRoute(app: Express) {
  app.get("/inventory", (req, res) => {
    res.json({ ok: true, items: readTenantCollection(dealershipId(req), "vehicles") });
  });

  app.put("/inventory", (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeTenantCollection(dealershipId(req), "vehicles", items);
    res.json({ ok: true, items });
  });
}
