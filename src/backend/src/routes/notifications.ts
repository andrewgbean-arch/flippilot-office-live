import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface StaffNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
}

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// A real, backend-persisted, per-recipient inbox — the thing the
// existing dealer notification bell never actually had. That bell
// (DealerNotificationsContext) was pure in-memory React state with no
// backend at all, so "Job Assigned" or any other notification only
// ever appeared in whichever browser tab created it, never on the
// actual recipient's own login. This collection is what makes a rota
// publish, a shift change, or a leave decision genuinely reach the
// right person's own account instead of just the screen of whoever
// clicked the button.
export default function registerNotificationsRoute(app: Express) {
  // Only ever the caller's own notifications — never another staff
  // member's, even within the same dealership.
  app.get("/notifications", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<StaffNotification>(user.dealershipId, "notifications").filter(
      n => n.userId === user.id
    );
    res.json({ ok: true, items });
  });

  // Any authenticated staff member can send a notification to any
  // other real account in their own dealership — the same trust tier
  // as creating a job or a lead (operational coordination), not
  // privileged data like bookkeeping or the staff roster.
  app.post("/notifications", (req, res) => {
    const user = authedUser(req);
    const { userId, title, message, type } = req.body ?? {};
    if (typeof userId !== "string" || typeof title !== "string" || typeof message !== "string") {
      return res.status(400).json({ ok: false, error: "userId, title and message are required" });
    }

    const items = readTenantCollection<StaffNotification>(user.dealershipId, "notifications");
    const entry: StaffNotification = {
      id: randomUUID(),
      userId,
      title,
      message,
      type: (["info", "success", "warning", "error"] as const).includes(type) ? type : "info",
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    writeTenantCollection(user.dealershipId, "notifications", [...items, entry]);
    res.json({ ok: true, entry });
  });

  app.put("/notifications/:id/read", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<StaffNotification>(user.dealershipId, "notifications");
    const target = items.find(n => n.id === req.params.id);
    if (!target) return res.status(404).json({ ok: false, error: "Notification not found" });
    if (target.userId !== user.id) return res.status(403).json({ ok: false, error: "Not your notification" });

    const updated = items.map(n => (n.id === req.params.id ? { ...n, readAt: new Date().toISOString() } : n));
    writeTenantCollection(user.dealershipId, "notifications", updated);
    res.json({ ok: true });
  });

  app.delete("/notifications/:id", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<StaffNotification>(user.dealershipId, "notifications");
    const target = items.find(n => n.id === req.params.id);
    if (!target) return res.status(404).json({ ok: false, error: "Notification not found" });
    if (target.userId !== user.id) return res.status(403).json({ ok: false, error: "Not your notification" });

    writeTenantCollection(
      user.dealershipId,
      "notifications",
      items.filter(n => n.id !== req.params.id)
    );
    res.json({ ok: true });
  });
}
