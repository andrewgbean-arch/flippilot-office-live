import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { testDataDir } from "./vitest.testEnv";

const RUN_FOLDER_PREFIX = "flippilot-backend-test-";
const ONE_HOUR = 60 * 60 * 1000;

// Best effort: remove run folders that an earlier run left behind (it was killed,
// or Windows would not let it delete a database a worker still had open). Only
// folders with this file's own prefix are ever touched, and only once they are
// over an hour old, so a run that is still going is never disturbed.
function sweepOldRunFolders() {
  try {
    const tmp = os.tmpdir();
    for (const name of fs.readdirSync(tmp)) {
      if (!name.startsWith(RUN_FOLDER_PREFIX)) continue;
      const old = path.join(tmp, name);
      try {
        if (Date.now() - fs.statSync(old).mtimeMs > ONE_HOUR) {
          fs.rmSync(old, { recursive: true, force: true });
        }
      } catch {
        // still in use, or already gone: leave it
      }
    }
  } catch {
    // the temp folder could not be listed: nothing to sweep
  }
}

// Runs once, in the main test process, before any test file. Creates this
// run's private database folder and hands back the function that deletes it.
export default function setup() {
  const dir = testDataDir();

  // Belt and braces: never let a mistake in the config point the tests at the
  // real dev database folder.
  const realDataDir = path.resolve(__dirname, "data");
  if (path.resolve(dir).startsWith(realDataDir)) {
    throw new Error(`Refusing to run the tests against the real data folder: ${dir}`);
  }

  sweepOldRunFolders();
  fs.mkdirSync(dir, { recursive: true });

  return () => {
    // On Windows a database file that a worker process still has open cannot be
    // deleted at that instant. That used to fail this cleanup with EBUSY and turn
    // a fully green run into exit code 1. Retry for a moment, and if it still will
    // not go, leave the folder: it is throwaway data in the temp folder and the
    // next run's sweep removes it. A leftover folder must never fail a test run.
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    } catch {
      // left for the next run's sweep
    }
  };
}
