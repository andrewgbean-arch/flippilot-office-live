import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import { requireStaffRole, type AuthUser } from "../auth";
import { canManageStaff } from "../roleAccess";

export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  clockIn: string;
  clockOut: string | null;
}

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Clock-in/out for real staff accounts. Deliberately self-service and
// server-derived — the caller's id, name and timestamp all come from
// the verified token and the server clock, never the request body, so
// no one can punch in as a colleague or backdate a shift. Corrections
// (fixing a missed clock-out, adjusting a mistaken punch) are gated to
// manager/owner, same tier as PUT /staff.
export default function registerTimekeepingRoute(app: Express) {
  // The owner and managers see everyone's hours (they run the rota and pay).
  // Everyone else sees their own, plus who is in today: anyone still clocked
  // in, or who clocked in within the last day, which is what the Time Clock's
  // "Today's Log" shows.
  app.get("/timekeeping", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<TimeEntry>(user.dealershipId, "timekeeping");
    if (canManageStaff(user)) return res.json({ ok: true, items });
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const visible = items.filter(e => e.userId === user.id || e.clockOut === null || Date.parse(e.clockIn) >= since);
    res.json({ ok: true, items: visible });
  });

  app.post("/timekeeping/clock-in", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<TimeEntry>(user.dealershipId, "timekeeping");

    if (items.some(e => e.userId === user.id && e.clockOut === null)) {
      return res.status(409).json({ ok: false, error: "Already clocked in" });
    }

    const entry: TimeEntry = {
      id: randomUUID(),
      userId: user.id,
      userName: user.name,
      clockIn: new Date().toISOString(),
      clockOut: null,
    };
    const updated = [...items, entry];
    writeTenantCollection(user.dealershipId, "timekeeping", updated);
    res.json({ ok: true, entry, items: updated });
  });

  app.post("/timekeeping/clock-out", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<TimeEntry>(user.dealershipId, "timekeeping");

    const openEntry = items.find(e => e.userId === user.id && e.clockOut === null);
    if (!openEntry) {
      return res.status(409).json({ ok: false, error: "Not currently clocked in" });
    }

    const updated = items.map(e =>
      e.id === openEntry.id ? { ...e, clockOut: new Date().toISOString() } : e
    );
    writeTenantCollection(user.dealershipId, "timekeeping", updated);
    res.json({ ok: true, items: updated });
  });

  app.put("/timekeeping/:id", requireStaffRole("manager"), (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<TimeEntry>(user.dealershipId, "timekeeping");
    const { clockIn, clockOut } = req.body ?? {};

    if (!items.some(e => e.id === req.params.id)) {
      return res.status(404).json({ ok: false, error: "Time entry not found" });
    }

    const updated = items.map(e =>
      e.id === req.params.id
        ? {
            ...e,
            ...(typeof clockIn === "string" ? { clockIn } : {}),
            ...(clockOut === null || typeof clockOut === "string" ? { clockOut } : {}),
          }
        : e
    );
    writeTenantCollection(user.dealershipId, "timekeeping", updated);
    res.json({ ok: true, items: updated });
  });

  app.delete("/timekeeping/:id", requireStaffRole("manager"), (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<TimeEntry>(user.dealershipId, "timekeeping");
    const updated = items.filter(e => e.id !== req.params.id);
    writeTenantCollection(user.dealershipId, "timekeeping", updated);
    res.json({ ok: true, items: updated });
  });
}
