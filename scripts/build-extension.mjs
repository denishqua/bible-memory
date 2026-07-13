// Packages the Vite build output (already produced by `npm run build`, which
// this script assumes has just run) into a loadable unpacked Chrome
// extension by adding the two files Vite doesn't know about:
//   - manifest.json (repo root -> dist/manifest.json)
//   - background.js (src/extension/background.ts -> dist/background.js)
//
// background.ts is deliberately written in plain, bundler-free
// JS-compatible TypeScript (no imports, no type annotations, no
// TS-only syntax), so it can be copied verbatim instead of run through a
// bundler/transpiler — this repo's Vite (v8, rolldown-based) doesn't ship
// esbuild as a transitive dependency the way older Vite versions did, so a
// straight copy is the least brittle option.
//
// This script is only ever invoked via `npm run build:extension`, which
// runs `npm run build` first — it does not replace or alter the plain
// `npm run build` / `npm run dev` / `npm run preview` web workflow.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, "dist");

if (!existsSync(distDir)) {
  console.error("dist/ not found — expected `npm run build` to have run first.");
  process.exit(1);
}

// 1. Copy manifest.json into dist/
const manifestSrc = path.join(rootDir, "manifest.json");
const manifestDest = path.join(distDir, "manifest.json");
writeFileSync(manifestDest, readFileSync(manifestSrc, "utf8"));
console.log("Copied manifest.json -> dist/manifest.json");

// 2. Copy the background service worker into dist/ as background.js
const backgroundSrc = path.join(rootDir, "src", "extension", "background.ts");
const backgroundDest = path.join(distDir, "background.js");
mkdirSync(distDir, { recursive: true });
writeFileSync(backgroundDest, readFileSync(backgroundSrc, "utf8"));
console.log("Copied src/extension/background.ts -> dist/background.js");

console.log("\nExtension build ready in dist/.");
console.log('Load it via chrome://extensions -> enable "Developer mode" -> "Load unpacked" -> select the dist/ folder.');
