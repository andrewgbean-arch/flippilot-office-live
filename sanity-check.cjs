/**
 * FlipPilot Sanity Check Engine (Safe Mode)
 * -----------------------------------------
 * Fixes EISDIR by ensuring only files are read.
 * Detects:
 * - Broken alias imports
 * - Orphaned files
 * - Circular dependencies (safe)
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

function extractImports(content) {
  const regex = /from ["'](.+?)["']/g;
  const imports = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function resolveAlias(alias) {
  if (alias.startsWith("@web/")) {
    return alias.replace("@web/", WEB + "/");
  }
  if (alias.startsWith("@mobile/")) {
    return alias.replace("@mobile/", MOBILE + "/");
  }
  return null;
}

function fileExists(alias) {
  const real = resolveAlias(alias);
  return real && fs.existsSync(real);
}

function detectCircular(filePath, stack = new Set()) {
  if (stack.has(filePath)) return true;
  stack.add(filePath);

  const content = fs.readFileSync(filePath, "utf8");
  const imports = extractImports(content);

  for (const imp of imports) {
    const real = resolveAlias(imp);
    if (!real) continue;
    if (!fs.existsSync(real)) continue;

    const stat = fs.statSync(real);
    if (!stat.isFile()) continue; // FIX: skip directories

    if (detectCircular(real, stack)) return true;
  }

  stack.delete(filePath);
  return false;
}

console.log("🚀 FlipPilot Sanity Check Engine Starting...\n");

const files = getAllFiles(ROOT);
const brokenAliases = [];
const orphanedFiles = [];
const circularDeps = [];
const importMap = new Map();

// Build import map
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const imports = extractImports(content);
  importMap.set(file, imports);
}

// Broken alias detection
for (const [file, imports] of importMap.entries()) {
  for (const imp of imports) {
    if (imp.startsWith("@web/") || imp.startsWith("@mobile/")) {
      if (!fileExists(imp)) {
        brokenAliases.push({ file, imp });
      }
    }
  }
}

// Orphaned files
for (const file of files) {
  let used = false;

  for (const imports of importMap.values()) {
    for (const imp of imports) {
      const real = resolveAlias(imp);
      if (real === file) used = true;
    }
  }

  if (!used) orphanedFiles.push(file);
}

// Circular dependencies
for (const file of files) {
  if (detectCircular(file)) {
    circularDeps.push(file);
  }
}

console.log("🔗 Broken Aliases:", brokenAliases.length);
console.log("🗂 Orphaned Files:", orphanedFiles.length);
console.log("♻ Circular Dependencies:", circularDeps.length);

console.log("\n🏁 Sanity Check Complete.");
