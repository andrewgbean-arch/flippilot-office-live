import { defineConfig } from "vitest/config";
import { BLANKED_VARIABLES, testDataDir } from "./vitest.testEnv";

// See vitest.testEnv.ts for why the tests run in a private environment.
export default defineConfig({
  test: {
    globalSetup: ["./vitest.globalSetup.ts"],
    // One test file at a time. Every file shares this run's one database, and
    // signup reads the whole users list, waits ~0.5s for bcrypt, then writes
    // the list back (routes/auth.ts), so two files signing up at once lose
    // each other's accounts and the loser's requests start answering 401.
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
