import fs from "node:fs";
import path from "node:path";
import { testDataDir } from "./vitest.testEnv";

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

  fs.mkdirSync(dir, { recursive: true });
  return () => {
    fs.rmSync(dir, { recursive: true, force: true });
  };
}
