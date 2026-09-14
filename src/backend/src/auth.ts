import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const TOKEN_TTL = "7d";

// Read at call time, not module load time — a module-level `const` here
// would freeze as undefined forever if this file is ever imported (even
// transitively) before dotenv.config() runs, regardless of what's
// actually in .env. Bit this exact bug earlier in this session with the
// eBay integration in the sibling flippilotlatest project.
function getJwtSecret(): string {
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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "staff";
  staffRole?: StaffRole;
  dealershipId: string;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
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
  phone?: string;
  address?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      ...(user.staffRole ? { staffRole: user.staffRole } : {}),
      dealershipId: user.dealershipId,
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    // Tokens signed before multi-tenancy was added won't have a
    // dealershipId — treat those as invalid so the user is forced to
    // log in again and get a token that actually scopes their data,
    // rather than silently hitting undefined dealershipId everywhere.
    if (!decoded.dealershipId) return null;
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
}

// Short-lived (1 hour), single-purpose token — same separation-of-
// concerns reasoning as the invite token: never accepted by requireAuth,
// never usable for anything except calling /auth/reset-password once.
export function signPasswordResetToken(userId: string): string {
  return jwt.sign(
    { purpose: "password-reset", userId },
    getJwtSecret(),
    { expiresIn: "1h" }
  );
}

export function verifyPasswordResetToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as PasswordResetPayload;
    if (decoded.purpose !== "password-reset") return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

// Attaches req.user when a valid token is present, and rejects with 401
// otherwise. Every real data route (inventory/leads/staff) uses this —
// previously those endpoints had zero access control, so anyone who
// found the URL could read or overwrite the dealer's data.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ ok: false, error: "Invalid or expired session" });
  }

  (req as Request & { user: AuthUser }).user = user;
  next();
}
