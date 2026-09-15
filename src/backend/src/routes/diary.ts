import { randomUUID } from "crypto";
import { Express, Request } from "express";
import { readTenantCollection, writeTenantCollection } from "../db";
import type { AuthUser } from "../auth";

export interface DiaryEntry {
  id: string;
  userId: string;
  date: string; // yyyy-mm-dd
  text: string;
  isTask: boolean;
  done: boolean;
  createdAt: string;
}

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// A personal day-planner — reminders/to-dos/notes per day — deliberately
// separate from the real shared calendars this app already has
// (customer booking appointments, the staff rota, workshop job
// scheduling). Stored tenant-scoped like everything else, but every
// read/write is additionally filtered to the caller's own userId, same
// pattern as notifications.ts — one dealer's staff never see or touch
// each other's diary entries, even within the same dealership.
export default function registerDiaryRoute(app: Express) {
  app.get("/diary", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<DiaryEntry>(user.dealershipId, "diary").filter(
      (e) => e.userId === user.id
    );
    res.json({ ok: true, items });
  });

  app.post("/diary", (req, res) => {
    const user = authedUser(req);
    const { date, text, isTask } = req.body ?? {};

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "date (yyyy-mm-dd) is required" });
    }
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    const items = readTenantCollection<DiaryEntry>(user.dealershipId, "diary");
    const entry: DiaryEntry = {
      id: randomUUID(),
      userId: user.id,
      date,
      text: text.trim(),
      isTask: !!isTask,
      done: false,
      createdAt: new Date().toISOString(),
    };
    writeTenantCollection(user.dealershipId, "diary", [...items, entry]);
    res.json({ ok: true, entry });
  });

  app.put("/diary/:id", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<DiaryEntry>(user.dealershipId, "diary");
    const target = items.find((e) => e.id === req.params.id);
    if (!target) return res.status(404).json({ ok: false, error: "Diary entry not found" });
    if (target.userId !== user.id) return res.status(403).json({ ok: false, error: "Not your diary entry" });

    const { text, done } = req.body ?? {};
    const updated = items.map((e) =>
      e.id === req.params.id
        ? {
            ...e,
            ...(typeof text === "string" && text.trim() ? { text: text.trim() } : {}),
            ...(typeof done === "boolean" ? { done } : {}),
          }
        : e
    );
    writeTenantCollection(user.dealershipId, "diary", updated);
    res.json({ ok: true, entry: updated.find((e) => e.id === req.params.id) });
  });

  app.delete("/diary/:id", (req, res) => {
    const user = authedUser(req);
    const items = readTenantCollection<DiaryEntry>(user.dealershipId, "diary");
    const target = items.find((e) => e.id === req.params.id);
    if (!target) return res.status(404).json({ ok: false, error: "Diary entry not found" });
    if (target.userId !== user.id) return res.status(403).json({ ok: false, error: "Not your diary entry" });

    writeTenantCollection(
      user.dealershipId,
      "diary",
      items.filter((e) => e.id !== req.params.id)
    );
    res.json({ ok: true });
  });
}
