import { Express, Request } from "express";
import { requireOwner, type AuthUser } from "../auth";
import { changeFacets, listChanges } from "../db";
import { HISTORY_DAYS, purgeOldHistory } from "../changeHistory";

// The owner's Change History page: who changed what, when, and what it was
// before (changeHistory.ts records it). Owner only: it shows every teammate's
// work, managers included, which is the point of it.

const PAGE = 100;
const DAY_CHOICES = [1, 7, 30, HISTORY_DAYS];

export default function registerChangeHistoryRoute(app: Express) {
  app.get("/change-history", requireOwner, (req, res) => {
    const user = (req as Request & { user: AuthUser }).user;
    const q = req.query as Record<string, unknown>;

    const daysAsked = Number(q.days);
    const days = DAY_CHOICES.includes(daysAsked) ? daysAsked : 30;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const beforeId = Number(q.before);
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined);

    // Anything past the 90 days is gone for good before anyone can read it.
    purgeOldHistory(true);

    const person = text(q.person);
    const area = text(q.area);
    const search = text(q.search);
    const entries = listChanges(user.dealershipId, {
      since,
      ...(Number.isInteger(beforeId) && beforeId > 0 ? { beforeId } : {}),
      ...(person ? { actorId: person } : {}),
      ...(area ? { area } : {}),
      ...(search ? { search } : {}),
      limit: PAGE + 1,
    });
    const more = entries.length > PAGE;
    const page = entries.slice(0, PAGE).map(({ dealershipId: _d, ...e }) => e);

    res.json({
      ok: true,
      days,
      keptDays: HISTORY_DAYS,
      entries: page,
      nextBefore: more ? page[page.length - 1]!.id : null,
      ...changeFacets(user.dealershipId, since),
    });
  });
}
