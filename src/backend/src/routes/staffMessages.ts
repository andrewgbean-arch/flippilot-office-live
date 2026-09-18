import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readCollection, readTenantCollection, writeTenantCollection } from "../db";
import { requireAuth, type AuthUser, type StoredUser } from "../auth";

export interface StaffMessage {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  message: string;
  createdAt: string;
  // Set the moment the recipient's own GET /staff-messages call runs —
  // "opened" means they genuinely loaded their inbox, not a manual
  // "mark as read" click. Absent (not null) until then, so a sender's
  // own view can tell "not yet seen" apart from "seen".
  readAt?: string;
}

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Tenant-scoped, unlike supportMessages — this never needs to cross a
// dealership boundary, staff messaging your own team.
const COLLECTION = "staffMessages";

export default function registerStaffMessagesRoute(app: Express) {
  app.post("/staff-messages", requireAuth, (req, res) => {
    const user = authUser(req);
    const { toUserId, message } = req.body ?? {};

    if (typeof toUserId !== "string" || !toUserId.trim()) {
      return res.status(400).json({ ok: false, error: "Missing recipient" });
    }
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Message can't be empty" });
    }
    if (message.length > 5000) {
      return res.status(400).json({ ok: false, error: "Message is too long" });
    }
    if (toUserId === user.id) {
      return res.status(400).json({ ok: false, error: "You can't message yourself" });
    }

    // Real teammates only — verified server-side against the real users
    // collection, never trusted from whatever the client sent, and
    // scoped to the caller's OWN dealership so one dealer can never
    // message into another's account.
    const recipient = readCollection<StoredUser>("users").find(
      u => u.id === toUserId && u.dealershipId === user.dealershipId
    );
    if (!recipient) {
      return res.status(404).json({ ok: false, error: "That teammate wasn't found" });
    }

    const entry: StaffMessage = {
      id: randomUUID(),
      fromUserId: user.id,
      fromUserName: user.name,
      toUserId: recipient.id,
      toUserName: recipient.name,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    const existing = readTenantCollection<StaffMessage>(user.dealershipId, COLLECTION);
    writeTenantCollection(user.dealershipId, COLLECTION, [...existing, entry]);

    const notifications = readTenantCollection<any>(user.dealershipId, "notifications");
    writeTenantCollection(user.dealershipId, "notifications", [
      ...notifications,
      {
        id: randomUUID(),
        userId: recipient.id,
        title: `New message from ${user.name}`,
        message: entry.message.slice(0, 80) + (entry.message.length > 80 ? "…" : ""),
        type: "info" as const,
        createdAt: entry.createdAt,
        readAt: null,
      },
    ]);

    res.json({ ok: true, message: entry });
  });

  // Doubles as the real "mark as received" trigger — any message
  // addressed to the caller that hasn't been read yet gets readAt set
  // right here, since actually loading this list IS what "opened"
  // means. The sender then sees that on their own next GET.
  app.get("/staff-messages", requireAuth, (req, res) => {
    const user = authUser(req);
    const all = readTenantCollection<StaffMessage>(user.dealershipId, COLLECTION);

    let changed = false;
    const now = new Date().toISOString();
    all.forEach(m => {
      if (m.toUserId === user.id && !m.readAt) {
        m.readAt = now;
        changed = true;
      }
    });
    if (changed) writeTenantCollection(user.dealershipId, COLLECTION, all);

    const mine = all
      .filter(m => m.fromUserId === user.id || m.toUserId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({ ok: true, messages: mine });
  });
}
