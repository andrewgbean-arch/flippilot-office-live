import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import { requireStaffRole, type AuthUser } from "../auth";
import { BIN_DAYS, binEntries, binLabel, takeFromBin } from "../recycleBin";

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// The "Recently deleted" screen (recycleBin.ts): the owner or a manager can
// see what was removed from leads, jobs, contacts and consumables in the
// last BIN_DAYS, put something back, or delete it for good.
export default function registerRecentlyDeletedRoute(app: Express) {
  const managers = requireStaffRole("manager");

  app.get("/recently-deleted", managers, (req, res) => {
    const user = authedUser(req);
    const items = binEntries(user.dealershipId).map((e) => ({
      id: e.id,
      list: e.list,
      label: binLabel(e),
      deletedAt: e.deletedAt,
      deletedBy: e.deletedBy.name,
    }));
    res.json({ ok: true, keptForDays: BIN_DAYS, items });
  });

  app.post("/recently-deleted/:id/restore", managers, (req, res) => {
    const user = authedUser(req);
    const entry = takeFromBin(user.dealershipId, String(req.params.id ?? ""));
    if (!entry) return res.status(404).json({ ok: false, error: "That isn't in Recently deleted any more." });

    const list = readTenantCollection<Record<string, unknown>>(user.dealershipId, entry.list);
    if (list.some((r) => r.id === entry.record.id)) {
      // Already back (restored twice, or re-added): nothing to do, and it isn't lost.
      return res.json({ ok: true, alreadyThere: true, list: entry.list });
    }
    writeTenantCollection(user.dealershipId, entry.list, [...list, entry.record]);
    res.json({ ok: true, list: entry.list, label: binLabel(entry) });
  });

  app.delete("/recently-deleted/:id", managers, (req, res) => {
    const user = authedUser(req);
    const entry = takeFromBin(user.dealershipId, String(req.params.id ?? ""));
    if (!entry) return res.status(404).json({ ok: false, error: "That isn't in Recently deleted any more." });
    res.json({ ok: true });
  });
}

