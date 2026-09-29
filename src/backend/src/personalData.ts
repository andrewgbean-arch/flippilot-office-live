import { Express, Request, Response } from "express";
import { readCollection, readTenantCollection, writeTenantCollection, readTenantDoc } from "./db";
import { requireAuth, requireOwner, type AuthUser, type Dealership, type StoredUser } from "./auth";
import { RATES_COLLECTION } from "./routes/pay";
import { normaliseDoc, EMPTY_SECURITY_DOC } from "./pilotBrainShield";

// Where Pilot Brain keeps each person's chat and the facts she remembers
// about them (routes/pilotBrain.ts reads and writes these).
export const PILOT_BRAIN_MESSAGES = "pilotBrainMessages";
export const PILOT_BRAIN_MEMORIES = "pilotBrainMemories";
// Owner-visible record of what her shield turned away, withheld or refused
// to remember (pilotBrainShield.ts / routes/pilotBrain.ts). Included in a
// person's own export below, filtered to their own events — it is personal
// data about them (their own flagged words), not just a security record.
export const PILOT_BRAIN_SECURITY_LOG = "pilotBrainSecurity";

interface OwnedRecord {
  id: string;
  userId: string | null;
}

// Everything in the dealership that only the person themself could ever see:
// their own diary, their own notifications, their chat with Pilot Brain and
// what she remembers about them. Once their account is gone nobody can open
// any of it again, so keeping it helps no one and only leaves personal data
// lying about. Records of work done (clock-ins, leave, pay, the past rota,
// finished jobs) and anything shared with other people (team messages, the
// message board) are NOT here: see releaseMemberFromTeamData in routes/team.ts.
const ONLY_THEIRS = ["diary", "notifications", PILOT_BRAIN_MESSAGES, PILOT_BRAIN_MEMORIES];

export function erasePrivateDataOf(dealershipId: string, userId: string): void {
  for (const collection of ONLY_THEIRS) {
    const all = readTenantCollection<OwnedRecord>(dealershipId, collection);
    const kept = all.filter(r => r.userId !== userId);
    if (kept.length !== all.length) writeTenantCollection(dealershipId, collection, kept);
  }
}

type Row = Record<string, unknown> & { userId?: string | null };

// Photos travel as private ids that mean nothing outside the app, so the
// export says how many there were instead.
function withPhotoCount<T extends Record<string, unknown>>(row: T) {
  const { photoIds, ...rest } = row as T & { photoIds?: unknown };
  return Array.isArray(photoIds) && photoIds.length > 0 ? { ...rest, photos: photoIds.length } : rest;
}

// Everything Dealer OS holds about one person in their dealership, for a
// "download my data" (a UK GDPR subject access request). Their own records in
// full, the team messages they sent or received, the message-board posts they
// signed with their name (anonymous posts carry no name, so none are theirs),
// the jobs assigned to them, and their OWN events in Pilot Brain's security
// log (never anyone else's — that stays owner-only). Never the password hash.
export function buildPersonalExport(user: StoredUser) {
  const d = user.dealershipId;
  const own = (collection: string) => readTenantCollection<Row>(d, collection).filter(r => r.userId === user.id);
  const dealership = readCollection<Dealership>("dealerships").find(x => x.id === d);
  const messages = readTenantCollection<Row & { fromUserId?: string; toUserId?: string }>(d, "staffMessages");
  const jobs = readTenantCollection<Row & { assignedToUserId?: string | null }>(d, "jobs");
  const security = normaliseDoc(readTenantDoc<unknown>(d, PILOT_BRAIN_SECURITY_LOG, EMPTY_SECURITY_DOC));

  return {
    about:
      "Everything FlipPilot Dealer OS holds about you in this dealership, as of exportedAt. " +
      "Ask the dealership owner if you want anything corrected or deleted.",
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ...(user.staffRole ? { staffRole: user.staffRole } : {}),
      pilotBrainAllowed: user.pilotBrainAllowed !== false,
      dealership: dealership?.name ?? null,
    },
    diary: own("diary"),
    notifications: own("notifications"),
    pilotBrain: {
      conversation: own(PILOT_BRAIN_MESSAGES),
      memories: own(PILOT_BRAIN_MEMORIES),
      securityLog: security.events
        .filter(e => e.userId === user.id)
        .map(({ id, at, kind, categories, snippet }) => ({ id, at, kind, categories, snippet })),
    },
    clockIns: own("timekeeping"),
    leave: own("leave"),
    shifts: own("shifts"),
    workPattern: own("workPatterns"),
    payRate: own(RATES_COLLECTION)[0] ?? null,
    teamMessages: {
      sent: messages.filter(m => m.fromUserId === user.id).map(withPhotoCount),
      received: messages.filter(m => m.toUserId === user.id).map(withPhotoCount),
    },
    messageBoardPosts: own("feedback").map(withPhotoCount),
    jobsAssignedToYou: jobs
      .filter(j => j.assignedToUserId === user.id)
      .map(j => ({ id: j.id, title: j.title ?? null, status: j.status ?? null, dueDate: j.dueDate ?? null })),
  };
}

function sendExport(res: Response, user: StoredUser) {
  const day = new Date().toISOString().slice(0, 10);
  const safeName = user.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "person";
  res.setHeader("Content-Disposition", `attachment; filename="flippilot-data-${safeName}-${day}.json"`);
  res.json(buildPersonalExport(user));
}

interface Memory {
  id: string;
  userId: string;
  fact: string;
  createdAt: string;
}

// Anyone can see, and delete, what Pilot Brain remembers about them. Deliberately
// outside /pilot-brain, so it still works when the dealership has stopped paying
// for her or the owner has switched her off for this person: taking your own
// data back never depends on either.
export default function registerPersonalDataRoute(app: Express) {
  const me = (req: Request) => (req as Request & { user: AuthUser }).user;
  const mine = (user: AuthUser) =>
    readTenantCollection<Memory>(user.dealershipId, PILOT_BRAIN_MEMORIES).filter(m => m.userId === user.id);

  // Download my data: anyone signed in, for themself. Like the memory routes,
  // it needs only a login, never a paid-up dealership.
  app.get("/me/data-export", requireAuth, (req, res) => {
    const stored = readCollection<StoredUser>("users").find(u => u.id === me(req).id);
    if (!stored) return res.status(401).json({ ok: false, error: "Invalid or expired session" });
    sendExport(res, stored);
  });

  // The owner answering a teammate's request for their data (the dealership
  // is who a staff member asks). Only someone in the owner's own dealership:
  // any other id is the same 404, so ids can't be probed.
  app.get("/dealership/team/:id/data-export", requireAuth, requireOwner, (req, res) => {
    const owner = me(req);
    const target = readCollection<StoredUser>("users").find(u => u.id === req.params.id && u.dealershipId === owner.dealershipId);
    if (!target) return res.status(404).json({ ok: false, error: "Team member not found" });
    sendExport(res, target);
  });

  app.get("/me/pilot-brain-memories", requireAuth, (req, res) => {
    const memories = mine(me(req)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ ok: true, memories });
  });

  app.delete("/me/pilot-brain-memories/:id", requireAuth, (req, res) => {
    const user = me(req);
    const all = readTenantCollection<Memory>(user.dealershipId, PILOT_BRAIN_MEMORIES);
    const kept = all.filter(m => !(m.id === req.params.id && m.userId === user.id));
    // Same answer for "no such memory" and "someone else's", so ids can't be probed.
    if (kept.length === all.length) return res.status(404).json({ ok: false, error: "Memory not found" });
    writeTenantCollection(user.dealershipId, PILOT_BRAIN_MEMORIES, kept);
    res.json({ ok: true });
  });

  app.delete("/me/pilot-brain-memories", requireAuth, (req, res) => {
    const user = me(req);
    const all = readTenantCollection<Memory>(user.dealershipId, PILOT_BRAIN_MEMORIES);
    const kept = all.filter(m => m.userId !== user.id);
    if (kept.length !== all.length) writeTenantCollection(user.dealershipId, PILOT_BRAIN_MEMORIES, kept);
    res.json({ ok: true, removed: all.length - kept.length });
  });
}
