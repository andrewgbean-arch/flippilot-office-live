import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { detachMessagePhotos, readTenantCollection, writeTenantCollection } from "../db";
import { requireStaffRole, type AuthUser } from "../auth";
import { parsePhotoIds } from "../photoStore";
import { attachPhotosToMessage, publicOrigin, withPhotoUrls } from "./photos";

export type FeedbackStatus = "new" | "reviewed" | "actioned";

export interface FeedbackEntry {
  id: string;
  // Deliberately absent (not just hidden) when submitted anonymously —
  // real anonymity, not a display toggle a manager can see through.
  userId: string | null;
  userName: string | null;
  // May be empty when the post is only photos.
  message: string;
  // Ids of photos shared in this post (private to the dealership's
  // staff; clients get signed links as `photos`, see withPhotoUrls).
  photoIds?: string[];
  status: FeedbackStatus;
  createdAt: string;
}

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Stored oldest-first (new posts are appended), but every response a client
// shows as "the board" must be newest-first, or the list jumps order after a
// status change.
function newestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// "What Can We Do Better?" — an internal staff suggestion box. Any
// authenticated staff can post (optionally anonymously) and read every
// entry; only a manager/owner can move a suggestion's status along,
// same tier as other staff-management actions.
export default function registerFeedbackRoute(app: Express) {
  app.get("/feedback", (req, res) => {
    const user = authedUser(req);
    const items = newestFirst(readTenantCollection<FeedbackEntry>(user.dealershipId, "feedback"));
    const origin = publicOrigin(req);
    res.json({ ok: true, items: items.map(item => withPhotoUrls(item, origin)) });
  });

  app.post("/feedback", (req, res) => {
    const user = authedUser(req);
    const { message, anonymous, photoIds: rawPhotoIds } = req.body ?? {};

    const photos = parsePhotoIds(rawPhotoIds);
    if (!photos.ok) {
      return res.status(400).json({ ok: false, error: photos.error });
    }
    // A post needs words or at least one photo.
    if ((typeof message !== "string" || !message.trim()) && photos.ids.length === 0) {
      return res.status(400).json({ ok: false, error: "message is required" });
    }

    const items = readTenantCollection<FeedbackEntry>(user.dealershipId, "feedback");
    const entry: FeedbackEntry = {
      id: randomUUID(),
      userId: anonymous === true ? null : user.id,
      userName: anonymous === true ? null : user.name,
      message: typeof message === "string" ? message.trim() : "",
      ...(photos.ids.length > 0 ? { photoIds: photos.ids } : {}),
      status: "new",
      createdAt: new Date().toISOString(),
    };

    // For an anonymous post the photos' uploader is cleared as they're
    // attached — the same promise the post itself makes: nothing stored
    // links it back to a person.
    const attached = attachPhotosToMessage(user.dealershipId, user.id, photos.ids, entry.id, anonymous === true);
    if (!attached.ok) {
      return res.status(attached.status).json({ ok: false, error: attached.error });
    }

    try {
      writeTenantCollection(user.dealershipId, "feedback", [...items, entry]);
    } catch (err) {
      // The photos were attached a moment ago; don't leave them pointing at
      // a post that was never saved.
      detachMessagePhotos(user.dealershipId, entry.id);
      throw err;
    }
    res.json({ ok: true, entry: withPhotoUrls(entry, publicOrigin(req)) });
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
    // Clients replace their whole list with this, so it has to carry the
    // photo links too or every photo would vanish after a status change.
    const origin = publicOrigin(req);
    res.json({ ok: true, items: newestFirst(updated).map(item => withPhotoUrls(item, origin)) });
  });
}
