import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readCollection, readTenantCollection, writeTenantCollection } from "../db";
import type { StaffNotification } from "./notifications";
import { itemsFromBody } from "../wholeListGuard";
import type { AuthUser } from "../auth";
import { canDeleteJobs, droppedIds } from "../roleAccess";

function dealershipId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.dealershipId;
}

// Day-to-day jobs/tasks — "book car in for MOT", "chase up lead",
// "clean showroom" — assignable to a real staff account (via /team),
// optionally linked to a specific vehicle. Open to any authenticated staff
// to create/update/complete, same as leads (operational coordination);
// deleting one is for managers and the owner.
export default function registerJobsRoute(app: Express) {
  app.get("/jobs", (req, res) => {
    res.json({ ok: true, items: readTenantCollection(dealershipId(req), "jobs") });
  });

  app.put("/jobs", (req, res) => {
    const items = itemsFromBody(req, res);
    if (!items) return;
    const user = (req as Request & { user: AuthUser }).user;
    const before = readTenantCollection<Record<string, unknown>>(user.dealershipId, "jobs");
    // A job missing from the list is a job being deleted: managers and the owner only.
    if (!canDeleteJobs(user) && droppedIds(before, items).length > 0) {
      return res.status(403).json({ ok: false, error: "Only managers and the owner can delete a job. Nothing was saved." });
    }
    writeTenantCollection(dealershipId(req), "jobs", items);
    tellNewAssignees(user, before, items);
    res.json({ ok: true, items });
  });
}

// A job newly given to someone puts a notice in THEIR bell (it used to show
// "Job Assigned" in the bell of whoever made the job, and never to the person
// it was for). Only for a login in this dealership, never to yourself, and
// only when the assignee actually changed, so re-saving a list is quiet.
function tellNewAssignees(user: AuthUser, before: Record<string, unknown>[], after: unknown[]) {
  const wasFor = new Map(before.map(job => [job.id, job.assignedToUserId] as const));
  const team = new Set(
    readCollection<{ id: string; dealershipId: string }>("users").filter(u => u.dealershipId === user.dealershipId).map(u => u.id)
  );
  const fresh: StaffNotification[] = [];
  for (const raw of after) {
    if (!raw || typeof raw !== "object") continue;
    const job = raw as Record<string, unknown>;
    const to = job.assignedToUserId;
    if (typeof to !== "string" || to === user.id || !team.has(to) || wasFor.get(job.id) === to) continue;
    const title = typeof job.title === "string" && job.title.trim() ? job.title.trim().slice(0, 120) : "A job";
    fresh.push({
      id: randomUUID(),
      userId: to,
      title: "Job assigned to you",
      message: `${String(user.name ?? "A teammate").slice(0, 60)} gave you "${title}". It's on the Jobs Board.`,
      type: "info",
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    if (fresh.length >= 20) break; // a bulk re-save can't flood anyone's bell
  }
  if (fresh.length === 0) return;
  const existing = readTenantCollection<StaffNotification>(user.dealershipId, "notifications");
  writeTenantCollection(user.dealershipId, "notifications", [...existing, ...fresh]);
}
