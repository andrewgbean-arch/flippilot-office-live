import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { detachMessagePhotos, readCollection, readTenantCollection, writeTenantCollection } from "../db";
import { requireAuth, type AuthUser, type StoredUser } from "../auth";
import { parsePhotoIds } from "../photoStore";
import { attachPhotosToMessage, publicOrigin, withPhotoUrls } from "./photos";

export interface StaffMessage {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  // May be empty when the message is only photos.
  message: string;
  // Ids of photos shared in this message (private; clients get signed
  // links for them as `photos`, see withPhotoUrls).
  photoIds?: string[];
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
    const { toUserId, message, photoIds: rawPhotoIds } = req.body ?? {};

    if (typeof toUserId !== "string" || !toUserId.trim()) {
      return res.status(400).json({ ok: false, error: "Missing recipient" });
    }
    const photos = parsePhotoIds(rawPhotoIds);
    if (!photos.ok) {
      return res.status(400).json({ ok: false, error: photos.error });
    }
    // A message needs words or at least one photo.
    if ((typeof message !== "string" || !message.trim()) && photos.ids.length === 0) {
      return res.status(400).json({ ok: false, error: "Message can't be empty" });
    }
    if (typeof message === "string" && message.length > 5000) {
      return res.status(400).json({ ok: false, error: "Message is too long" });
    }
    const text = typeof message === "string" ? message.trim() : "";
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
      message: text,
      ...(photos.ids.length > 0 ? { photoIds: photos.ids } : {}),
      createdAt: new Date().toISOString(),
    };

    // Only after the recipient is confirmed real, so a bad request doesn't
    // use up someone's uploaded photos. Refuses unless every photo is an
    // unsent one this user uploaded.
    const attached = attachPhotosToMessage(user.dealershipId, user.id, photos.ids, entry.id, false);
    if (!attached.ok) {
      return res.status(attached.status).json({ ok: false, error: attached.error });
    }

    const existing = readTenantCollection<StaffMessage>(user.dealershipId, COLLECTION);
    try {
      writeTenantCollection(user.dealershipId, COLLECTION, [...existing, entry]);
    } catch (err) {
      // The photos were attached a moment ago; don't leave them pointing at
      // a message that was never saved.
      detachMessagePhotos(user.dealershipId, entry.id);
      throw err;
    }

    const preview = text
      ? text.slice(0, 80) + (text.length > 80 ? "…" : "")
      : `Sent you ${photos.ids.length} photo${photos.ids.length === 1 ? "" : "s"}`;
    const notifications = readTenantCollection<any>(user.dealershipId, "notifications");
    writeTenantCollection(user.dealershipId, "notifications", [
      ...notifications,
      {
        id: randomUUID(),
        userId: recipient.id,
        title: `New message from ${user.name}`,
        message: preview,
        type: "info" as const,
        createdAt: entry.createdAt,
        readAt: null,
      },
    ]);

    res.json({ ok: true, message: withPhotoUrls(entry, publicOrigin(req)) });
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

    // Photo links are issued here, and only for messages this person is
    // part of (the filter above is what makes a 1:1 photo private).
    const origin = publicOrigin(req);
    res.json({ ok: true, messages: mine.map(m => withPhotoUrls(m, origin)) });
  });
}
