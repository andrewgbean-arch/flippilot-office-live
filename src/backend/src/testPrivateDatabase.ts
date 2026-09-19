import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Test-only. Import this FIRST in a test file, as a bare `import "./testPrivateDatabase.js";`,
// before anything that (directly or not) imports db.ts — db.ts opens its database
// the moment it is loaded, and reads DATA_DIR to decide where.
//
// Why: vitest runs the test files in parallel, all pointed by vitest.config.ts at
// ONE shared database file. `users` and `dealerships` are each stored as a single
// JSON blob that every signup, join, removal and password change reads, edits and
// writes back whole. Two test files doing that at the same time, from different
// processes, can overwrite each other's accounts between a read and its write — and
// the tests that use this file are the ones that assert on exactly that: that
// nobody's account, removal or role change is lost. So each of them gets its own
// database file, in a brand-new temp folder: still throwaway, and never anywhere
// near the real data folder.
//
// The folder is deliberately NOT inside the run's shared one (vitest.globalSetup.ts
// deletes that when the run ends). On Windows a database file that a worker still
// has open can't be deleted, and that makes the end-of-run cleanup fail — turning a
// fully green run into exit code 1. Folders made here are left for the operating
// system's temp cleanup instead, and any from an earlier run that is over an hour
// old is swept away below, best effort. Only folders with this file's own prefix are
// ever touched.
const PREFIX = "flippilot-test-private-db-";
const tmp = os.tmpdir();
const ONE_HOUR = 60 * 60 * 1000;

try {
  for (const name of fs.readdirSync(tmp)) {
    if (!name.startsWith(PREFIX)) continue;
    const old = path.join(tmp, name);
    try {
      if (Date.now() - fs.statSync(old).mtimeMs > ONE_HOUR) {
        fs.rmSync(old, { recursive: true, force: true });
      }
    } catch {
      // still in use, or already gone — leave it
    }
  }
} catch {
  // nothing to sweep
}

process.env.DATA_DIR = fs.mkdtempSync(path.join(tmp, PREFIX));
