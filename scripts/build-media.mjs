#!/usr/bin/env node
/**
 * Derived media for the project screenshots under `public/assets/projects`.
 * Runs before `next dev` / `next build` (npm pre-hooks) so it's always in sync.
 *
 * 1. LQIP siblings: `<name>.lqip.webp`, 32px wide with a light blur baked in.
 *    MediaFrame's blurred backdrop used to render the full-size screenshot a
 *    second time under `filter: blur(24px)`, which is a large offscreen
 *    surface + multi-pass blur per card, re-rasterized on every hover scale.
 *    Upscaling a 32px image gives the same soft wash with no filter at all.
 *    These are gitignored (`*.lqip.webp`) - they're ~300 bytes each and
 *    regenerate in under a second.
 *
 * 2. `lib/mediaDimensions.json`: intrinsic width/height per raster source, so
 *    `<img>`s that size with `w-full h-auto` can reserve their aspect ratio
 *    and stop shifting layout as they load (mobile project stack). Committed,
 *    since typecheck needs it and it's deterministic.
 *
 * Usage: node scripts/build-media.mjs [--force]
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd(), "public/assets/projects");
const MANIFEST = path.resolve(process.cwd(), "lib/mediaDimensions.json");
const FORCE = process.argv.includes("--force");

const LQIP_WIDTH = 32;
const LQIP_BLUR = 1;
const LQIP_QUALITY = 60;

const RASTER = /\.(png|webp|jpe?g)$/i;
const isLqip = (name) => /\.lqip\.webp$/i.test(name);

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

async function mtime(file) {
  try {
    return (await fs.stat(file)).mtimeMs;
  } catch {
    return -Infinity;
  }
}

export function lqipPath(src) {
  return src.replace(RASTER, ".lqip.webp");
}

const dims = {};
let written = 0;
let skipped = 0;

for await (const file of walk(ROOT)) {
  const name = path.basename(file);
  if (!RASTER.test(name) || isLqip(name)) continue;

  const meta = await sharp(file).metadata();
  const publicSrc = "/" + path.relative(path.resolve("public"), file).split(path.sep).join("/");
  dims[publicSrc] = { w: meta.width, h: meta.height };

  const out = lqipPath(file);
  if (!FORCE && (await mtime(out)) >= (await mtime(file))) {
    skipped++;
    continue;
  }
  await sharp(file)
    .resize({ width: LQIP_WIDTH, withoutEnlargement: true })
    .blur(LQIP_BLUR)
    .webp({ quality: LQIP_QUALITY })
    .toFile(out);
  written++;
}

const sorted = Object.fromEntries(
  Object.entries(dims).sort(([a], [b]) => a.localeCompare(b)),
);
const json = JSON.stringify(sorted, null, 2) + "\n";
const prev = await fs.readFile(MANIFEST, "utf8").catch(() => "");
if (prev !== json) await fs.writeFile(MANIFEST, json);

console.log(
  `build-media: ${written} lqip written, ${skipped} up to date; ${Object.keys(sorted).length} entries in lib/mediaDimensions.json${prev !== json ? " (updated)" : ""}`,
);
