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
