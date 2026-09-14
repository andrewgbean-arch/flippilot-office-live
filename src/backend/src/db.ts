import fs from "fs";
import path from "path";

/* --------------------------------------------------
   ⭐ Minimal file-based persistence

   Previously "persistence" here was just localStorage in the browser —
   no shared storage at all, so data never survived a cache clear and
   couldn't be seen from a second device/browser. This is a deliberately
   simple JSON-file store (one file per collection) rather than a real
   database, since there's no hosting/infra decision made yet — it's
   enough to make data real and shared across whichever browsers hit
   this backend, and is a straightforward upgrade path to a real DB
   later without changing the route contracts.
-------------------------------------------------- */

const DATA_DIR = path.join(__dirname, "..", "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(collection: string) {
  return path.join(DATA_DIR, `${collection}.json`);
}

export function readCollection<T>(collection: string): T[] {
  ensureDataDir();
  const file = filePath(collection);
  if (!fs.existsSync(file)) return [];

  try {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeCollection<T>(collection: string, data: T[]): void {
  ensureDataDir();
  fs.writeFileSync(filePath(collection), JSON.stringify(data, null, 2), "utf-8");
}

/* --------------------------------------------------
   ⭐ Tenant-scoped collections (multi-tenancy)

   readCollection/writeCollection above are global — fine for `users`
   and `dealerships` themselves, but business data (vehicles/leads/
   staff) needs to be isolated per dealership so one dealer can never
   see or overwrite another's stock. Same JSON-file approach, just
   nested under data/dealerships/<dealershipId>/<collection>.json.
-------------------------------------------------- */

function tenantDir(dealershipId: string) {
  const dir = path.join(DATA_DIR, "dealerships", dealershipId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function tenantFilePath(dealershipId: string, collection: string) {
  return path.join(tenantDir(dealershipId), `${collection}.json`);
}

export function readTenantCollection<T>(
  dealershipId: string,
  collection: string
): T[] {
  ensureDataDir();
  const file = tenantFilePath(dealershipId, collection);
  if (!fs.existsSync(file)) return [];

  try {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw);
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
  ensureDataDir();
  fs.writeFileSync(
    tenantFilePath(dealershipId, collection),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

// Same tenant-scoped file storage as above, but for a single object
// document rather than an array collection — used by bookkeeping, whose
// costs/purchases/sales/transactions naturally belong together as one
// per-dealership record rather than as separate array collections.
export function readTenantDoc<T>(
  dealershipId: string,
  collection: string,
  fallback: T
): T {
  ensureDataDir();
  const file = tenantFilePath(dealershipId, collection);
  if (!fs.existsSync(file)) return fallback;

  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeTenantDoc<T>(
  dealershipId: string,
  collection: string,
  data: T
): void {
  ensureDataDir();
  fs.writeFileSync(
    tenantFilePath(dealershipId, collection),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}
