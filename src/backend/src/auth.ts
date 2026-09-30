import bcrypt from "bcryptjs";
import { phoneMayUse } from "./phoneScope";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { isSessionRevoked, readCollection } from "./db";
import { runAsActor } from "./requestActor";

const TOKEN_TTL = "7d";

// Read at call time, not module load time — a module-level `const` here
// would freeze as undefined forever if this file is ever imported (even
// transitively) before dotenv.config() runs, regardless of what's
// actually in .env. Bit this exact bug earlier in this session with the
// eBay integration in the sibling flippilotlatest project.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in backend/.env");
  }
  return secret;
}

// Which feature areas a staff account can use — only meaningful when
// role is "staff"; an owner always has full access regardless. Chosen
// by the owner at invite time (see /dealership/invite), replacing the
// old PermissionsManager checkboxes that toggled a `permissions`
// array on a StaffRecord (an HR-directory entry) that was never
// actually linked to any real login account, so nothing anywhere ever
// checked it — this is the first version of "staff permissions" that
// is actually tied to the account a person logs in with.
export type StaffRole = "sales" | "finance" | "manager" | "general";

export const VALID_STAFF_ROLES: StaffRole[] = ["sales", "finance", "manager", "general"];

// Where each staff role sits, lowest to highest. Used for ONE decision only:
// telling a step down (which must cancel the invite links already shared,
// see isStaffRoleDemotion) from a step up or no change. manager gates the
// most on the server and finance opens bookkeeping writes (requireStaffRole
// call sites); sales sits above general, the view-only tier. Nothing else
// should rank roles with this.
const STAFF_ROLE_LEVEL: Record<StaffRole, number> = {
  general: 0,
  sales: 1,
  finance: 2,
  manager: 3,
};

// Moving someone to a lower role has to cancel every invite link already
// shared, because a link isn't tied to an email address: the person just
// demoted could use any still-live link carrying their old role to create
// a second account with it. A step up, or no change, gives them nothing they
// couldn't already get, so it leaves other people's pending links alone.
// An account with no staffRole at all counts as general, as it does in
// requireStaffRole.
export function isStaffRoleDemotion(from: StaffRole | undefined, to: StaffRole): boolean {
  return STAFF_ROLE_LEVEL[to] < STAFF_ROLE_LEVEL[from ?? "general"];
}

// A generous safety cap, not a real seat/billing limit yet (a future Stripe
// seat model would be its own, separate thing) — this exists to stop
// runaway account creation (a compromised owner account, or a careless
// invite-link habit) rather than to constrain a genuinely large dealership.
// 20 real staff logins is well above what a typical independent used-car
// dealer's whole team needs.
export const MAX_STAFF_ACCOUNTS = 20;

// The owner isn't counted — this caps STAFF headcount, and every dealership
// always has exactly one owner regardless.
export function staffAccountCount(dealershipId: string): number {
  return readCollection<{ dealershipId: string; role: string }>("users").filter(
    u => u.dealershipId === dealershipId && u.role === "staff"
  ).length;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "staff";
  staffRole?: StaffRole;
  dealershipId: string;
  // Whether the OWNER has switched off THIS person's use of Pilot Brain
  // (subscriptionGate.ts). Absent/undefined means allowed — every account
  // made before this existed keeps working exactly as it did. Never set on
  // an owner account; requirePilotBrainAccess never checks it for one.
  pilotBrainAllowed?: boolean;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
}

// The stored account minus its password hash — the only shape that's
// ever safe to attach to a request or send to a client.
export function toPublicUser(user: StoredUser): AuthUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Dealership {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  // The Subscription Schedule managing the 6-month settling-in price before
  // it steps up to the standard price (routes/billing.ts) — set once, right
  // after the subscription is first created. Not itself read for anything
  // yet (pilotBrainEnabled/subscriptionStatus already carry what the app
  // needs), kept for reference if a schedule ever needs looking up by hand.
  stripeScheduleId?: string;
  // When this dealership's CURRENT subscription started — set once, only by
  // the checkout webhook's first "checkout.session.completed" (never
  // touched by a later renewal/update event), so it marks the real start of
  // the 6-month settling-in price rather than drifting on every Stripe
  // event. Used to tell the dealer when their price is due to rise.
  subscribedAt?: string;
  // Whether this dealership is on the "Dealer OS + Pilot Brain" plan — set
  // from the actual Stripe subscription items (never just trusted from
  // checkout intent), so it stays accurate if the dealer changes plan later
  // via the billing portal. Undefined for a dealership that's never
  // subscribed at all. Despite the name this is a whole PLAN choice, not an
  // add-on bolted onto a shared core price — the two plans are priced as
  // their own thing (see PlanId in routes/billing.ts).
  pilotBrainEnabled?: boolean;
  phone?: string;
  address?: string;
  // Shown on customer invoices when set. Optional — not every dealer
  // is VAT-registered (below the threshold, or a sole trader), and an
  // invoice with no VAT number is legitimate; it just can't be called
  // a "VAT Invoice".
  vatNumber?: string;
  // Manual vetting gate for brand-new dealership signups — a fresh
  // signup starts "pending" and can't use anything business-related
  // until a platform admin approves it (see requireApprovedDealership
  // in subscriptionGate.ts). Deliberately optional and only ever
  // blocked on an explicit "pending": every dealership that existed
  // before this field was added has no value here at all, and must
  // keep working exactly as before rather than being locked out by a
  // check that demanded a positive "approved".
  approvalStatus?: "pending" | "approved";
  // Which generation of invite links is still good for this dealership.
  // Every link carries the number that was current when the owner made it
  // (InviteTokenPayload.inviteEpoch), and /auth/join refuses one that
  // carries a lower number. Removing a teammate, or moving one to a lower
  // role, adds 1 — which cancels every link shared up to that moment in
  // one go, without touching links made afterwards. Deliberately a counter
  // and not a "valid from" time: a token's issue time only has whole-second
  // resolution, so a link made in the same second as a removal could not be
  // told apart from one made just before it. Undefined (every dealership
  // that predates this) means 0, so old dealerships and the links already
  // out there keep working until the first removal.
  inviteEpoch?: number;
  // Sign everyone out of Dealer OS after this many minutes with no mouse,
  // keyboard or touch (the web app's IdleSignOut), so a computer left signed
  // in on the showroom floor can't be used by whoever walks up to it. The
  // owner picks it in Settings; 0 = never. Unset means the web app's default
  // (15 minutes, src/lib/idleSignOut.ts), so it is on unless turned off.
  autoSignOutMinutes?: number;
  // Secret query-string token gating GET /syndication/:dealershipId/feed.csv
  // (syndication.ts) — that feed carries fields (advert description, VAT
  // scheme, condition, every photo) beyond what the genuinely public
  // storefront/passport show, so it can't rely on dealershipId alone being
  // hard to find (it's the same id embedded in the public /store/:id link).
  // Generated lazily on first use by getOrCreateSyndicationToken, not at
  // signup, so existing dealerships pick one up the first time anyone opens
  // Marketplace Sync rather than needing a migration.
  syndicationFeedToken?: string;
}

// What the owner may choose for Dealership.autoSignOutMinutes (0 = off).
export const AUTO_SIGN_OUT_CHOICES: readonly number[] = [0, 15, 30, 60];

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// `scope` "phone" marks a login made by the staff phone app, which only
// reaches the addresses that app uses (phoneScope.ts). No scope = a full login.
//
// `pwv` stamps the token with the account's password as it is right now
// (sessionPasswordStamp). When the password changes or is reset, every login
// made before that stops working (requireAuth), so a phone or laptop someone
// else had signed in on is logged out, not left in for up to 7 days.
//
// `jti` gives each login its own id, so "Log out" can cancel that one login
// on the server (POST /auth/logout, revokeSession) and leave the same
// person's other devices signed in.
export function signToken(user: AuthUser, scope?: "phone"): string {
  const stored = readCollection<StoredUser>("users").find(u => u.id === user.id);
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      ...(user.staffRole ? { staffRole: user.staffRole } : {}),
      dealershipId: user.dealershipId,
      ...(scope ? { scope } : {}),
      ...(stored ? { pwv: sessionPasswordStamp(stored.passwordHash) } : {}),
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL, jwtid: randomUUID() }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser & { purpose?: string };
    // Tokens signed before multi-tenancy was added won't have a
    // dealershipId — treat those as invalid so the user is forced to
    // log in again and get a token that actually scopes their data,
    // rather than silently hitting undefined dealershipId everywhere.
    if (!decoded.dealershipId) return null;
    // Real login tokens (signToken, above) never carry a `purpose`
    // claim — only the single-purpose invite/password-reset tokens do,
    // and a dealer-invite token also happens to carry a real
    // dealershipId (it needs one), which let it slip past the check
    // above and be accepted here as a genuine login session — a real
    // auth bypass a security review caught: anyone who got hold of a
    // shared invite link could use it directly against every real
    // data route for its full 7-day validity, without ever actually
    // signing up. `id`/`email` are required too since genuine session
    // tokens always have both and no single-purpose token ever does.
    if ("purpose" in decoded || !decoded.id || !decoded.email) return null;
    return decoded;
  } catch {
    return null;
  }
}

export interface InviteTokenPayload {
  purpose: "dealer-invite";
  dealershipId: string;
  dealershipName: string;
  role: "staff";
  staffRole: StaffRole;
  inviteeName?: string;
  // The dealership's Dealership.inviteEpoch at the moment this link was
  // made. Links made before this field existed don't have it, and count
  // as 0.
  inviteEpoch?: number;
}

// Lets an owner invite a real teammate into their EXISTING dealership —
// previously every signup created a brand-new, isolated dealership with
// no way to add a second person to one at all. This token is a
// short-lived, single-purpose JWT (not a login session token — verified
// separately via verifyInviteToken, never accepted by requireAuth)
// carrying just enough to let /auth/join create a properly-scoped
// account without ever trusting client-supplied dealership IDs.
export function signInviteToken(payload: Omit<InviteTokenPayload, "purpose">): string {
  return jwt.sign(
    { purpose: "dealer-invite", ...payload },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export function verifyInviteToken(token: string): InviteTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as InviteTokenPayload;
    if (decoded.purpose !== "dealer-invite") return null;
    return decoded;
  } catch {
    return null;
  }
}

// True when the owner has cancelled this link since making it: the
// dealership's inviteEpoch has moved on past the one the link was made
// under. Only two counters are compared — no clock is involved, so a link
// made in the same second as a removal (before or after it) is judged
// correctly. A link with no epoch, or a dealership with none, counts as 0.
export function isInviteRevoked(
  invite: Pick<InviteTokenPayload, "inviteEpoch">,
  dealership: Pick<Dealership, "inviteEpoch">
): boolean {
  return (invite.inviteEpoch ?? 0) < (dealership.inviteEpoch ?? 0);
}

// A first, real use of the owner/staff role split that already existed
// on every account — nothing previously checked it anywhere.
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user: AuthUser }).user;
  if (user.role !== "owner") {
    return res.status(403).json({ ok: false, error: "Only the dealership owner can do this" });
  }
  next();
}

// Gates an action to specific staff roles — the owner always passes
// regardless of the list, same as requireOwner is always satisfied by
// the owner. A staff account with no staffRole set (accounts created
// before this existed) is treated as "general", the most restrictive
// non-owner tier, rather than silently granted access.
export function requireStaffRole(...allowed: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user: AuthUser }).user;
    if (user.role === "owner") return next();

    const staffRole = user.staffRole ?? "general";
    if (!allowed.includes(staffRole)) {
      return res.status(403).json({
        ok: false,
        error: `Your account role (${staffRole}) doesn't have access to this.`,
      });
    }
    next();
  };
}

interface PasswordResetPayload {
  purpose: "password-reset";
  userId: string;
  // A short fingerprint of the password the account had when the token was made
  // (see passwordFingerprint). Tokens made before this existed have none, and are
  // refused.
  fp?: string;
}

// The login-token version of passwordFingerprint, under its own label so a
// value taken from one kind of token is no use in the other.
export function sessionPasswordStamp(passwordHash: string): string {
  return createHmac("sha256", getJwtSecret()).update(`session-password:${passwordHash}`).digest("hex").slice(0, 32);
}

// A short, one-way fingerprint of the account's CURRENT password hash. A reset
// token carries it, and /auth/reset-password compares it with the account's
// hash at that moment, so the token stops working the instant the password
// changes: it is single-use, and any older token dies too. It is keyed with the
// server secret, so the token (whose payload anyone holding it can read) reveals
// nothing about the stored hash, and nobody can work out the value for another
// hash without the secret.
export function passwordFingerprint(passwordHash: string): string {
  return createHmac("sha256", getJwtSecret())
    .update(`password-reset-fingerprint:${passwordHash}`)
    .digest("hex")
    .slice(0, 32);
}

// Short-lived (1 hour), single-purpose token — same separation-of-
// concerns reasoning as the invite token: never accepted by requireAuth,
// never usable for anything except calling /auth/reset-password. It is tied to
// the password the account has right now, so once that password changes (by this
// reset, a change from Settings, or another reset) the token is dead.
export function signPasswordResetToken(user: Pick<StoredUser, "id" | "passwordHash">): string {
  return jwt.sign(
    { purpose: "password-reset", userId: user.id, fp: passwordFingerprint(user.passwordHash) },
    getJwtSecret(),
    { expiresIn: "1h" }
  );
}

export interface PasswordResetClaims {
  userId: string;
  fingerprint: string;
}

// The signature, purpose, expiry and shape are checked here. Whether the token
// is still good for the account as it is NOW is a separate question, answered by
// resetTokenMatchesUser once the account has been read.
export function verifyPasswordResetToken(token: string): PasswordResetClaims | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as PasswordResetPayload;
    if (decoded.purpose !== "password-reset") return null;
    if (typeof decoded.userId !== "string" || !decoded.userId) return null;
    if (typeof decoded.fp !== "string" || !decoded.fp) return null;
    return { userId: decoded.userId, fingerprint: decoded.fp };
  } catch {
    return null;
  }
}

// True only while the account still has the password it had when the token was
// made.
export function resetTokenMatchesUser(
  claims: PasswordResetClaims,
  user: Pick<StoredUser, "id" | "passwordHash">
): boolean {
  if (claims.userId !== user.id) return false;
  const expected = Buffer.from(passwordFingerprint(user.passwordHash));
  const given = Buffer.from(claims.fingerprint);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Attaches req.user when a valid token is present, and rejects with 401
// otherwise. Every real data route (inventory/leads/staff) uses this —
// previously those endpoints had zero access control, so anyone who
// found the URL could read or overwrite the dealer's data.
//
// A valid signature only proves this server issued the token at some
// point in the last 7 days — not that the account still exists, or
// still has the access it had then. Trusting the token's baked-in
// claims meant an employee the owner removed kept full access to that
// dealership's leads/customers/bookkeeping until their token expired,
// and a role change (manager demoted to sales) did nothing until the
// person happened to log in again. So the token is used only to say
// WHICH account this is; who they are right now (role, staffRole,
// dealershipId) always comes from the stored user. One `users` read per
// request — fine at current scale; cache it if that ever shows up in
// profiling, but a cache would reintroduce a window where a removed
// account still works, so it'd need explicit invalidation on every
// users write.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }

  const claims = verifyToken(token);
  if (!claims) {
    return res.status(401).json({ ok: false, error: "Invalid or expired session" });
  }

  // This login was logged out (POST /auth/logout). Logins made before they
  // carried an id can't be picked out, and run out on their own within 7 days.
  const sid = (claims as { jti?: unknown }).jti;
  if (typeof sid === "string" && isSessionRevoked(sid)) {
    return res.status(401).json({ ok: false, error: "Invalid or expired session" });
  }

  const stored = readCollection<StoredUser>("users").find(u => u.id === claims.id);
  if (!stored) {
    // Same message as a bad/expired token on purpose — don't tell the
    // caller which of the two it was.
    return res.status(401).json({ ok: false, error: "Invalid or expired session" });
  }

  // The password has changed since this login was made (see signToken).
  // Logins made before the stamp existed carry none and run out on their own
  // within 7 days, rather than logging every dealer out at once.
  const stamp = (claims as { pwv?: unknown }).pwv;
  if (stamp !== undefined && stamp !== sessionPasswordStamp(stored.passwordHash)) {
    return res.status(401).json({ ok: false, error: "Your password was changed. Please log in again." });
  }

  // A phone-app login only reaches what the phone app uses (phoneScope.ts).
  if ((claims as { scope?: unknown }).scope === "phone" && !phoneMayUse(req.method, req.originalUrl)) {
    return res.status(403).json({ ok: false, error: "That isn't available from the phone app. Please use Dealer OS on a computer." });
  }

  const user = toPublicUser(stored);
  (req as Request & { user: AuthUser }).user = user;
  // Kept so a route that hands out a fresh login (a password change) gives
  // the same kind back.
  if ((claims as { scope?: unknown }).scope === "phone") res.locals.tokenScope = "phone";
  // The rest of the request runs as this person, so whatever it saves is put in
  // the change history under their name (changeHistory.ts).
  runAsActor({ id: user.id, name: user.name, role: user.role, ...(user.staffRole ? { staffRole: user.staffRole } : {}) }, next);
}

// Gates the cross-dealership support inbox to whoever actually runs
// FlipPilot, not any dealership owner — "owner" only means "owns this
// one dealership's account", real platform-admin access needs to be a
// separate, narrower check. Identifies the platform admin by email
// against ADMIN_EMAIL (set in backend/.env) rather than a role stored
// on the user record, so it can never be granted by anything a
// dealer-facing flow (signup, invite, join) touches.
export function isPlatformAdmin(user: AuthUser): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return Boolean(adminEmail) && user.email.toLowerCase() === adminEmail!.toLowerCase();
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user: AuthUser }).user;
  if (!isPlatformAdmin(user)) {
    return res.status(403).json({ ok: false, error: "Not authorized" });
  }
  next();
}
