import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "./db";
import { requireAuth, type AuthUser } from "./auth";

// Where Pilot Brain keeps each person's chat and the facts she remembers
// about them (routes/pilotBrain.ts reads and writes these).
export const PILOT_BRAIN_MESSAGES = "pilotBrainMessages";
export const PILOT_BRAIN_MEMORIES = "pilotBrainMemories";

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
