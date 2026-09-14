import { Express, Request } from "express";
import { readCollection } from "../db";
import type { AuthUser, StoredUser } from "../auth";

// Lists the real login-capable accounts in the current dealership —
// the actual people jobs can be assigned to. Distinct from /staff,
// which is a separate HR-directory-style record (name/branch/NI
// number/permissions checkboxes) never linked to a real login account
// at all — this reads the real `users` collection instead, scoped to
// the caller's own dealershipId, with passwordHash stripped.
export default function registerTeamRoute(app: Express) {
  app.get("/team", (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const users = readCollection<StoredUser>("users");

    const members = users
      .filter(u => u.dealershipId === user.dealershipId)
      .map(({ passwordHash, ...publicUser }) => publicUser);

    res.json({ ok: true, members });
  });
}
