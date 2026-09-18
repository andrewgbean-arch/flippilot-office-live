import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";
import { keepHostedPhotos, publicOrigin, purgeOrphanPhotos } from "./photos";

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
    const id = dealershipId(req);
    const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
    // Photos added from a phone survive a save from a screen that hadn't
    // seen them yet (see keepHostedPhotos).
    const items = keepHostedPhotos(id, incoming, publicOrigin(req));
    writeTenantCollection(id, "vehicles", items);
    purgeOrphanPhotos(id, items);
    res.json({ ok: true, items });
  });
}
