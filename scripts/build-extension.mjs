// Packages the Vite build output into a loadable unpacked Chrome extension by
// adding the two files Vite doesn't know about:
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
// Two modes:
//   * one-shot (default) — invoked via `npm run build:extension`, which runs
//     `npm run build` first, then this script copies the two files into the
//     freshly built dist/. Does not replace the plain `npm run build` /
//     `npm run dev` / `npm run preview` web workflow.
//   * --watch — invoked via `npm run build:extension:watch`. This script
//     itself launches `vite build --watch` (so it does NOT need a prior
//     `npm run build`), then re-copies manifest.json + background.js after
//     every rebuild. Chrome does NOT hot-reload unpacked extensions, so you
//     still have to click the reload ↻ button on chrome://extensions after
//     each rebuild. Auto-reloading the extension is out of scope here.

import { readFileSync, writeFileSync, existsSync, mkdirSync, watch } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, "dist");

const manifestSrc = path.join(rootDir, "manifest.json");
const manifestDest = path.join(distDir, "manifest.json");
const backgroundSrc = path.join(rootDir, "src", "extension", "background.ts");
const backgroundDest = path.join(distDir, "background.js");

const isWatch = process.argv.includes("--watch");

// Copy the two extension-only files into dist/. `verbose` prints the
// per-file lines used by the one-shot build; watch mode logs a single
// terse line instead to avoid flooding the console on every rebuild.
function copyExtras(verbose) {
  mkdirSync(distDir, { recursive: true });
  writeFileSync(manifestDest, readFileSync(manifestSrc, "utf8"));
  writeFileSync(backgroundDest, readFileSync(backgroundSrc, "utf8"));
  if (verbose) {
    console.log("Copied manifest.json -> dist/manifest.json");
    console.log("Copied src/extension/background.ts -> dist/background.js");
  } else {
    console.log("[extension] Re-copied manifest.json + background.js into dist/");
  }
}

if (!isWatch) {
  // One-shot: `npm run build` has already produced dist/; just add our files.
  if (!existsSync(distDir)) {
    console.error("dist/ not found — expected `npm run build` to have run first.");
    process.exit(1);
  }

  copyExtras(true);

  console.log("\nExtension build ready in dist/.");
  console.log('Load it via chrome://extensions -> enable "Developer mode" -> "Load unpacked" -> select the dist/ folder.');
  console.log("After each rebuild, click the reload ↻ button on the extension's card at chrome://extensions.");
  console.log("For continuous rebuilds while you edit, run: npm run build:extension:watch");
} else {
  // Watch: this script owns the whole loop. We start `vite build --watch`
  // ourselves (no prior `npm run build` needed) and re-copy our two files
  // after each rebuild.
  //
  // dist/ must exist before we can watch it. Vite's first build empties
  // dist/ (emptyOutDir) but leaves the directory itself in place, so a
  // watcher attached to the directory survives that and every later rebuild.
  mkdirSync(distDir, { recursive: true });

  // Re-copying is debounced: a single Vite rebuild fires several filesystem
  // events, and we only want one copy once index.html has been (re)written.
  let timer = null;
  function scheduleCopy() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Only copy once Vite has produced a build (index.html present).
      if (existsSync(path.join(distDir, "index.html"))) {
        copyExtras(false);
      }
    }, 200);
  }

  // Watch the build output: whenever Vite writes/rewrites dist/ (including
  // after its initial emptyOutDir), re-copy manifest.json + background.js.
  // Ignore events for our own two output files — copying them into dist/
  // would otherwise retrigger this watcher and spin an endless copy loop.
  const ownOutputs = new Set(["manifest.json", "background.js"]);
  watch(distDir, (_eventType, filename) => {
    if (filename && ownOutputs.has(filename)) return;
    scheduleCopy();
  });

  // background.ts and manifest.json are copied verbatim and are NOT part of
  // Vite's module graph, so editing them does not trigger a Vite rebuild.
  // Watch them directly and re-copy on change.
  watch(backgroundSrc, scheduleCopy);
  watch(manifestSrc, scheduleCopy);

  console.log("[extension] Watch mode: starting `vite build --watch`.");
  console.log("[extension] dist/ rebuilds automatically on source changes.");
  console.log("[extension] Chrome does NOT hot-reload unpacked extensions —");
  console.log("[extension] click reload ↻ on chrome://extensions after each rebuild.");
  console.log("[extension] Note: this skips the `tsc -b` type-check that `npm run build` runs.\n");

  // Inherit stdio so Vite's build/rebuild logs stream straight through.
  const vite = spawn("npx", ["vite", "build", "--watch"], {
    cwd: rootDir,
    stdio: "inherit",
  });

  vite.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => vite.kill("SIGINT"));
  process.on("SIGTERM", () => vite.kill("SIGTERM"));
}
