import { defineConfig } from "vitest/config";
import { BLANKED_VARIABLES, testDataDir } from "./vitest.testEnv";

// See vitest.testEnv.ts for why the tests run in a private environment.
export default defineConfig({
  test: {
    globalSetup: ["./vitest.globalSetup.ts"],
    // Signing up spends about 0.6s hashing the password, and many tests sign up
    // several people, so a busy machine can push a healthy test past the 5s
    // default. Generous limits stop that failing a run for no real reason.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // One test file at a time. Every file shares this run's one database, and
    // signup reads the whole users list, waits ~0.5s for bcrypt, then writes
    // the list back (routes/auth.ts), so two files signing up at once lose
    // each other's accounts and the loser's requests start answering 401.
    // (The signup race described above is fixed in routes/auth.ts now. This is
    // still needed: SQLite is opened with no busy timeout, so two files writing
    // at the same moment fail at random with "database is locked".)
    fileParallelism: false,
    env: {
      ...Object.fromEntries(BLANKED_VARIABLES.map(name => [name, ""])),
      DATA_DIR: testDataDir(),
      JWT_SECRET: "test-only-secret-never-used-outside-the-test-suite",
      // 64 hex characters, as credentialCrypto.ts requires. Not a real key.
      CREDENTIAL_ENCRYPTION_KEY: "ab".repeat(32),
    },
  },
});
