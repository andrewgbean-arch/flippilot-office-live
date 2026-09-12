/**
 * FlipPilot Import Rewrite Engine (Alias Mode)
 * --------------------------------------------
 * Rewrites all imports to @web/* and @mobile/*
 * Removes invalid imports (RN in web, Tailwind in mobile)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "src");
const WEB = path.join(ROOT, "web");
const MOBILE = path.join(ROOT, "mobile");

function getAllFiles(dir, list = []) {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      getAllFiles(full, list);
    } else if (stat.isFile() && (entry.endsWith(".ts") || entry.endsWith(".tsx"))) {
      list.push(full);
    }
  }

  return list;
}

function rewriteImports(filePath) {
  const isWeb = filePath.startsWith(WEB);
  const isMobile = filePath.startsWith(MOBILE);

  let content = fs.readFileSync(filePath, "utf8");

  // Remove RN imports from web
  if (isWeb) {
    content = content.replace(/import .*?from ["']react-native["'];?/g, "");
    content = content.replace(/import .*?from ["']expo-.*?["'];?/g, "");
  }

  // Remove Tailwind imports from mobile
  if (isMobile) {
    content = content.replace(/import .*?\.css["'];?/g, "");
    content = content.replace(/import .*?tailwind.*?["'];?/g, "");
  }

  // Rewrite relative imports to aliases
  content = content.replace(/from ["'](\.\.?\/.*)["']/g, (match, relPath) => {
    const absolute = path.resolve(path.dirname(filePath), relPath);

    if (absolute.startsWith(WEB)) {
      const aliasPath = absolute.replace(WEB, "@web").replace(/\\/g, "/");
      return `from "${aliasPath}"`;
    }

    if (absolute.startsWith(MOBILE)) {
      const aliasPath = absolute.replace(MOBILE, "@mobile").replace(/\\/g, "/");
      return `from "${aliasPath}"`;
    }

    return match;
  });

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`✔ Rewritten imports in: ${path.relative(ROOT, filePath)}`);
}

console.log("🚀 FlipPilot Import Rewrite Engine Starting...");

const files = getAllFiles(ROOT);
files.forEach(rewriteImports);

console.log("🏁 Import Rewrite Complete — Aliases applied.");
