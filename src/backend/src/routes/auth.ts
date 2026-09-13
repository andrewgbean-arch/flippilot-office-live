import { Express } from "express";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "../db";
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  verifyInviteToken,
  type StoredUser,
  type AuthUser,
  type Dealership,
} from "../auth";

const TRIAL_DAYS = 14;

function toPublicUser(user: StoredUser): AuthUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

export default function registerAuthRoute(app: Express) {
  app.post("/auth/signup", async (req, res) => {
    const { email, password, name, dealershipName } = req.body ?? {};

    if (!email || !password || !name || !dealershipName) {
      return res.status(400).json({
        ok: false,
        error: "Name, dealership name, email and password are required",
      });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ ok: false, error: "Password must be at least 8 characters" });
    }

    const users = readCollection<StoredUser>("users");
    const normalizedEmail = String(email).trim().toLowerCase();

    if (users.some(u => u.email === normalizedEmail)) {
      return res
        .status(409)
        .json({ ok: false, error: "An account with that email already exists" });
    }

    // Every signup creates its own dealership, isolated from every other
    // one — there's no "join an existing dealership" invite flow yet, so
    // this is the whole tenant-creation story for now: sign up = you're
    // the owner of a brand new dealership, with your own inventory/
    // leads/staff data that no one else can see.
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400000);

    const dealership: Dealership = {
      id: randomUUID(),
      name: String(dealershipName).trim(),
      ownerId: "", // filled in below once the user id exists
      createdAt: now.toISOString(),
      subscriptionStatus: "trialing",
      trialEndsAt: trialEndsAt.toISOString(),
    };

    const newUser: StoredUser = {
      id: randomUUID(),
      email: normalizedEmail,
      name: String(name).trim(),
      role: "owner",
      dealershipId: dealership.id,
      passwordHash: await hashPassword(password),
    };

    dealership.ownerId = newUser.id;

    const dealerships = readCollection<Dealership>("dealerships");
    writeCollection("dealerships", [...dealerships, dealership]);
    writeCollection("users", [...users, newUser]);

    const token = signToken(toPublicUser(newUser));
    res.json({ ok: true, token, user: toPublicUser(newUser) });
  });

  // Looks up what dealership an invite link points to, so the Join
  // screen can show "You're joining Bean Motors" before asking for a
  // password — and so a dead/expired link fails fast with a clear
  // error instead of just at final submit.
  app.get("/auth/invite/:token", (req, res) => {
    const payload = verifyInviteToken(req.params.token);
    if (!payload) {
      return res.status(400).json({ ok: false, error: "This invite link is invalid or has expired" });
    }
    res.json({ ok: true, dealershipName: payload.dealershipName, inviteeName: payload.inviteeName });
  });

  // Creates a real account inside an EXISTING dealership from an invite
  // link — the only way, before this, to add a second person to a
  // dealership was for them to sign up and get their own brand-new
  // isolated one instead.
  app.post("/auth/join", async (req, res) => {
    const { token, name, email, password } = req.body ?? {};

    if (!token || !name || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Name, email, password and an invite link are required",
      });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ ok: false, error: "Password must be at least 8 characters" });
    }

    const payload = verifyInviteToken(token);
    if (!payload) {
      return res.status(400).json({ ok: false, error: "This invite link is invalid or has expired" });
    }

    const users = readCollection<StoredUser>("users");
    const normalizedEmail = String(email).trim().toLowerCase();

    if (users.some(u => u.email === normalizedEmail)) {
      return res
        .status(409)
        .json({ ok: false, error: "An account with that email already exists" });
    }

    const newUser: StoredUser = {
      id: randomUUID(),
      email: normalizedEmail,
      name: String(name).trim(),
      role: payload.role,
      dealershipId: payload.dealershipId,
      passwordHash: await hashPassword(password),
    };

    writeCollection("users", [...users, newUser]);

    const authToken = signToken(toPublicUser(newUser));
    res.json({ ok: true, token: authToken, user: toPublicUser(newUser) });
  });

  app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "Email and password are required" });
    }

    const users = readCollection<StoredUser>("users");
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = users.find(u => u.email === normalizedEmail);

    // Same error for "no such user" and "wrong password" — don't leak
    // which one it was.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ ok: false, error: "Invalid email or password" });
    }

    const token = signToken(toPublicUser(user));
    res.json({ ok: true, token, user: toPublicUser(user) });
  });

  app.get("/auth/me", requireAuth, (req, res) => {
    const user = (req as any).user as AuthUser;
    res.json({ ok: true, user });
  });

  // "Security Options" in Settings previously had no onClick at all.
  // This is a real change-password flow for a logged-in user — not a
  // password-reset flow (that needs email delivery, which this app
  // doesn't have set up yet).
  app.put("/auth/password", requireAuth, async (req, res) => {
    const authUser = (req as any).user as AuthUser;
    const { currentPassword, newPassword } = req.body ?? {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: "Current and new password are required",
      });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res
        .status(400)
        .json({ ok: false, error: "New password must be at least 8 characters" });
    }

    const users = readCollection<StoredUser>("users");
    const user = users.find(u => u.id === authUser.id);

    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }

    user.passwordHash = await hashPassword(newPassword);
    writeCollection("users", users);

    res.json({ ok: true });
  });
}
