import type { Vehicle } from "../types/Vehicle";
import { authHeaders } from "@/lib/authToken";
import type { SavePayload } from "./inventoryChanges";
import type { SaveResult } from "./inventorySaver";

import { BASE_URL } from "@/lib/apiBaseUrl";

// GET /inventory used to return two hardcoded vehicles (Ford Fiesta /
// BMW 1 Series) regardless of what the app did — no real persistence
// existed. It is now backed by src/backend/src/routes/inventory.ts. Loading
// reads the whole collection, like leads/staff; SAVING no longer writes it
// back whole: it sends only what changed (see saveInventoryToServer). This
// endpoint requires auth (see backend/src/server.ts), hence authHeaders()
// below.
//
// Returns null — NOT an empty list — when the stock couldn't be read
// (dropped connection, 401/402/403/5xx, a response that isn't a stock
// list). This used to return [] for both "this dealer genuinely has no
// vehicles yet" and "the request failed", and the caller treated both
// as a first run: it showed demo cars and, on the next save, wrote
// them over the dealer's real stock. An empty array from here now only
// ever means the server answered successfully and the list really is
// empty.
export async function loadInventoryFromServer(): Promise<Vehicle[] | null> {
  try {
    const res = await fetch(`${BASE_URL}/inventory`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : null;
  } catch (err) {
    console.error("loadInventoryFromServer: could not load stock", err);
    return null;
  }
}

// How long a save may take before it's given up on as failed. Generous, since
// a stock list with pictures can be several MB on a phone connection — but
// finite, because saves go one at a time and a request that never answers
// would otherwise stop every later save.
export const SAVE_TIMEOUT_MS = 90_000;

// What went wrong, in words for the person looking at the screen: the HTTP
// status, "network" (the server couldn't be reached, or took too long),
// "bad-reply" (a 200 that wasn't a stock list, e.g. a captive portal's page) or
// "old-server" (a 200 that shows the server didn't understand field-level
// edits: an older server just ignores them, so it must never count as saved).
export function describeSaveFailure(problem: number | "network" | "bad-reply" | "old-server"): string {
  if (problem === "network") {
    return "We couldn't reach the server, so your latest stock changes haven't been saved. Check your connection and try again.";
  }
  if (problem === "bad-reply") {
    return "The server's reply wasn't what we expected, so your latest stock changes may not have been saved. Try again.";
  }
  if (problem === "old-server") {
    return "The server hasn't been updated to accept this kind of save yet, so your changes are not saved. Try again in a few minutes.";
  }
  switch (problem) {
    case 401:
      return "You've been signed out, so your latest stock changes haven't been saved. Sign in again to carry on.";
    case 402:
      return "Your trial or subscription has ended, so your latest stock changes haven't been saved. Renew your subscription to save.";
    case 403:
      return "Your dealership account can't save stock changes right now (it may be awaiting approval), so your latest changes haven't been saved.";
    case 413:
      return "Your stock is too big to save in one go — usually because of photos added from this computer — so your latest changes haven't been saved. Remove some photos from your cars, then try again.";
  }
  if (problem >= 500) {
    return `The server had a problem saving your latest stock changes (error ${problem}), so they haven't been saved yet. Try again in a moment.`;
  }
  return `The server wouldn't accept your latest stock changes (error ${problem}), so they haven't been saved. Try again, and if it keeps happening, contact support.`;
}

// Saves what the user changed, not the whole stock:
//   items       - cars created on this screen that the server hasn't confirmed
//                 yet, as whole records (an id the server already has is
//                 replaced, as it always was);
//   changes     - field-level edits of cars that already exist. The server
//                 applies each onto its CURRENT copy, so another person's edit
//                 to a different field of the same car survives, and an edit can
//                 never bring back a car that has been deleted;
//   deletedIds  - cars the user deliberately deleted. Only an id listed here
//                 ever removes a car.
// Cars the server holds that aren't mentioned are left exactly as they are. It
// answers with the full list as it now stands (which the caller adopts),
// `changed` (how many edits it applied) and `notFound` (edited cars that no
// longer exist there, deleted by someone else).
//
// Never throws, and never reports a save that didn't happen as done: any
// status that isn't a success (401/402/403/413/5xx...), a dropped connection,
// a timeout, or a reply that isn't a stock list comes back as a failure with
// a plain message. That includes a reply from an OLDER server that doesn't
// know about `changes` (it ignores them, and would answer 200 with no
// `changed`): sending edits and getting no `changed` back is a failed save,
// because reporting an edit that was silently dropped as saved is the worst
// thing this can do.
export async function saveInventoryToServer(payload: SavePayload): Promise<SaveResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items: payload.items, changes: payload.changes, deletedIds: payload.deletedIds }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, message: describeSaveFailure(res.status) };
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return { ok: false, status: res.status, message: describeSaveFailure("bad-reply") };
    }
    const reply = data as { items?: unknown; changed?: unknown; notFound?: unknown } | null;
    const items = reply?.items;
    if (!Array.isArray(items)) {
      return { ok: false, status: res.status, message: describeSaveFailure("bad-reply") };
    }
    if (payload.changes.length > 0 && typeof reply?.changed !== "number") {
      return { ok: false, status: res.status, message: describeSaveFailure("old-server") };
    }
    const notFound = Array.isArray(reply?.notFound)
      ? (reply.notFound as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    return { ok: true, items: items as Vehicle[], notFound };
  } catch (err) {
    console.error("saveInventoryToServer: could not reach the backend", err);
    return { ok: false, status: null, message: describeSaveFailure("network") };
  } finally {
    clearTimeout(timer);
  }
}
