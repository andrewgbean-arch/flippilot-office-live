import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import { requireStaffRole, type AuthUser } from "../auth";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Scoped per-dealership — one dealer's staff records are never visible
// to another (requireAuth runs before this in server.ts).
export default function registerStaffRoute(app: Express) {
  app.get("/staff", (req, res) => {
    res.json({ ok: true, items: readTenantCollection(dealershipId(req), "staff") });
  });

  // Managing the staff roster is manager/owner territory — a "sales"
  // or "finance" staff account can view the team but not add, remove,
  // or reassign anyone.
  app.put("/staff", requireStaffRole("manager"), (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeTenantCollection(dealershipId(req), "staff", items);
    res.json({ ok: true, items });
  });
}
