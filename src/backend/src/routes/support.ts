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
}

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
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

    // Real cross-account delivery, same mechanism the public booking
    // flow already uses to notify a dealership's own staff — here the
    // one recipient is whoever's account matches ADMIN_EMAIL, so this
    // shows up in their existing notification bell rather than
    // needing a dealer to remember to check the Support Inbox page.
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const admin = readCollection<StoredUser>("users").find(
        u => u.email.toLowerCase() === adminEmail.toLowerCase()
      );
      if (admin) {
        const adminNotifications = readTenantCollection<any>(admin.dealershipId, "notifications");
        writeTenantCollection(admin.dealershipId, "notifications", [
          ...adminNotifications,
          {
            id: randomUUID(),
            userId: admin.id,
            title: "New support message",
            message: `${entry.dealershipName} — ${entry.message.slice(0, 80)}${entry.message.length > 80 ? "…" : ""}`,
            type: "info" as const,
            createdAt: entry.createdAt,
            readAt: null,
          },
        ]);
      }
    }

    res.json({ ok: true, message: entry });
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
}
