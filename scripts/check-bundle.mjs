#!/usr/bin/env node
/**
 * Bundle budget.
 *
 * Next 16 with Turbopack no longer prints a First Load JS column, so without
 * this there is no number at all — a barrel import that drags something heavy
 * into the shared graph lands silently on every route.
 *
 * What is measured, and what is not: this build emits no per-route client
 * manifest (`build-manifest.json` has an empty Pages-Router `pages` map), so
 * per-route totals are not available and are not invented here. What it does
 * measure is the shared entry every route loads (`rootMainFiles`), the largest
 * single chunk, and everything shipped under static/chunks. The first of those
 * is 90-100% of what a user actually downloads.
 *
 * Sizes are gzipped, because that is what crosses the wire. Byte counts are
 * stable run to run, which is why this is a build assertion while the rest of
 * the performance suite avoids wall-clock numbers entirely.
 *
 * Two things to know before touching the budget:
 *
 * 1. `next` is pinned to a preview release. Chunk boundaries move on upgrade,
 *    so a red run after a version bump means re-blessing the numbers on
 *    purpose — read the diff first, do not just raise the ceiling.
 * 2. This measures size, not speed. A route can pass here and still be slow.
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const NEXT = join(ROOT, ".next");
const BUDGET = JSON.parse(readFileSync(join(ROOT, ".bundle-budget.json"), "utf8"));

const read = (p) => {
  try {
    return JSON.parse(readFileSync(join(NEXT, p), "utf8"));
  } catch {
    return null;
  }
};

const manifest = read("build-manifest.json");
if (!manifest?.rootMainFiles) {
  console.error(
    "No usable build manifest under .next — run `npm run build` first.\n" +
      "If this started failing after a Next upgrade, check whether\n" +
      "rootMainFiles still exists in build-manifest.json."
  );
  process.exit(1);
}

const gzipOf = (rel) => {
  const path = join(NEXT, rel);
  try {
    statSync(path);
  } catch {
    return 0;
  }
  return gzipSync(readFileSync(path), { level: 9 }).length;
};

const shared = manifest.rootMainFiles
  .filter((f) => f.endsWith(".js"))
  .reduce((total, f) => total + gzipOf(f), 0);

const chunkDir = join(NEXT, "static/chunks");
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
};

const chunks = walk(chunkDir).map((full) => [
  full.replace(NEXT + "/", ""),
  gzipSync(readFileSync(full), { level: 9 }).length,
]);
const total = chunks.reduce((t, [, size]) => t + size, 0);
const largest = chunks.sort((a, b) => b[1] - a[1])[0] ?? ["\u2014", 0];

const kb = (n) => (n / 1024).toFixed(1);

const checks = [
  ["shared entry (every route)", shared, BUDGET.sharedKB, `${manifest.rootMainFiles.length} chunks`],
  ["largest single chunk", largest[1], BUDGET.largestChunkKB, largest[0].replace("static/chunks/", "")],
  ["all client chunks", total, BUDGET.totalKB, `${chunks.length} files`],
];

let failed = false;
console.log("Bundle budget (gzip)\n");
for (const [label, bytes, ceilingKB, note] of checks) {
  if (bytes === 0) {
    console.error(`  FAIL  ${label} measured 0 bytes — the manifest shape has changed.`);
    failed = true;
    continue;
  }
  const over = bytes / 1024 > ceilingKB;
  if (over) failed = true;
  console.log(
    `  ${over ? "FAIL" : "ok  "}  ${label.padEnd(28)} ${kb(bytes).padStart(8)} KB  / ${String(ceilingKB).padStart(5)} KB   ${note}`
  );
}

if (failed) {
  console.error(
    "\nOver budget. Find what grew before raising the ceiling \u2014 the usual cause\n" +
      "is an import that pulls a module into the shared graph rather than one route."
  );
  process.exit(1);
}
console.log("\nWithin budget.");
