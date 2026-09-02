#!/usr/bin/env node
/**
 * Post-build: add `<link rel="preload" as="font">` hints to the static export.
 *
 * next/font normally emits these itself, but Next 15's App Router skips them
 * under `output: "export"`, so the browser only discovers the woff2 files
 * after downloading and parsing the CSS - one extra round trip before the
 * hero headline (the LCP element, set in Fraunces) can swap in.
 *
 * next/font marks the files it intends to preload with a `.p.woff2` suffix
 * (the requested subsets of every font with `preload: true`), so we scan the
 * emitted CSS for those and inject one hint per file into every Next-rendered
 * HTML page, right before the first stylesheet so they're queued as early as
 * Next would have queued them.
 *
 * Runs as part of `npm run build`. Idempotent.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "out");
const CSS_DIR = path.join(OUT, "_next", "static", "css");

/** Recursively yield every .html file under `dir`. */
async function* htmlFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.isFile() && entry.name.endsWith(".html")) yield full;
  }
}

const cssFiles = (await fs.readdir(CSS_DIR)).filter((f) => f.endsWith(".css"));
const fonts = new Set();
for (const f of cssFiles) {
  const css = await fs.readFile(path.join(CSS_DIR, f), "utf8");
  for (const m of css.matchAll(/url\((\/_next\/static\/media\/[^)]+-s\.p\.woff2)\)/g)) {
    fonts.add(m[1]);
  }
}

if (fonts.size === 0) {
  console.log("inject-font-preloads: no .p.woff2 fonts found in emitted css, nothing to do");
  process.exit(0);
}

const tags = [...fonts]
  .sort()
  .map(
    (href) =>
      `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin="anonymous"/>`,
  )
  .join("");

let touched = 0;
for await (const file of htmlFiles(OUT)) {
  const html = await fs.readFile(file, "utf8");
  // only pages rendered by next (the legacy /variants and /spotify.html etc.
  // don't use next/font). skip if already injected.
  if (!html.includes("/_next/static/css/") || html.includes('as="font"')) continue;
  const anchor = html.indexOf('<link rel="stylesheet"');
  if (anchor === -1) continue;
  await fs.writeFile(file, html.slice(0, anchor) + tags + html.slice(anchor));
  touched++;
}

console.log(
  `inject-font-preloads: ${fonts.size} font(s) -> ${touched} page(s)\n  ${[...fonts].sort().join("\n  ")}`,
);
