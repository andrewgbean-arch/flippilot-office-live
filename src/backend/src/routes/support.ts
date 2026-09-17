import { randomUUID } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, writeCollection, writeTenantCollection, readTenantCollection } from "../db";
import { requireAuth, requirePlatformAdmin, isPlatformAdmin, type AuthUser, type StoredUser } from "../auth";

export type SupportMessageStatus = "new" | "reviewed" | "resolved";

export interface SupportMessage {
  id: string;
  dealershipId: string;
  dealershipName: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  status: SupportMessageStatus;
  createdAt: string;
  // A single reply, not a full back-and-forth thread — matches how
  // simple every other messaging surface in this app is (FeedbackBoard
  // has no replies at all). Set once by the admin; a dealer sees it
  // attached to their own message on ContactSupport.tsx.
  adminReply?: string;
  adminReplyAt?: string;
}

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Real cross-account delivery, same mechanism the public booking flow
// uses to notify a dealership's own staff — writes into the RECIPIENT's
// own tenant notifications, not the sender's, so it shows up in their
// existing bell regardless of which side of the conversation they're on.
function notifyUser(dealershipId: string, userId: string, title: string, message: string) {
  const notifications = readTenantCollection<any>(dealershipId, "notifications");
  writeTenantCollection(dealershipId, "notifications", [
    ...notifications,
    {
      id: randomUUID(),
      userId,
      title,
      message,
      type: "info" as const,
      createdAt: new Date().toISOString(),
      readAt: null,
    },
  ]);
}

// A dealer messaging support might have an expired trial — that's
// exactly the kind of thing they'd be messaging about — so this is
// requireAuth only, deliberately not behind requireActiveSubscription
// the way most real data routes are (see app.ts).
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many messages — please try again later." },
});

// Global collection, not tenant-scoped (readTenantCollection) — this
// is the one place a message needs to be visible ACROSS dealerships,
// to whoever runs FlipPilot itself, not siloed per-dealer like every
// other piece of real business data in this app.
const COLLECTION = "supportMessages";

export default function registerSupportRoute(app: Express) {
  app.post("/support/messages", requireAuth, submitLimiter, (req, res) => {
    const user = authUser(req);
    const { message } = req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Message can't be empty" });
    }
    if (message.length > 5000) {
      return res.status(400).json({ ok: false, error: "Message is too long" });
    }

    const dealerships = readCollection<{ id: string; name: string }>("dealerships");
    const dealership = dealerships.find(d => d.id === user.dealershipId);

    const entry: SupportMessage = {
      id: randomUUID(),
      dealershipId: user.dealershipId,
      dealershipName: dealership?.name ?? "Unknown dealership",
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      message: message.trim(),
      status: "new",
      createdAt: new Date().toISOString(),
    };

    const existing = readCollection<SupportMessage>(COLLECTION);
    writeCollection(COLLECTION, [...existing, entry]);

    // The one recipient is whoever's account matches ADMIN_EMAIL, so
    // this shows up in their existing notification bell rather than
    // needing them to remember to check the Support Inbox page.
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const admin = readCollection<StoredUser>("users").find(
        u => u.email.toLowerCase() === adminEmail.toLowerCase()
      );
      if (admin) {
        notifyUser(
          admin.dealershipId,
          admin.id,
          "New support message",
          `${entry.dealershipName} — ${entry.message.slice(0, 80)}${entry.message.length > 80 ? "…" : ""}`
        );
      }
    }

    res.json({ ok: true, message: entry });
  });

  // Lets a dealer see their own message history and any reply — the
  // one place a dealer actually reads what came back, rather than only
  // finding out a reply exists via the notification bell text.
  app.get("/support/my-messages", requireAuth, (req, res) => {
    const user = authUser(req);
    const messages = readCollection<SupportMessage>(COLLECTION)
      .filter(m => m.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ ok: true, messages });
  });

  // Lets the UI decide whether to show the admin-only inbox link at
  // all, without ever trusting the client for the actual gate — the
  // real check runs again, server-side, on every /support/messages
  // request below regardless of what this returns.
  app.get("/support/is-admin", requireAuth, (req, res) => {
    res.json({ ok: true, isAdmin: isPlatformAdmin(authUser(req)) });
  });

  app.get("/support/messages", requireAuth, requirePlatformAdmin, (_req, res) => {
    const messages = readCollection<SupportMessage>(COLLECTION)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ ok: true, messages });
  });

  app.put("/support/messages/:id", requireAuth, requirePlatformAdmin, (req, res) => {
    const { status } = req.body ?? {};
    if (status !== "new" && status !== "reviewed" && status !== "resolved") {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }

    const messages = readCollection<SupportMessage>(COLLECTION);
    const entry = messages.find(m => m.id === req.params.id);
    if (!entry) {
      return res.status(404).json({ ok: false, error: "Message not found" });
    }
    entry.status = status;
    writeCollection(COLLECTION, messages);

    res.json({ ok: true, message: entry });
  });

  // Replies to the specific person who sent the message (entry.userId),
  // not the whole dealership — a real reply notification lands in
  // their own account's bell, and the reply text itself shows on their
  // own ContactSupport.tsx page via GET /support/my-messages above.
  app.post("/support/messages/:id/reply", requireAuth, requirePlatformAdmin, (req, res) => {
    const { reply } = req.body ?? {};
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(400).json({ ok: false, error: "Reply can't be empty" });
    }
    if (reply.length > 5000) {
      return res.status(400).json({ ok: false, error: "Reply is too long" });
    }

    const messages = readCollection<SupportMessage>(COLLECTION);
    const entry = messages.find(m => m.id === req.params.id);
    if (!entry) {
      return res.status(404).json({ ok: false, error: "Message not found" });
    }

    entry.adminReply = reply.trim();
    entry.adminReplyAt = new Date().toISOString();
    // A reply is the clearest possible signal the admin has actually
    // dealt with this — no separate "mark reviewed" click needed too.
    entry.status = "reviewed";
    writeCollection(COLLECTION, messages);

    notifyUser(
      entry.dealershipId,
      entry.userId,
      "FlipPilot Support replied",
      entry.adminReply.slice(0, 80) + (entry.adminReply.length > 80 ? "…" : "")
    );

    res.json({ ok: true, message: entry });
  });
}
