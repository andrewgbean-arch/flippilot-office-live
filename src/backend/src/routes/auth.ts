import { Express } from "express";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "../db";
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  type StoredUser,
  type AuthUser,
} from "../auth";

function toPublicUser(user: StoredUser): AuthUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

export default function registerAuthRoute(app: Express) {
  app.post("/auth/signup", async (req, res) => {
    const { email, password, name } = req.body ?? {};

    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ ok: false, error: "Name, email and password are required" });
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

    // First account created becomes the owner; anyone signing up after
    // that is "staff" — there's no invite flow yet, so this is a simple
    // bootstrap rule, not real role management.
    const role: AuthUser["role"] = users.length === 0 ? "owner" : "staff";

    const newUser: StoredUser = {
      id: randomUUID(),
      email: normalizedEmail,
      name: String(name).trim(),
      role,
      passwordHash: await hashPassword(password),
    };

    writeCollection("users", [...users, newUser]);

    const token = signToken(toPublicUser(newUser));
    res.json({ ok: true, token, user: toPublicUser(newUser) });
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
}
