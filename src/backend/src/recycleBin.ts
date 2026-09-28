import { randomUUID } from "crypto";
import { readTenantCollection, writeTenantCollection } from "./db";
import type { AuthUser } from "./auth";

// "Recently deleted": anything removed from leads, jobs, contacts or
// consumables is kept here for BIN_DAYS, so a mistake (or an out-of-date
// screen that saved over newer records) can be put right. The owner or a
// manager can restore an entry, or delete it for good — which matters when
// someone asks for their details to be removed.
//
// The whole-list saves (PUT /leads, /jobs, /contacts, /consumables) are
// also braked: the app removes one record at a time, so a save that would
// remove more than MAX_REMOVED_PER_SAVE is an out-of-date or broken screen,
// and is refused with nothing written. Contacts and consumables have their
// own DELETE routes, so their list saves may not remove anything at all.

export const BIN_LISTS = ["leads", "jobs", "contacts", "consumables"] as const;
export type BinList = (typeof BIN_LISTS)[number];

export const BIN_DAYS = 30;
const BIN_COLLECTION = "recentlyDeleted";
const DAY_MS = 24 * 60 * 60 * 1000;

/** The most records one whole-list save may remove. */
export const MAX_REMOVED_PER_SAVE: Record<BinList, number> = { leads: 1, jobs: 1, contacts: 0, consumables: 0 };

export type BinEntry = {
  id: string;
  list: BinList;
  record: Record<string, unknown>;
  deletedAt: string;
  deletedBy: { id: string; name: string };
};

const idOf = (record: unknown): string | null => {
  const id = (record as { id?: unknown } | null)?.id;
  return typeof id === "string" && id ? id : null;
};

/** The records in `before` whose ids are missing from `after`: what a save would remove. */
export function removedRecords<T>(before: readonly T[], after: readonly unknown[]): T[] {
  const kept = new Set(after.map(idOf).filter((id): id is string => id !== null));
  return before.filter((r) => {
    const id = idOf(r);
    return id !== null && !kept.has(id);
  });
}

/** How many a save would remove, when that is more than the list allows; null when it is fine. */
export function tooManyRemoved(list: BinList, before: readonly unknown[], after: readonly unknown[]): number | null {
  const count = removedRecords(before, after).length;
  return count > MAX_REMOVED_PER_SAVE[list] ? count : null;
}

const NOUN: Record<BinList, [string, string]> = {
  leads: ["lead", "leads"],
  jobs: ["job", "jobs"],
  contacts: ["contact", "contacts"],
  consumables: ["consumable", "consumables"],
};

/** The refusal for a save that would remove too much. */
export function tooManyRemovedMessage(list: BinList, count: number): string {
  const [one, many] = NOUN[list];
  if (MAX_REMOVED_PER_SAVE[list] === 0) {
    return `Saving the ${many} list can't remove any (it would have removed ${count}). Nothing was saved. To remove a ${one}, use Remove on it.`;
  }
  return `That save would have removed ${count} ${many} at once, so nothing was saved. The page was probably out of date: reload it and try again.`;
}

function liveEntries(dealershipId: string, now: Date): BinEntry[] {
  const cutoff = now.getTime() - BIN_DAYS * DAY_MS;
  return readTenantCollection<BinEntry>(dealershipId, BIN_COLLECTION).filter(
    (e) => new Date(e.deletedAt).getTime() > cutoff
  );
}

/** Everything in the bin that is still within BIN_DAYS, newest first. */
export function binEntries(dealershipId: string, now = new Date()): BinEntry[] {
  return liveEntries(dealershipId, now).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Keeps removed records. Old entries past BIN_DAYS are dropped on the way. */
export function putInBin(user: AuthUser, list: BinList, records: readonly unknown[], now = new Date()): void {
  if (records.length === 0) return;
  const entries = liveEntries(user.dealershipId, now);
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    entries.push({
      id: randomUUID(),
      list,
      record: record as Record<string, unknown>,
      deletedAt: now.toISOString(),
      deletedBy: { id: user.id, name: user.name || user.email },
    });
  }
  writeTenantCollection(user.dealershipId, BIN_COLLECTION, entries);
}

/** Takes one entry out of the bin (to restore it, or to delete it for good). */
export function takeFromBin(dealershipId: string, entryId: string, now = new Date()): BinEntry | null {
  const entries = liveEntries(dealershipId, now);
  const found = entries.find((e) => e.id === entryId) ?? null;
  if (!found) return null;
  writeTenantCollection(
    dealershipId,
    BIN_COLLECTION,
    entries.filter((e) => e.id !== entryId)
  );
  return found;
}

/** A short name for an entry, for the Recently deleted screen. */
export function binLabel(entry: BinEntry): string {
  const r = entry.record;
  for (const key of ["name", "title", "customerName", "description"]) {
    const v = r[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
  }
  return `Untitled ${NOUN[entry.list][0]}`;
}
