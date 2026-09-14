// One-time migration: reads the old file-based JSON store and imports
// it into the new SQLite database (see src/db.ts). Safe to re-run —
// every write is an upsert, so running this twice just re-imports the
// same data rather than duplicating it. Run with:
//   npx tsx scripts/migrateJsonToSqlite.ts
import fs from "fs";
import path from "path";
import { writeCollection, writeTenantCollection, writeTenantDoc } from "../src/db";

const DATA_DIR = path.join(__dirname, "..", "data");

function readJsonIfExists(file: string): any {
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err);
    return undefined;
  }
}

function migrateGlobalCollection(name: string) {
  const file = path.join(DATA_DIR, `${name}.json`);
  const data = readJsonIfExists(file);
  if (!Array.isArray(data)) {
    console.log(`  ${name}: nothing to migrate (no file or not an array)`);
    return;
  }
  writeCollection(name, data);
  console.log(`  ${name}: migrated ${data.length} row(s)`);
}

function migrateTenantData() {
  const dealershipsDir = path.join(DATA_DIR, "dealerships");
  if (!fs.existsSync(dealershipsDir)) {
    console.log("  no per-dealership data directory found");
    return;
  }

  const dealershipIds = fs
    .readdirSync(dealershipsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  for (const dealershipId of dealershipIds) {
    const dir = path.join(dealershipsDir, dealershipId);
    console.log(`  dealership ${dealershipId}:`);

    for (const collection of ["vehicles", "leads", "staff"]) {
      const data = readJsonIfExists(path.join(dir, `${collection}.json`));
      if (Array.isArray(data)) {
        writeTenantCollection(dealershipId, collection, data);
        console.log(`    ${collection}: migrated ${data.length} row(s)`);
      }
    }

    const bookkeeping = readJsonIfExists(path.join(dir, "bookkeeping.json"));
    if (bookkeeping && typeof bookkeeping === "object") {
      writeTenantDoc(dealershipId, "bookkeeping", bookkeeping);
      const counts = Object.entries(bookkeeping)
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : "?"}`)
        .join(", ");
      console.log(`    bookkeeping: migrated (${counts})`);
    }
  }
}

console.log("Migrating global collections...");
migrateGlobalCollection("users");
migrateGlobalCollection("dealerships");

console.log("Migrating per-dealership data...");
migrateTenantData();

console.log("Done.");
