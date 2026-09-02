#!/usr/bin/env node
/**
 * Build the self-hosted environment map used by the r3f scenes.
 *
 * drei's `<Environment preset="studio">` fetches a 1.6 MB uncompressed .hdr
 * from raw.githack.com (third-party, `cache-control: max-age=300`) and the
 * hero can't render until it lands. This script downloads that exact pinned
 * asset once, box-downsamples it, re-encodes it as RLE RGBE, and writes it to
 * `public/hdri/` so it's same-origin, immutable-cached, and preloadable.
 *
 * 512x256 is the sweet spot: PMREM builds 128px cube faces from it (vs 256px
 * from the 1k source), which is indistinguishable on R-sized reflections, at
 * ~1/4 the bytes.
 *
 * Source: studio_small_03 by Poly Haven (CC0), via pmndrs/drei-assets.
 *
 * Usage:
 *   node scripts/build-hdri.mjs                 # fetch + build 512x256
 *   node scripts/build-hdri.mjs --size 256      # different target width
 *   node scripts/build-hdri.mjs --src file.hdr  # use a local source instead
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { FloatType } from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const DREI_ASSETS =
  "https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/";
const SOURCE_NAME = "studio_small_03_1k.hdr";
const OUT_DIR = path.resolve(process.cwd(), "public/hdri");

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const targetWidth = Number(arg("--size", "512"));
const srcPath = arg("--src", null);

async function loadSource() {
  if (srcPath) return new Uint8Array(await fs.readFile(srcPath));
  const url = DREI_ASSETS + SOURCE_NAME;
  console.log(`fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Decode RGBE bytes to { width, height, data: Float32Array(RGBA) }. */
function decode(bytes) {
  const loader = new RGBELoader();
  loader.type = FloatType;
  const img = loader.parse(bytes.buffer);
  if (!img) throw new Error("RGBELoader failed to parse source");
  return img;
}

/** Box-filter RGBA float image down by an integer factor. */
function downsample(img, factor) {
  const w = Math.floor(img.width / factor);
  const h = Math.floor(img.height / factor);
  const out = new Float32Array(w * h * 3);
  const inv = 1 / (factor * factor);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < factor; sy++) {
        let si = ((y * factor + sy) * img.width + x * factor) * 4;
        for (let sx = 0; sx < factor; sx++, si += 4) {
          r += img.data[si];
          g += img.data[si + 1];
          b += img.data[si + 2];
        }
      }
      const o = (y * w + x) * 3;
      out[o] = r * inv;
      out[o + 1] = g * inv;
      out[o + 2] = b * inv;
    }
  }
  return { width: w, height: h, data: out };
}

/** Float RGB -> RGBE mantissa/exponent bytes (Radiance's float2rgbe). */
function floatToRgbe(r, g, b, out, o) {
  const v = Math.max(r, g, b);
  if (v < 1e-32) {
    out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
    return;
  }
  const e = Math.floor(Math.log2(v)) + 1;
  const scale = 256 / 2 ** e;
  out[o] = Math.min(255, Math.floor(r * scale));
  out[o + 1] = Math.min(255, Math.floor(g * scale));
  out[o + 2] = Math.min(255, Math.floor(b * scale));
  out[o + 3] = e + 128;
}

/** New-style RLE for one channel plane (runs >= 4 bytes, max 127; literals max 128). */
function rlePlane(plane, chunks) {
  const n = plane.length;
  let i = 0;
  while (i < n) {
    let run = 1;
    while (i + run < n && run < 127 && plane[i + run] === plane[i]) run++;
    if (run >= 4) {
      chunks.push(Uint8Array.of(128 + run, plane[i]));
      i += run;
      continue;
    }
    // literal: extend until the next run of >= 4 starts or we hit 128 bytes.
    let j = i + 1;
    while (j < n && j - i < 128) {
      let r = 1;
      while (j + r < n && r < 4 && plane[j + r] === plane[j]) r++;
      if (r >= 4) break;
      j++;
    }
    // slice (copy), not subarray: `plane` is a scratch buffer reused per row.
    chunks.push(Uint8Array.of(j - i), plane.slice(i, j));
    i = j;
  }
}

function encode({ width, height, data }, comment) {
  if (width < 8 || width > 0x7fff) throw new Error("RLE needs 8 <= width <= 32767");
  const header = `#?RADIANCE\n# ${comment}\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`;
  const chunks = [new TextEncoder().encode(header)];
  const rgbe = new Uint8Array(width * 4);
  const planes = [0, 1, 2, 3].map(() => new Uint8Array(width));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      floatToRgbe(data[i], data[i + 1], data[i + 2], rgbe, x * 4);
    }
    for (let c = 0; c < 4; c++) {
      for (let x = 0; x < width; x++) planes[c][x] = rgbe[x * 4 + c];
    }
    chunks.push(Uint8Array.of(2, 2, width >> 8, width & 0xff));
    for (let c = 0; c < 4; c++) rlePlane(planes[c], chunks);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
}

/** Sanity check: re-decode and compare against the floats we encoded. */
function verify(encoded, expected) {
  const img = decode(new Uint8Array(encoded));
  if (img.width !== expected.width || img.height !== expected.height) {
    throw new Error(`verify: size mismatch ${img.width}x${img.height}`);
  }
  let maxRel = 0;
  let sumExp = 0;
  let sumGot = 0;
  for (let p = 0; p < expected.width * expected.height; p++) {
    const e0 = expected.data[p * 3];
    const e1 = expected.data[p * 3 + 1];
    const e2 = expected.data[p * 3 + 2];
    // rgbe shares one exponent across rgb, so error is bounded relative to
    // the pixel's brightest channel (8-bit mantissa => <= 1/128), not per-channel.
    const peak = Math.max(e0, e1, e2);
    if (peak < 1e-6) continue;
    for (let c = 0; c < 3; c++) {
      const e = expected.data[p * 3 + c];
      const g = img.data[p * 4 + c];
      sumExp += e;
      sumGot += g;
      maxRel = Math.max(maxRel, Math.abs(g - e) / peak);
    }
  }
  if (maxRel > 1 / 128 + 1e-4) throw new Error(`verify: max error ${maxRel} of peak`);
  return { maxRel, meanRatio: sumGot / sumExp };
}

const src = await loadSource();
const source = decode(src);
const factor = Math.round(source.width / targetWidth);
if (factor < 1 || source.width % factor !== 0) {
  throw new Error(`source ${source.width}px isn't an integer multiple of ${targetWidth}`);
}
const small = factor === 1 ? { width: source.width, height: source.height, data: (() => {
  const d = new Float32Array(source.width * source.height * 3);
  for (let p = 0; p < source.width * source.height; p++) {
    d[p * 3] = source.data[p * 4];
    d[p * 3 + 1] = source.data[p * 4 + 1];
    d[p * 3 + 2] = source.data[p * 4 + 2];
  }
  return d;
})() } : downsample(source, factor);

const outName = `${SOURCE_NAME.replace(/_1k\.hdr$/, "")}_${small.width}.hdr`;
const encoded = encode(
  small,
  `${SOURCE_NAME} (Poly Haven, CC0) downsampled ${factor}x by scripts/build-hdri.mjs`,
);
const check = verify(encoded, small);

await fs.mkdir(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, outName);
await fs.writeFile(outPath, encoded);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `${source.width}x${source.height} (${kb(src.byteLength)}) -> ${small.width}x${small.height} (${kb(encoded.byteLength)})`,
);
console.log(
  `verify: max err ${(check.maxRel * 100).toFixed(2)}% of pixel peak, mean ratio ${check.meanRatio.toFixed(4)}`,
);
console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
