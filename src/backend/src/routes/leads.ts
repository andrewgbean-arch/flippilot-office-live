import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Scoped per-dealership — one dealer's leads are never visible to
// another (requireAuth runs before this in server.ts).
export default function registerLeadsRoute(app: Express) {
  app.get("/leads", (req, res) => {
    res.json({ ok: true, items: readTenantCollection(dealershipId(req), "leads") });
  });

  app.put("/leads", (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeTenantCollection(dealershipId(req), "leads", items);
    res.json({ ok: true, items });
  });
}
