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
}
