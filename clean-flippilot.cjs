/**
 * FlipPilot Cleanup Engine (Safe Mode)
 * ------------------------------------
 * Scans first, moves second. Prevents ENOENT errors.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "src");
const WEB = path.join(ROOT, "web");
const MOBILE = path.join(ROOT, "mobile");

const rnIndicators = [
  "react-native",
  "expo-",
  "expo/",
  ".ios.tsx",
  ".native.tsx",
  "StyleSheet.create",
  "Pressable",
  "View",
  "Text",
  "Image",
];

function ensureDirs() {
  [WEB, MOBILE].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function isRNFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return rnIndicators.some((indicator) => content.includes(indicator));
}

function scanFiles(dir, list = []) {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (full === WEB || full === MOBILE) continue;
      scanFiles(full, list);
    } else if (stat.isFile()) {
      if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        list.push(full);
      }
    }
  }

  return list;
}

function moveFiles(files) {
  for (const filePath of files) {
    const relative = path.relative(ROOT, filePath);
    const destDir = isRNFile(filePath) ? MOBILE : WEB;
    const dest = path.join(destDir, relative);

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(filePath, dest);

    console.log(`✔ Moved: ${relative} → ${destDir.includes("mobile") ? "mobile" : "web"}`);
  }
}

console.log("🚀 FlipPilot Cleanup Engine Starting...");
ensureDirs();

const files = scanFiles(ROOT);
moveFiles(files);

console.log("🏁 Cleanup Complete — Review src/web/ and src/mobile/");
