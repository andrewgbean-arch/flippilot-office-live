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
  requireStaffRole,
  toPublicUser,
  VALID_STAFF_ROLES,
  isStaffRoleDemotion,
  type AuthUser,
  type Dealership,
  type StoredUser,
} from "../auth";
import { toDateKeyLocal, type Shift, type WorkPattern } from "./planner";
import { RATES_COLLECTION, type PayRate } from "./pay";
import { recordEvent } from "../changeHistory";
import { erasePrivateDataOf } from "../personalData";

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
// Monday), their claim on open jobs (unassigned, so they surface as
// needing an owner rather than sitting with someone who can't act), and
// their hourly pay rate (pay.ts's payRates — a live setting for a current
// employee, not a record of anything, so it has nothing to preserve; left
// in place it would just be a dead row matching nobody real).
// Deliberately KEPT: timekeeping entries, past shifts, decided leave and
// finished jobs — those are records of work already done (pay, holiday
// entitlement, the job history), and each snapshots the person's name so
// it still reads correctly without a matching account. What only they could
// see (diary, notifications, Pilot Brain) is erased separately, by
// erasePrivateDataOf (personalData.ts).
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

  const rates = readTenantCollection<PayRate>(dealershipId, RATES_COLLECTION);
  const keptRates = rates.filter(r => r.userId !== userId);
  if (keptRates.length !== rates.length) {
    writeTenantCollection(dealershipId, RATES_COLLECTION, keptRates);
  }
}

// Adds 1 to the dealership's inviteEpoch, which cancels every invite link
// shared up to this moment (see Dealership.inviteEpoch) and leaves any made
// afterwards alone. Run when someone is removed, or moved to a lower role:
// a link isn't tied to an email address, so without this the person could
// walk straight back in — or make a second account with the role they just
// lost — using a link they already hold. Synchronous read-then-write, like
// the rest of this file, so nothing can slip in between. A dealership that
// no longer exists has nothing to cancel.
function cancelSharedInviteLinks(dealershipId: string): void {
  const dealerships = readCollection<Dealership>("dealerships");
  const dealership = dealerships.find(d => d.id === dealershipId);
  if (!dealership) return;
  dealership.inviteEpoch = (dealership.inviteEpoch ?? 0) + 1;
  writeCollection("dealerships", dealerships);
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

  // Team management. Deliberately under /dealership/team, not /team: /team
  // sits behind the approval and subscription gates (see app.ts), but a
  // departing employee must always be cuttable off — even with a lapsed
  // trial — so these live beside /dealership/invite, which has only
  // requireAuth + requireOwner for the same reason. Changing a role and the
  // Pilot Brain switch stay owner-only (they decide what someone can see and
  // spend); removing someone is also a manager's call, same trust level as
  // the rest of managers' HR powers (staff.ts). Every route here takes
  // effect on the person's very next request, because requireAuth reads the
  // stored account every time rather than trusting what their token says.
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

    // Links are cancelled BEFORE the role is written, so a failure part-way
    // can only leave the links cancelled and the role unchanged (the owner
    // tries again), never a lower role with the old links still working.
    if (isStaffRoleDemotion(found.target.staffRole, staffRole)) {
      cancelSharedInviteLinks(found.target.dealershipId);
    }
    const oldRole = found.target.staffRole;
    found.target.staffRole = staffRole;
    writeCollection("users", found.users);
    if (oldRole !== staffRole) {
      recordEvent(found.target.dealershipId, "Team", found.target.name, [{ field: "role", before: oldRole ?? "staff", after: staffRole }], {
        recordId: found.target.id,
        action: "changed",
      });
    }
    res.json({ ok: true, member: toPublicUser(found.target) });
  });

  // Whether THIS person may use Pilot Brain at all, separate from their
  // staffRole — the owner may want a general/sales account to have full
  // stock access but never touch the dealership's usage credit (see
  // pilotBrainCredit.ts). Its own route, not folded into the role PUT above,
  // so toggling it never risks resending (and so accidentally changing) the
  // person's role.
  app.put("/dealership/team/:id/pilot-brain-access", requireAuth, requireOwner, (req, res) => {
    const found = findManageableMember(req, res);
    if (!found) return;

    const { allowed } = req.body ?? {};
    if (typeof allowed !== "boolean") {
      return res.status(400).json({ ok: false, error: "allowed must be true or false" });
    }

    // Stored only as an explicit false; "allowed" (the default) is
    // represented by absence, so an account made before this existed is
    // never silently different from one that was just switched back on.
    const wasAllowed = found.target.pilotBrainAllowed !== false;
    if (allowed) delete found.target.pilotBrainAllowed;
    else found.target.pilotBrainAllowed = false;
    writeCollection("users", found.users);
    if (wasAllowed !== allowed) {
      const onOff = (v: boolean) => (v ? "allowed" : "not allowed");
      recordEvent(found.target.dealershipId, "Team", found.target.name, [
        { field: "Pilot Brain", before: onOff(wasAllowed), after: onOff(allowed) },
      ], { recordId: found.target.id, action: "changed" });
    }
    res.json({ ok: true, member: toPublicUser(found.target) });
  });

  app.delete("/dealership/team/:id", requireAuth, requireStaffRole("manager"), (req, res) => {
    const found = findManageableMember(req, res);
    if (!found) return;

    // Order matters. The invite links are cancelled first, so a failure
    // part-way can leave the person still on the team (the owner tries
    // again) but never removed while links they hold still work. Access is
    // revoked second, and only then is their rota/job data
    // tidied — cutting them off must never depend on the cleanup
    // succeeding.
    cancelSharedInviteLinks(found.target.dealershipId);
    writeCollection("users", found.users.filter(u => u.id !== found.target.id));
    recordEvent(found.target.dealershipId, "Team", found.target.name, [
      { field: "role", before: found.target.staffRole ?? "staff" },
    ], { recordId: found.target.id, action: "removed" });
    releaseMemberFromTeamData(found.target.dealershipId, found.target.id);
    erasePrivateDataOf(found.target.dealershipId, found.target.id);

    res.json({ ok: true });
  });
}
