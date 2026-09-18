import { Express, Request, Response } from "express";
import {
  readCollection,
  writeCollection,
  readTenantCollection,
  writeTenantCollection,
} from "../db";
import {
  requireAuth,
  requireOwner,
  toPublicUser,
  VALID_STAFF_ROLES,
  type AuthUser,
  type StoredUser,
} from "../auth";
import { toDateKeyLocal, type Shift, type WorkPattern } from "./planner";

// jobs.ts stores whatever array the client PUTs and has no backend type
// of its own, so this is just the fields the cleanup below touches.
type StoredJob = {
  status?: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
} & Record<string, unknown>;

// What a removed person leaves behind that would keep causing WRONG
// behaviour if left alone — not everything they ever touched. Deleted:
// their work pattern (/shifts/generate loops over patterns, not current
// accounts, so it would keep scheduling them every week), their shifts
// from today onward (the rota would show someone who's gone working
// Monday), and their claim on open jobs (unassigned, so they surface as
// needing an owner rather than sitting with someone who can't act).
// Deliberately KEPT: timekeeping entries, past shifts, decided leave and
// finished jobs — those are records of work already done (pay, holiday
// entitlement, the job history), and each snapshots the person's name so
// it still reads correctly without a matching account.
export function releaseMemberFromTeamData(dealershipId: string, userId: string): void {
  const patterns = readTenantCollection<WorkPattern>(dealershipId, "workPatterns");
  const keptPatterns = patterns.filter(p => p.userId !== userId);
  if (keptPatterns.length !== patterns.length) {
    writeTenantCollection(dealershipId, "workPatterns", keptPatterns);
  }

  const today = toDateKeyLocal(new Date());
  const shifts = readTenantCollection<Shift>(dealershipId, "shifts");
  const keptShifts = shifts.filter(s => !(s.userId === userId && s.date >= today));
  if (keptShifts.length !== shifts.length) {
    writeTenantCollection(dealershipId, "shifts", keptShifts);
  }

  const jobs = readTenantCollection<StoredJob>(dealershipId, "jobs");
  let jobsChanged = false;
  const updatedJobs = jobs.map(job => {
    if (job.assignedToUserId !== userId || job.status === "done") return job;
    jobsChanged = true;
    return { ...job, assignedToUserId: null, assignedToName: null };
  });
  if (jobsChanged) {
    writeTenantCollection(dealershipId, "jobs", updatedJobs);
  }
}

// Shared by the owner-only routes below: finds the account being
// managed, or sends the error response itself and returns null.
function findManageableMember(
  req: Request,
  res: Response
): { users: StoredUser[]; target: StoredUser } | null {
  const caller = (req as Request & { user: AuthUser }).user;
  const users = readCollection<StoredUser>("users");
  const target = users.find(u => u.id === req.params.id && u.dealershipId === caller.dealershipId);

  // Same 404 for "no such id" and "an id from another dealership", so
  // ids can't be probed across tenants.
  if (!target) {
    res.status(404).json({ ok: false, error: "Team member not found" });
    return null;
  }

  // Every dealership has exactly one owner, and one with no owner can't
  // be recovered — this also means an owner can't remove themselves.
  if (target.role === "owner") {
    res.status(400).json({ ok: false, error: "The dealership owner can't be removed or have their role changed" });
    return null;
  }

  return { users, target };
}

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
      .map(u => toPublicUser(u));

    res.json({ ok: true, members });
  });

  // Owner-only team management. Deliberately under /dealership/team, not
  // /team: /team sits behind the approval and subscription gates (see
  // app.ts), but an owner must always be able to cut off a departing
  // employee — even with a lapsed trial — so these live beside
  // /dealership/invite, which has only requireAuth + requireOwner for the
  // same reason. Both take effect on the person's very next request,
  // because requireAuth reads the stored account every time rather than
  // trusting what their token says.
  app.put("/dealership/team/:id", requireAuth, requireOwner, (req, res) => {
    const found = findManageableMember(req, res);
    if (!found) return;

    const { staffRole } = req.body ?? {};
    if (!VALID_STAFF_ROLES.includes(staffRole)) {
      return res.status(400).json({
        ok: false,
        error: `staffRole must be one of: ${VALID_STAFF_ROLES.join(", ")}`,
      });
    }

    found.target.staffRole = staffRole;
    writeCollection("users", found.users);
    res.json({ ok: true, member: toPublicUser(found.target) });
  });

  app.delete("/dealership/team/:id", requireAuth, requireOwner, (req, res) => {
    const found = findManageableMember(req, res);
    if (!found) return;

    // Access is revoked first, and only then is their rota/job data
    // tidied — cutting them off must never depend on the cleanup
    // succeeding.
    writeCollection("users", found.users.filter(u => u.id !== found.target.id));
    releaseMemberFromTeamData(found.target.dealershipId, found.target.id);

    res.json({ ok: true });
  });
}
