import { defineConfig } from "vitest/config";
import { BLANKED_VARIABLES, testDataDir } from "./vitest.testEnv";

// See vitest.testEnv.ts for why the tests run in a private environment.
export default defineConfig({
  test: {
    globalSetup: ["./vitest.globalSetup.ts"],
    env: {
      ...Object.fromEntries(BLANKED_VARIABLES.map(name => [name, ""])),
      DATA_DIR: testDataDir(),
      JWT_SECRET: "test-only-secret-never-used-outside-the-test-suite",
      // 64 hex characters, as credentialCrypto.ts requires. Not a real key.
      CREDENTIAL_ENCRYPTION_KEY: "ab".repeat(32),
    },
  },
});
