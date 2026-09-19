import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

/* --------------------------------------------------
   ⭐ SQLite-backed persistence

   Was plain JSON files (one per collection, one per tenant per
   collection) — fine for one person testing locally, but with a real
   ceiling: no protection against two writes to the same file racing
   each other, no real querying, everything loaded fully into memory on
   every read. That's the actual thing standing between "works on my
   laptop" and "works for many real dealers using it at once" — more
   than server count or hosting ever will be at this stage.

   Uses node:sqlite (built into Node 22+, no native compilation, no new
   account/hosting decision needed) rather than better-sqlite3 — this
   machine has no Visual Studio Build Tools installed, and
   better-sqlite3's native bindings segfaulted rather than working, so
   the built-in module is what's actually usable here today. It's
   still labelled experimental by Node, which is a real tradeoff to
   know about, but the storage SHAPE below (a small set of key→JSON-
   blob tables) is intentionally simple SQL that would port to
   better-sqlite3 or Postgres with minimal change if that ever matters
   — this migration is about removing the file-locking/no-querying
   ceiling now, not about fully relationalizing the schema today.

   Every function below keeps the EXACT same signature it had as a
   file-based store, so none of the 9 route files that call these
   needed to change at all.
-------------------------------------------------- */

// A relative __dirname-based path is fine locally, but on a host like
// Render the app's own code directory is NOT what a persistent disk
// gets mounted to — the disk's real mount path (e.g. /var/data) has to
// be given explicitly via DATA_DIR, or every redeploy silently starts
// from an empty database on fresh ephemeral storage.
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "..", "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

ensureDataDir();
const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));

// WAL mode lets reads and writes happen concurrently instead of
// blocking each other — the one thing plain JSON files could never do
// safely with more than one request in flight at a time.
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS global_data (
    collection TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

// Tenant-scoped array collections (vehicles/leads/staff) and single-
// document records (bookkeeping) share this one table — both are just
// "a JSON blob keyed by (dealership, name)"; only what a missing row
// defaults to differs (an empty array vs. a caller-supplied fallback),
// which is handled by the calling function below, not the schema.
db.exec(`
  CREATE TABLE IF NOT EXISTS tenant_data (
    dealership_id TEXT NOT NULL,
    collection TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (dealership_id, collection)
  );
`);

export function readCollection<T>(collection: string): T[] {
  const row = db.prepare("SELECT data FROM global_data WHERE collection = ?").get(collection) as
    | { data: string }
    | undefined;
  if (!row) return [];

  try {
    const parsed = JSON.parse(row.data);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeCollection<T>(collection: string, data: T[]): void {
  db.prepare(
    `INSERT INTO global_data (collection, data) VALUES (?, ?)
     ON CONFLICT(collection) DO UPDATE SET data = excluded.data`
  ).run(collection, JSON.stringify(data));
}

/* --------------------------------------------------
   ⭐ Tenant-scoped collections (multi-tenancy)

   readCollection/writeCollection above are global — fine for `users`
   and `dealerships` themselves, but business data (vehicles/leads/
   staff) needs to be isolated per dealership so one dealer can never
   see or overwrite another's stock.
-------------------------------------------------- */

export function readTenantCollection<T>(
  dealershipId: string,
  collection: string
): T[] {
  const row = db
    .prepare("SELECT data FROM tenant_data WHERE dealership_id = ? AND collection = ?")
    .get(dealershipId, collection) as { data: string } | undefined;
  if (!row) return [];

  try {
    const parsed = JSON.parse(row.data);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeTenantCollection<T>(
  dealershipId: string,
  collection: string,
  data: T[]
): void {
  db.prepare(
    `INSERT INTO tenant_data (dealership_id, collection, data) VALUES (?, ?, ?)
     ON CONFLICT(dealership_id, collection) DO UPDATE SET data = excluded.data`
  ).run(dealershipId, collection, JSON.stringify(data));
}

// Same tenant-scoped storage as above, but for a single object
// document rather than an array collection — used by bookkeeping, whose
// costs/purchases/sales/transactions naturally belong together as one
// per-dealership record rather than as separate array collections.
export function readTenantDoc<T>(
  dealershipId: string,
  collection: string,
  fallback: T
): T {
  const row = db
    .prepare("SELECT data FROM tenant_data WHERE dealership_id = ? AND collection = ?")
    .get(dealershipId, collection) as { data: string } | undefined;
  if (!row) return fallback;

  try {
    return JSON.parse(row.data) as T;
  } catch {
    return fallback;
  }
}

export function writeTenantDoc<T>(
  dealershipId: string,
  collection: string,
  data: T
): void {
  db.prepare(
    `INSERT INTO tenant_data (dealership_id, collection, data) VALUES (?, ?, ?)
     ON CONFLICT(dealership_id, collection) DO UPDATE SET data = excluded.data`
  ).run(dealershipId, collection, JSON.stringify(data));
}

// Removes every row (vehicles/leads/staff/bookkeeping — everything)
// belonging to one dealership. Used by the integration test suite to
// clean up its own throwaway accounts; also the real building block a
// future "delete my dealership" account-closure feature would need.
export function deleteTenantData(dealershipId: string): void {
  db.prepare("DELETE FROM tenant_data WHERE dealership_id = ?").run(dealershipId);
  db.prepare("DELETE FROM photos WHERE dealership_id = ?").run(dealershipId);
}

/* --------------------------------------------------
   Hosted photos

   The picture files themselves. They used to live as base64 text inside
   each vehicle record, but the web app rewrites the WHOLE stock list in
   one request capped at 10mb, so a few dozen photos across a dealership
   was enough to stop stock saving. Now the bytes live here, one row per
   photo, and the vehicle only carries a short URL to it.

   `kind` says what a photo belongs to: "vehicle" (a public listing
   photo, ref_id = the vehicle id) or "message" (private, attached to a 1:1
   message or a team-board post; ref_id = that message's id, or NULL
   while it is uploaded but not yet sent).
-------------------------------------------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    dealership_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_id TEXT,
    uploaded_by TEXT,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  );
`);
db.exec("CREATE INDEX IF NOT EXISTS photos_by_ref ON photos (dealership_id, kind, ref_id);");

export type PhotoKind = "vehicle" | "message";

export interface PhotoMeta {
  id: string;
  dealershipId: string;
  kind: PhotoKind;
  refId: string | null;
  uploadedBy: string | null;
  mime: string;
  size: number;
  createdAt: string;
}

export interface PhotoRow extends PhotoMeta {
  data: Uint8Array;
}

const PHOTO_META_COLUMNS =
  "id, dealership_id AS dealershipId, kind, ref_id AS refId, uploaded_by AS uploadedBy, mime, size, created_at AS createdAt";

export function insertPhoto(photo: PhotoRow): void {
  db.prepare(
    `INSERT INTO photos (id, dealership_id, kind, ref_id, uploaded_by, mime, size, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    photo.id,
    photo.dealershipId,
    photo.kind,
    photo.refId,
    photo.uploadedBy,
    photo.mime,
    photo.size,
    photo.data,
    photo.createdAt
  );
}

export function getPhoto(id: string): PhotoRow | null {
  const row = db.prepare(`SELECT ${PHOTO_META_COLUMNS}, data FROM photos WHERE id = ?`).get(id);
  return row ? (row as unknown as PhotoRow) : null;
}

// Newest last, so a vehicle's photos come back in the order they were taken.
export function listPhotoMeta(dealershipId: string, kind: PhotoKind, refId: string): PhotoMeta[] {
  return db
    .prepare(
      `SELECT ${PHOTO_META_COLUMNS} FROM photos
       WHERE dealership_id = ? AND kind = ? AND ref_id = ?
       ORDER BY created_at, rowid`
    )
    .all(dealershipId, kind, refId) as unknown as PhotoMeta[];
}

export function countPhotos(dealershipId: string, kind: PhotoKind): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM photos WHERE dealership_id = ? AND kind = ?")
    .get(dealershipId, kind) as unknown as { n: number };
  return row.n;
}

// Always scoped to the dealership, so one dealer can never remove another's.
export function deletePhoto(dealershipId: string, id: string): boolean {
  const result = db.prepare("DELETE FROM photos WHERE dealership_id = ? AND id = ?").run(dealershipId, id);
  return Number(result.changes) > 0;
}

// The hosted pictures of vehicles someone has explicitly deleted. This is the
// ONLY way a car's pictures go when the car does: nothing infers "this car is
// gone" from a saved list any more, because a stale screen's list says exactly
// that about cars it simply hasn't seen yet.
//
// Only ever "vehicle" photos (a message photo's ref_id is a message id and
// must never be mistaken for a vehicle id) and only ever this dealership's
// (one dealer can never remove another's, whatever ids they send). Ids with no
// photos, or no vehicle any more, match nothing, so repeating a delete after a
// failed request simply finishes the job. All or nothing.
export function deleteVehiclePhotosFor(dealershipId: string, vehicleIds: readonly string[]): number {
  if (vehicleIds.length === 0) return 0;

  const CHUNK = 500; // stays well under SQLite's limit on bound parameters
  let removed = 0;
  db.exec("BEGIN");
  try {
    for (let i = 0; i < vehicleIds.length; i += CHUNK) {
      const chunk = vehicleIds.slice(i, i + CHUNK);
      const marks = chunk.map(() => "?").join(", ");
      const result = db
        .prepare(`DELETE FROM photos WHERE dealership_id = ? AND kind = 'vehicle' AND ref_id IN (${marks})`)
        .run(dealershipId, ...chunk);
      removed += Number(result.changes);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return removed;
}

// ---- message photos (kind "message") ----
// A message photo is uploaded first (unattached: ref_id NULL, uploaded_by =
// the sender) and attached to a message when that message is sent.

// All or nothing: every id must be an unattached message photo in this
// dealership uploaded by THIS user, otherwise nothing is attached. For an
// anonymous post the uploader is cleared as it's attached, so nothing in
// the database links an anonymous post back to a person.
// A photo older than `notOlderThanIso` can no longer be attached: an unsent
// photo records its uploader, so that window is deliberately bounded rather
// than depending on when the next sweep happens to run.
export function attachMessagePhotos(
  dealershipId: string,
  userId: string,
  photoIds: string[],
  refId: string,
  anonymous: boolean,
  notOlderThanIso: string
): boolean {
  if (photoIds.length === 0) return true;

  const check = db.prepare(
    `SELECT id FROM photos
     WHERE id = ? AND dealership_id = ? AND kind = 'message' AND ref_id IS NULL AND uploaded_by = ?
       AND created_at >= ?`
  );
  for (const id of photoIds) {
    if (!check.get(id, dealershipId, userId, notOlderThanIso)) return false;
  }

  const attach = db.prepare("UPDATE photos SET ref_id = ?, uploaded_by = ? WHERE id = ?");
  db.exec("BEGIN");
  try {
    for (const id of photoIds) attach.run(refId, anonymous ? null : userId, id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return true;
}

// If the message that was about to carry these photos could not be saved,
// let them go back to being unsent (and so sweepable) instead of leaving
// them attached to a message that does not exist.
export function detachMessagePhotos(dealershipId: string, refId: string): void {
  db.prepare("UPDATE photos SET ref_id = NULL WHERE dealership_id = ? AND kind = 'message' AND ref_id = ?").run(
    dealershipId,
    refId
  );
}

// Total stored size of one kind of photo for a dealership.
export function photoBytes(dealershipId: string, kind: PhotoKind): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(size), 0) AS n FROM photos WHERE dealership_id = ? AND kind = ?")
    .get(dealershipId, kind) as unknown as { n: number };
  return row.n;
}

// One person's own unsent photos older than the cutoff: drafts they walked
// away from. Cleared when they are at their limit and need the room.
export function purgeAbandonedUnsentPhotos(dealershipId: string, userId: string, olderThanIso: string): number {
  const result = db
    .prepare(
      `DELETE FROM photos
       WHERE dealership_id = ? AND kind = 'message' AND ref_id IS NULL AND uploaded_by = ? AND created_at < ?`
    )
    .run(dealershipId, userId, olderThanIso);
  return Number(result.changes);
}

export function countUnattachedMessagePhotos(dealershipId: string, userId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM photos
       WHERE dealership_id = ? AND kind = 'message' AND ref_id IS NULL AND uploaded_by = ?`
    )
    .get(dealershipId, userId) as unknown as { n: number };
  return row.n;
}

// Someone picked a photo, then changed their mind before sending: only the
// uploader can throw it away, and only while it's unattached.
export function deleteUnattachedMessagePhoto(dealershipId: string, userId: string, id: string): boolean {
  const result = db
    .prepare(
      `DELETE FROM photos
       WHERE id = ? AND dealership_id = ? AND kind = 'message' AND ref_id IS NULL AND uploaded_by = ?`
    )
    .run(id, dealershipId, userId);
  return Number(result.changes) > 0;
}

// Uploaded but never sent (the app was closed, the send failed and was
// abandoned). Swept opportunistically on the next upload.
export function purgeStaleUnattachedMessagePhotos(dealershipId: string, olderThanIso: string): number {
  const result = db
    .prepare(
      `DELETE FROM photos
       WHERE dealership_id = ? AND kind = 'message' AND ref_id IS NULL AND created_at < ?`
    )
    .run(dealershipId, olderThanIso);
  return Number(result.changes);
}
