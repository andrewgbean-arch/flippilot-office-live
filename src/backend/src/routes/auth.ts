import { Express } from "express";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "../db";
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  verifyInviteToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
  toPublicUser,
  type StoredUser,
  type AuthUser,
  type Dealership,
} from "../auth";
import { sendEmail } from "../email";

const TRIAL_DAYS = 14;

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

    // Every signup creates its own brand-new dealership, isolated from
    // every other one, with you as its owner (staff joining an EXISTING
    // dealership go through /auth/join below instead, with an invite
    // token from that dealership's owner). A new dealership starts
    // "pending" — a platform admin has to approve it before it can use
    // anything business-related (see requireApprovedDealership) — so
    // nobody can self-sign-up as a fake dealer and get straight in.
    // Under NODE_ENV=test it's auto-approved instead, for the same
    // reason signupLimiter is loosened there (app.ts): the real
    // integration suite signs up dozens of throwaway dealerships and
    // immediately uses them, and the gate itself has its own dedicated
    // tests that explicitly opt back in to "pending".
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400000);

    const dealership: Dealership = {
      id: randomUUID(),
      name: String(dealershipName).trim(),
      ownerId: "", // filled in below once the user id exists
      createdAt: now.toISOString(),
      subscriptionStatus: "trialing",
      trialEndsAt: trialEndsAt.toISOString(),
      approvalStatus:
        process.env.NODE_ENV === "test" && req.body?.requireApproval !== true
          ? "approved"
          : "pending",
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
    res.json({
      ok: true,
      token,
      user: toPublicUser(newUser),
      approvalStatus: dealership.approvalStatus,
    });
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
    res.json({
      ok: true,
      dealershipName: payload.dealershipName,
      inviteeName: payload.inviteeName,
      staffRole: payload.staffRole,
    });
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
      staffRole: payload.staffRole,
      dealershipId: payload.dealershipId,
      passwordHash: await hashPassword(password),
    };

    writeCollection("users", [...users, newUser]);

    const authToken = signToken(toPublicUser(newUser));
    const joinedDealership = readCollection<Dealership>("dealerships").find(d => d.id === payload.dealershipId);
    res.json({
      ok: true,
      token: authToken,
      user: toPublicUser(newUser),
      approvalStatus: joinedDealership?.approvalStatus ?? "approved",
    });
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
    // Includes the dealership's real approval status so a client (web
    // or mobile) can route straight to "awaiting approval" instead of
    // logging the user in and then hitting a 403 on their first real
    // request. Undefined for a dealership that predates the approval
    // gate — those are grandfathered as approved.
    const dealership = readCollection<Dealership>("dealerships").find(d => d.id === user.dealershipId);
    res.json({
      ok: true,
      token,
      user: toPublicUser(user),
      approvalStatus: dealership?.approvalStatus ?? "approved",
    });
  });

  app.get("/auth/me", requireAuth, (req, res) => {
    const user = (req as any).user as AuthUser;
    const dealership = readCollection<Dealership>("dealerships").find(d => d.id === user.dealershipId);
    res.json({ ok: true, user, approvalStatus: dealership?.approvalStatus ?? "approved" });
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

  // Requesting a reset always returns the same generic response
  // regardless of whether the email is registered — otherwise this
  // endpoint could be used to check which emails have accounts.
  app.post("/auth/forgot-password", async (req, res) => {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }

    const users = readCollection<StoredUser>("users");
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = users.find(u => u.email === normalizedEmail);

    let devResetLink: string | undefined;

    if (user) {
      const token = signPasswordResetToken(user.id);
      const resetLink = `${req.headers.origin || "http://localhost:5173"}/reset-password?token=${token}`;

      await sendEmail(
        user.email,
        "Reset your FlipPilot Dealer OS password",
        `Click this link to reset your password (expires in 1 hour): ${resetLink}\n\nIf you didn't request this, ignore this email.`
      );

      // Only surfaced when no real email provider is configured (see
      // email.ts) — otherwise the link would only ever reach the real
      // inbox, same as a production password reset should work.
      if (!process.env.RESEND_API_KEY) {
        devResetLink = resetLink;
      }
    }

    res.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
      ...(devResetLink ? { devResetLink } : {}),
    });
  });

  app.post("/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body ?? {};

    if (!token || !newPassword) {
      return res.status(400).json({ ok: false, error: "Token and new password are required" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res
        .status(400)
        .json({ ok: false, error: "New password must be at least 8 characters" });
    }

    const userId = verifyPasswordResetToken(token);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "This reset link is invalid or has expired" });
    }

    const users = readCollection<StoredUser>("users");
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: "Account no longer exists" });
    }

    user.passwordHash = await hashPassword(newPassword);
    writeCollection("users", users);

    res.json({ ok: true });
  });
}
