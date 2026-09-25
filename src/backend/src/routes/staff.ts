import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import { itemsFromBody } from "../wholeListGuard";
import { requireStaffRole, type AuthUser } from "../auth";
import { canManageStaff, withoutStaffPrivate } from "../roleAccess";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Scoped per-dealership — one dealer's staff records are never visible
// to another (requireAuth runs before this in server.ts).
export default function registerStaffRoute(app: Express) {
  // Everyone sees who is on the team; a teammate's NI number, home address
  // and private notes are for the owner and managers (roleAccess.ts).
  app.get("/staff", (req, res) => {
    const items = readTenantCollection(dealershipId(req), "staff");
    const user = (req as Request & { user: AuthUser }).user;
    res.json({ ok: true, items: canManageStaff(user) ? items : items.map(withoutStaffPrivate) });
  });

  // Managing the staff roster is manager/owner territory — a "sales"
  // or "finance" staff account can view the team but not add, remove,
  // or reassign anyone.
  app.put("/staff", requireStaffRole("manager"), (req, res) => {
    const items = itemsFromBody(req, res);
    if (!items) return;
    writeTenantCollection(dealershipId(req), "staff", items);
    res.json({ ok: true, items });
  });
}
