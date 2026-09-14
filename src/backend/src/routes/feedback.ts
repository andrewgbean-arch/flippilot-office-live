import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import { requireStaffRole, type AuthUser } from "../auth";

export type FeedbackStatus = "new" | "reviewed" | "actioned";

export interface FeedbackEntry {
  id: string;
  // Deliberately absent (not just hidden) when submitted anonymously —
  // real anonymity, not a display toggle a manager can see through.
  userId: string | null;
  userName: string | null;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
}

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// "What Can We Do Better?" — an internal staff suggestion box. Any
// authenticated staff can post (optionally anonymously) and read every
// entry; only a manager/owner can move a suggestion's status along,
// same tier as other staff-management actions.
export default function registerFeedbackRoute(app: Express) {
  app.get("/feedback", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<FeedbackEntry>(user.dealershipId, "feedback").sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    res.json({ ok: true, items });
  });

  app.post("/feedback", (req, res) => {
    const user = authedUser(req);
    const { message, anonymous } = req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "message is required" });
    }

    const items = readTenantCollection<FeedbackEntry>(user.dealershipId, "feedback");
    const entry: FeedbackEntry = {
      id: randomUUID(),
      userId: anonymous === true ? null : user.id,
      userName: anonymous === true ? null : user.name,
      message: message.trim(),
      status: "new",
      createdAt: new Date().toISOString(),
    };

    writeTenantCollection(user.dealershipId, "feedback", [...items, entry]);
    res.json({ ok: true, entry });
  });

  app.put("/feedback/:id/status", requireStaffRole("manager"), (req, res) => {
    const user = authedUser(req);
    const { status } = req.body ?? {};
    if (!["new", "reviewed", "actioned"].includes(status)) {
      return res.status(400).json({ ok: false, error: "status must be new, reviewed or actioned" });
    }

    const items = readTenantCollection<FeedbackEntry>(user.dealershipId, "feedback");
    if (!items.some((f) => f.id === req.params.id)) {
      return res.status(404).json({ ok: false, error: "Feedback entry not found" });
    }

    const updated = items.map((f) => (f.id === req.params.id ? { ...f, status: status as FeedbackStatus } : f));
    writeTenantCollection(user.dealershipId, "feedback", updated);
    res.json({ ok: true, items: updated });
  });
}
