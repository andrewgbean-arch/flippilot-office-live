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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "staff";
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
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
    { id: user.id, email: user.email, name: user.name, role: user.role },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthUser;
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
