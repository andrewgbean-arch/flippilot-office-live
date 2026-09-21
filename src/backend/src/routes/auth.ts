import { Express } from "express";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "../db";
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  verifyInviteToken,
  isInviteRevoked,
  signPasswordResetToken,
  verifyPasswordResetToken,
  resetTokenMatchesUser,
  toPublicUser,
  type StoredUser,
  type AuthUser,
  type Dealership,
  type InviteTokenPayload,
} from "../auth";
import { sendEmail } from "../email";
import { appLink } from "../appUrl";
import { takeResetEmailSlot } from "../resetRequestLimit";
import { trialEndsAtFrom } from "../trial";

const RESET_INVALID_MESSAGE = "This reset link is invalid or has expired";
const INVITE_INVALID_MESSAGE = "This invite link is invalid or has expired";
// Sent when the owner has cancelled the link — they removed someone, or
// moved someone to a lower role, after making it (see Dealership.inviteEpoch
// and team.ts). Says what to do next, since the person can't fix this
// themselves.
const INVITE_CANCELLED_MESSAGE =
  "This invite link has been cancelled. Ask the dealership owner for a new link.";

// Decides, from the dealership's CURRENT record, whether an invite that has
// already passed its signature check can still be used: null means yes,
// otherwise the message to send back with a 400. A dealership that no longer
// exists can't take anyone new; a cancelled link says so.
function inviteProblem(
  invite: InviteTokenPayload,
  dealership: Dealership | undefined
): string | null {
  if (!dealership) return INVITE_INVALID_MESSAGE;
  if (isInviteRevoked(invite, dealership)) return INVITE_CANCELLED_MESSAGE;
  return null;
}

function findDealership(id: string): Dealership | undefined {
  return readCollection<Dealership>("dealerships").find(d => d.id === id);
}

function emailInUse(normalizedEmail: string): boolean {
  return readCollection<StoredUser>("users").some(u => u.email === normalizedEmail);
}

// Four routes below write to the global `users` collection after a bcrypt
// hash (signup, join, change password, reset password), and a hash takes a
// good fraction of a second — long enough for other requests to run in the
// middle. The rule for all of them: do the slow awaited work FIRST, and only
// then read `users` fresh, change it and write it back, with no `await` in
// between. node:sqlite is synchronous, so that block cannot be interleaved
// with another request. Reading `users` BEFORE the hash and writing that old
// array back afterwards silently undoes whatever happened in the meantime:
// a removal, a role change, another signup.

// A JSON body can put an object, array, number or boolean where text is expected. Left
// alone, String(email) on {"toString":1} or bcrypt on an object throws inside an async
// handler (before asyncErrors.ts, that took the whole server down, from one anonymous
// request). Absent is fine (the existing "required" checks answer that); any other
// non-text value is refused up front.
const notText = (...values: unknown[]) => values.some((v) => v !== undefined && v !== null && typeof v !== "string");

export default function registerAuthRoute(app: Express) {
  app.post("/auth/signup", async (req, res) => {
    const { email, password, name, dealershipName } = req.body ?? {};
    if (notText(email, password, name, dealershipName)) return res.status(400).json({ ok: false, error: "Those details must be text." });

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

    const normalizedEmail = String(email).trim().toLowerCase();

    // A cheap early check, so an email that is plainly taken doesn't cost a
    // bcrypt hash. It is NOT the real guard — two signups for the same email
    // can both pass it — so the check is repeated on a fresh read below,
    // right before the write.
    if (emailInUse(normalizedEmail)) {
      return res
        .status(409)
        .json({ ok: false, error: "An account with that email already exists" });
    }

    // The slow, awaited part, done before `users` is read for writing.
    const passwordHash = await hashPassword(password);

    // From here to the response nothing awaits, so no other request can run
    // in between (see the note at the top of this file).
    const users = readCollection<StoredUser>("users");
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
    // Provisional: approval restarts the 14 days (see trial.ts), so a slow review
    // never uses up the trial. Under NODE_ENV=test the dealership is approved at
    // once, so this is the real date.
    const trialEndsAt = trialEndsAtFrom(now);

    const dealership: Dealership = {
      id: randomUUID(),
      name: String(dealershipName).trim(),
      ownerId: "", // filled in below once the user id exists
      createdAt: now.toISOString(),
      subscriptionStatus: "trialing",
      trialEndsAt,
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
      passwordHash,
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
      return res.status(400).json({ ok: false, error: INVITE_INVALID_MESSAGE });
    }
    // A link the owner has cancelled since making it fails here, before the
    // person fills in the form, not just at submit.
    const problem = inviteProblem(payload, findDealership(payload.dealershipId));
    if (problem) {
      return res.status(400).json({ ok: false, error: problem });
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
    if (notText(token, name, email, password)) return res.status(400).json({ ok: false, error: "Those details must be text." });

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
      return res.status(400).json({ ok: false, error: INVITE_INVALID_MESSAGE });
    }

    // A signed link is not enough: the owner may have cancelled it since
    // (removing someone cancels every link shared before it). Checked here,
    // before the bcrypt hash, so a cancelled link fails fast — and checked
    // AGAIN below, after the hash, because the owner can cancel it while the
    // hash is running.
    const earlyProblem = inviteProblem(payload, findDealership(payload.dealershipId));
    if (earlyProblem) {
      return res.status(400).json({ ok: false, error: earlyProblem });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Cheap early check only — the real one is repeated below on a fresh read.
    if (emailInUse(normalizedEmail)) {
      return res
        .status(409)
        .json({ ok: false, error: "An account with that email already exists" });
    }

    // The slow, awaited part, done before `users` is read for writing.
    const passwordHash = await hashPassword(password);

    // From here to the response nothing awaits, so no other request can run
    // in between (see the note at the top of this file).
    const joinedDealership = findDealership(payload.dealershipId);
    const problem = inviteProblem(payload, joinedDealership);
    if (problem) {
      return res.status(400).json({ ok: false, error: problem });
    }

    const users = readCollection<StoredUser>("users");
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
      passwordHash,
    };

    writeCollection("users", [...users, newUser]);

    const authToken = signToken(toPublicUser(newUser));
    res.json({
      ok: true,
      token: authToken,
      user: toPublicUser(newUser),
      approvalStatus: joinedDealership?.approvalStatus ?? "approved",
    });
  });

  app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (notText(email, password)) return res.status(400).json({ ok: false, error: "Those details must be text." });

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
    if (notText(currentPassword, newPassword)) return res.status(400).json({ ok: false, error: "Those details must be text." });

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

    const stored = readCollection<StoredUser>("users").find(u => u.id === authUser.id);

    if (!stored || !(await verifyPassword(currentPassword, stored.passwordHash))) {
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }

    // Both slow, awaited steps are finished before `users` is read for
    // writing (see the note at the top of this file).
    const newPasswordHash = await hashPassword(newPassword);

    // From here to the response nothing awaits. The account is looked up
    // again on this fresh read, and only ITS password changes: if the owner
    // removed this person while the hashing ran they must stay removed
    // (401, like requireAuth gives), and a role change made in the meantime
    // must not be undone.
    const users = readCollection<StoredUser>("users");
    const user = users.find(u => u.id === authUser.id);
    if (!user) {
      return res.status(401).json({ ok: false, error: "Invalid or expired session" });
    }
    user.passwordHash = newPasswordHash;
    writeCollection("users", users);

    res.json({ ok: true });
  });

  // Requesting a reset always returns the same generic response
  // regardless of whether the email is registered — otherwise this
  // endpoint could be used to check which emails have accounts.
  //
  // The link in the email is built from the server's own configured web address
  // (appUrl.ts), never from a request header: the Origin header is chosen by
  // whoever calls this route, and taking it would let an attacker have a real
  // reset email for the victim carry a valid token to the attacker's own site.
  //
  // The link is NEVER put in this reply, except under NODE_ENV=test, where the
  // tests need it. Handing it back whenever no email provider was set up meant
  // that anyone who knew a dealer's email address could take over the account.
  app.post("/auth/forgot-password", async (req, res) => {
    const { email } = req.body ?? {};
    if (notText(email)) return res.status(400).json({ ok: false, error: "Those details must be text." });
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }

    const users = readCollection<StoredUser>("users");
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = users.find(u => u.email === normalizedEmail);

    let devResetLink: string | undefined;

    // An account already over its hourly allowance gets the same generic reply
    // below, with no email sent (see resetRequestLimit.ts).
    if (user && takeResetEmailSlot(user.email)) {
      const token = signPasswordResetToken(user);
      const resetLink = appLink(`/reset-password?token=${token}`);

      if (!process.env.RESEND_API_KEY) {
        // Nothing can actually deliver this email. Say so where the operator can
        // see it, and (see the note above the route) never hand the link to the
        // caller.
        console.error(
          "forgot-password: RESEND_API_KEY is not set, so no reset email can be delivered. Set it on the server. The reset link is deliberately not returned to the caller."
        );
        if (process.env.NODE_ENV === "test") devResetLink = resetLink;
      }

      await sendEmail(
        user.email,
        "Reset your FlipPilot Dealer OS password",
        `Click this link to reset your password (expires in 1 hour): ${resetLink}\n\nIf you didn't request this, ignore this email.`
      );
    }

    res.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
      ...(devResetLink ? { devResetLink } : {}),
    });
  });

  app.post("/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body ?? {};
    if (notText(token, newPassword)) return res.status(400).json({ ok: false, error: "Those details must be text." });

    if (!token || !newPassword) {
      return res.status(400).json({ ok: false, error: "Token and new password are required" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res
        .status(400)
        .json({ ok: false, error: "New password must be at least 8 characters" });
    }

    const claims = verifyPasswordResetToken(token);
    if (!claims) {
      return res.status(400).json({ ok: false, error: RESET_INVALID_MESSAGE });
    }

    // Fail fast, before the bcrypt hash, if the account is already gone, or the
    // password has changed since this link was made (the link has been used, or
    // an older one has been superseded).
    const early = readCollection<StoredUser>("users").find(u => u.id === claims.userId);
    if (!early) {
      return res.status(404).json({ ok: false, error: "Account no longer exists" });
    }
    if (!resetTokenMatchesUser(claims, early)) {
      return res.status(400).json({ ok: false, error: RESET_INVALID_MESSAGE });
    }

    // The slow, awaited part, done before `users` is read for writing (see
    // the note at the top of this file).
    const newPasswordHash = await hashPassword(newPassword);

    // From here to the response nothing awaits. The account is looked up
    // again on this fresh read: if it was removed while the hash ran it
    // must stay removed (404, as above), not be written back. The link is
    // checked AGAIN here, because two requests with the same link can both
    // pass the early check while their hashes run: the first to reach this
    // point changes the password, and the second must then be refused.
    const users = readCollection<StoredUser>("users");
    const user = users.find(u => u.id === claims.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: "Account no longer exists" });
    }
    if (!resetTokenMatchesUser(claims, user)) {
      return res.status(400).json({ ok: false, error: RESET_INVALID_MESSAGE });
    }
    user.passwordHash = newPasswordHash;
    writeCollection("users", users);

    res.json({ ok: true });
  });
}
