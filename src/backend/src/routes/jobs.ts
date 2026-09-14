import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Day-to-day jobs/tasks — "book car in for MOT", "chase up lead",
// "clean showroom" — assignable to a real staff account (via /team),
// optionally linked to a specific vehicle. Deliberately open to any
// authenticated staff to create/update/complete, same as leads — this
// is operational coordination, not the financial/staff-management data
// that PUT /bookkeeping and PUT /staff are gated on.
export default function registerJobsRoute(app: Express) {
  app.get("/jobs", (req, res) => {
    res.json({ ok: true, items: readTenantCollection(dealershipId(req), "jobs") });
  });

  app.put("/jobs", (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    writeTenantCollection(dealershipId(req), "jobs", items);
    res.json({ ok: true, items });
  });
}
