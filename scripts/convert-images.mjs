#!/usr/bin/env node
/**
 * Walk `public/assets` and produce a `.webp` sibling for every PNG/JPG over
 * a size threshold. Skips files we explicitly want to keep as-is:
 *   - site-preview.png (OG image; max crawler compat)
 *   - my-avatar.png    (only referenced by legacy variants)
 *   - anything under public/variants (those HTML files reference originals)
 *   - already-converted images that have an up-to-date .webp sibling
 *
 * Quality 82 is the sweet spot: visually lossless against PNG sources, with
 * ~75-85% size reduction. Larger photos get effort:6 for better compression.
 *
 * Usage:
 *   node scripts/convert-images.mjs              # convert
 *   node scripts/convert-images.mjs --dry-run    # report only, no writes
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd(), "public/assets");
const DRY_RUN = process.argv.includes("--dry-run");
const MIN_BYTES = 50 * 1024; // skip tiny icons/sprites where webp gains are noise.

// files we keep as the original format on purpose.
const SKIP_BASENAMES = new Set([
  "site-preview.png", // OG image, max crawler compatibility
  "my-avatar.png", // referenced by legacy /variants only
]);

const WEBP_QUALITY = 82;
const WEBP_EFFORT = 6;

/** Recursively yield every regular file under `dir`. */
async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function shouldConvert(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) return false;
  if (SKIP_BASENAMES.has(path.basename(file))) return false;
  return true;
}

async function isFresh(srcPath, webpPath) {
  try {
    const [src, webp] = await Promise.all([
      fs.stat(srcPath),
      fs.stat(webpPath),
    ]);
    // re-encode if the source has been modified since the webp was written.
    return webp.mtimeMs >= src.mtimeMs;
  } catch {
    return false;
  }
}

const fmt = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)}MB`
    : `${(bytes / 1024).toFixed(0)}KB`;

async function main() {
  const tasks = [];
  for await (const file of walk(ROOT)) {
    if (!shouldConvert(file)) continue;
    const stat = await fs.stat(file);
    if (stat.size < MIN_BYTES) continue;

    const webpPath = file.replace(/\.(png|jpe?g)$/i, ".webp");
    if (await isFresh(file, webpPath)) continue;

    tasks.push({ src: file, dst: webpPath, srcSize: stat.size });
  }

  if (tasks.length === 0) {
    console.log("No images need conversion.");
    return;
  }

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}Converting ${tasks.length} image${tasks.length === 1 ? "" : "s"}...\n`,
  );

  let totalSrc = 0;
  let totalDst = 0;
  for (const { src, dst, srcSize } of tasks) {
    totalSrc += srcSize;
    if (DRY_RUN) {
      console.log(`  would convert ${path.relative(process.cwd(), src)} (${fmt(srcSize)})`);
      continue;
    }
    try {
      await sharp(src)
        .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
        .toFile(dst);
      const out = await fs.stat(dst);
      // some source images (pixel-art sprites, sharp-edged ui screenshots
      // already aggressively quantized to 8-bit PNG) round-trip *larger*
      // as webp. discard those so we don't waste bytes; the original PNG
      // reference stays in code.
      if (out.size >= srcSize) {
        await fs.unlink(dst);
        totalSrc -= srcSize; // exclude from totals so the summary stays meaningful.
        console.log(
          `  - ${path.relative(process.cwd(), src)}: webp ${fmt(out.size)} ≥ source ${fmt(srcSize)}, kept original`,
        );
        continue;
      }
      totalDst += out.size;
      const saved = ((1 - out.size / srcSize) * 100).toFixed(0);
      console.log(
        `  ✓ ${path.relative(process.cwd(), src)}: ${fmt(srcSize)} → ${fmt(out.size)}  (-${saved}%)`,
      );
    } catch (err) {
      console.error(`  ✗ ${path.relative(process.cwd(), src)}: ${err.message}`);
    }
  }

  if (!DRY_RUN) {
    const savedTotal = totalSrc - totalDst;
    const pct = ((savedTotal / totalSrc) * 100).toFixed(0);
    console.log(
      `\nDone. ${fmt(totalSrc)} → ${fmt(totalDst)}, saved ${fmt(savedTotal)} (-${pct}%).`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
