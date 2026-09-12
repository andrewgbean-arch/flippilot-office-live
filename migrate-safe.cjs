/**
 * FlipPilot Safe Migration Engine
 * --------------------------------
 * Handles Windows EPERM issues by:
 * - Removing existing target folders
 * - Moving src/web → web/src
 * - Moving src/mobile → mobile/src
 * - Moving src/shared → shared/
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const WEB = path.join(ROOT, "web");
const MOBILE = path.join(ROOT, "mobile");
const SHARED = path.join(ROOT, "shared");

function safeRemove(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function safeMove(from, to) {
  if (fs.existsSync(from)) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  }
}

console.log("🚀 Safe Migration Engine Starting...\n");

// Remove old target folders
safeRemove(WEB);
safeRemove(MOBILE);
safeRemove(SHARED);

// Move web
safeMove(path.join(SRC, "web"), path.join(WEB, "src"));
console.log("✔ Moved src/web → web/src");

// Move mobile
safeMove(path.join(SRC, "mobile"), path.join(MOBILE, "src"));
console.log("✔ Moved src/mobile → mobile/src");

// Move shared
safeMove(path.join(SRC, "shared"), SHARED);
console.log("✔ Moved src/shared → shared/");

// Remove old src
safeRemove(SRC);
console.log("✔ Removed old src folder");

console.log("\n🏁 Safe Migration Complete — Now run:");
console.log("   cd mobile");
console.log("   npx create-expo-app .");
