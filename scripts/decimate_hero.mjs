// one-shot decimator for the hero R glb. reads the draco-compressed source,
// runs meshopt simplify down to a much smaller triangle count, recomputes
// vertex normals from scratch, and writes a fresh uncompressed glb back to
// public/models/letter_R.glb. the original is preserved as letter_R_original.glb
// the first time this runs.
//
// usage: node scripts/decimate_hero.mjs

import { promises as fs } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const draco3d = require("draco3d");
const { MeshoptSimplifier } = require("meshoptimizer");

const TARGET_TRIS = 15000;
const TARGET_INDEX_COUNT = TARGET_TRIS * 3;
const TARGET_ERROR = 0.01;

const SRC = "public/models/letter_R.glb";
const BACKUP = "public/models/letter_R_original.glb";

const GLB_MAGIC = 0x46546c67; // 'glTF'
const JSON_CHUNK = 0x4e4f534a; // 'JSON'
const BIN_CHUNK = 0x004e4942; // 'BIN\0'

function parseGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = dv.getUint32(0, true);
  if (magic !== GLB_MAGIC) throw new Error("not a glb");
  const total = dv.getUint32(8, true);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < total) {
    const chunkLen = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const start = offset + 8;
    const payload = buf.subarray(start, start + chunkLen);
    if (chunkType === JSON_CHUNK) {
      json = JSON.parse(new TextDecoder().decode(payload).replace(/\0+$/, ""));
    } else if (chunkType === BIN_CHUNK) {
      bin = payload;
    }
    offset = start + chunkLen;
  }
  return { json, bin };
}

async function decodeDraco(dracoBytes) {
  const decoderModule = await draco3d.createDecoderModule({});
  const buffer = new decoderModule.DecoderBuffer();
  buffer.Init(
    new Int8Array(
      dracoBytes.buffer,
      dracoBytes.byteOffset,
      dracoBytes.byteLength,
    ),
    dracoBytes.byteLength,
  );
  const decoder = new decoderModule.Decoder();
  const geomType = decoder.GetEncodedGeometryType(buffer);
  if (geomType !== decoderModule.TRIANGULAR_MESH)
    throw new Error("not a triangular mesh");
  const mesh = new decoderModule.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok())
    throw new Error("draco decode failed: " + status.error_msg());

  const numFaces = mesh.num_faces();
  const numPoints = mesh.num_points();
  const indices = new Uint32Array(numFaces * 3);
  const ia = new decoderModule.DracoInt32Array();
  for (let i = 0; i < numFaces; i++) {
    decoder.GetFaceFromMesh(mesh, i, ia);
    const o = i * 3;
    indices[o] = ia.GetValue(0);
    indices[o + 1] = ia.GetValue(1);
    indices[o + 2] = ia.GetValue(2);
  }
  decoderModule.destroy(ia);

  const attrId = decoder.GetAttributeId(mesh, decoderModule.POSITION);
  if (attrId < 0) throw new Error("no position attribute");
  const attr = decoder.GetAttribute(mesh, attrId);
  const data = new decoderModule.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(mesh, attr, data);
  const positions = new Float32Array(numPoints * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = data.GetValue(i);
  decoderModule.destroy(data);

  decoderModule.destroy(mesh);
  decoderModule.destroy(decoder);
  decoderModule.destroy(buffer);
  return { indices, positions };
}

// weld duplicate vertices at a small spatial tolerance and remap indices. this
// dramatically improves the simplifier's quality because identical position
// verts that were stored separately can be collapsed into one cut candidate.
function weldVertices(indices, positions, tol = 1e-4) {
  const n = positions.length / 3;
  const grid = new Map();
  const remap = new Uint32Array(n);
  const newPos = [];
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.round(x / tol)}_${Math.round(y / tol)}_${Math.round(z / tol)}`;
    const existing = grid.get(key);
    if (existing !== undefined) {
      remap[i] = existing;
    } else {
      const nextIdx = newPos.length / 3;
      newPos.push(x, y, z);
      grid.set(key, nextIdx);
      remap[i] = nextIdx;
    }
  }
  const newIdx = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) newIdx[i] = remap[indices[i]];
  return { indices: newIdx, positions: new Float32Array(newPos) };
}

function computeNormals(indices, positions) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;
    const ax = positions[ia],
      ay = positions[ia + 1],
      az = positions[ia + 2];
    const bx = positions[ib],
      by = positions[ib + 1],
      bz = positions[ib + 2];
    const cx = positions[ic],
      cy = positions[ic + 1],
      cz = positions[ic + 2];
    const e1x = bx - ax,
      e1y = by - ay,
      e1z = bz - az;
    const e2x = cx - ax,
      e2y = cy - ay,
      e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    normals[ia] += nx;
    normals[ia + 1] += ny;
    normals[ia + 2] += nz;
    normals[ib] += nx;
    normals[ib + 1] += ny;
    normals[ib + 2] += nz;
    normals[ic] += nx;
    normals[ic + 1] += ny;
    normals[ic + 2] += nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i],
      y = normals[i + 1],
      z = normals[i + 2];
    const len = Math.hypot(x, y, z) || 1;
    normals[i] = x / len;
    normals[i + 1] = y / len;
    normals[i + 2] = z / len;
  }
  return normals;
}

const pad4 = (n) => (n + 3) & ~3;

function buildGlb(indices, positions, normals) {
  const idxBytes = indices.byteLength;
  const posBytes = positions.byteLength;
  const norBytes = normals.byteLength;

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = positions[i + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }

  const idxOff = 0;
  const posOff = pad4(idxOff + idxBytes);
  const norOff = pad4(posOff + posBytes);
  const totalBin = pad4(norOff + norBytes);

  const gltf = {
    asset: { version: "2.0", generator: "personal-website decimate_hero.mjs" },
    buffers: [{ byteLength: totalBin }],
    bufferViews: [
      { buffer: 0, byteOffset: idxOff, byteLength: idxBytes, target: 34963 },
      { buffer: 0, byteOffset: posOff, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: norOff, byteLength: norBytes, target: 34962 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5125,
        count: indices.length,
        type: "SCALAR",
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: positions.length / 3,
        type: "VEC3",
        min,
        max,
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: normals.length / 3,
        type: "VEC3",
      },
    ],
    meshes: [
      {
        name: "Mesh1",
        primitives: [
          { attributes: { POSITION: 1, NORMAL: 2 }, indices: 0, mode: 4 },
        ],
      },
    ],
    nodes: [{ name: "Mesh1.0", mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };

  let jsonStr = JSON.stringify(gltf);
  while (jsonStr.length % 4 !== 0) jsonStr += " ";
  const jsonBytes = new TextEncoder().encode(jsonStr);

  const bin = new Uint8Array(totalBin);
  bin.set(new Uint8Array(indices.buffer, indices.byteOffset, idxBytes), idxOff);
  bin.set(
    new Uint8Array(positions.buffer, positions.byteOffset, posBytes),
    posOff,
  );
  bin.set(new Uint8Array(normals.buffer, normals.byteOffset, norBytes), norOff);

  const totalLen = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength;
  const glb = new Uint8Array(totalLen);
  const dv = new DataView(glb.buffer);
  dv.setUint32(0, GLB_MAGIC, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, totalLen, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, JSON_CHUNK, true);
  glb.set(jsonBytes, 20);
  const binChunkStart = 20 + jsonBytes.byteLength;
  dv.setUint32(binChunkStart, bin.byteLength, true);
  dv.setUint32(binChunkStart + 4, BIN_CHUNK, true);
  glb.set(bin, binChunkStart + 8);
  return glb;
}

async function main() {
  const raw = await fs.readFile(SRC);
  const { json, bin } = parseGlb(raw);
  const prim = json.meshes[0].primitives[0];
  const ext = prim.extensions?.KHR_draco_mesh_compression;
  if (!ext) throw new Error("no draco extension on primitive");
  const bv = json.bufferViews[ext.bufferView];
  const dracoBytes = bin.subarray(
    bv.byteOffset || 0,
    (bv.byteOffset || 0) + bv.byteLength,
  );
  console.log(
    `source: ${raw.byteLength} bytes, draco buffer ${dracoBytes.byteLength} bytes`,
  );

  const decoded = await decodeDraco(dracoBytes);
  console.log(
    `decoded: ${decoded.positions.length / 3} verts, ${decoded.indices.length / 3} tris`,
  );

  const welded = weldVertices(decoded.indices, decoded.positions);
  console.log(
    `welded: ${welded.positions.length / 3} verts, ${welded.indices.length / 3} tris`,
  );

  await MeshoptSimplifier.ready;
  const targetIdx = Math.min(TARGET_INDEX_COUNT, welded.indices.length);
  const [simplifiedIdx, error] = MeshoptSimplifier.simplify(
    welded.indices,
    welded.positions,
    3,
    targetIdx,
    TARGET_ERROR,
    ["LockBorder"],
  );
  console.log(
    `simplified: ${simplifiedIdx.length / 3} tris, error=${error.toFixed(5)}`,
  );

  // pack: only keep verts referenced by simplified indices.
  const used = new Map();
  const newIdx = new Uint32Array(simplifiedIdx.length);
  let next = 0;
  for (let i = 0; i < simplifiedIdx.length; i++) {
    const v = simplifiedIdx[i];
    let mapped = used.get(v);
    if (mapped === undefined) {
      mapped = next++;
      used.set(v, mapped);
    }
    newIdx[i] = mapped;
  }
  const newPos = new Float32Array(next * 3);
  for (const [oldI, newI] of used) {
    newPos[newI * 3] = welded.positions[oldI * 3];
    newPos[newI * 3 + 1] = welded.positions[oldI * 3 + 1];
    newPos[newI * 3 + 2] = welded.positions[oldI * 3 + 2];
  }
  const newNor = computeNormals(newIdx, newPos);
  console.log(`packed: ${next} verts, ${newIdx.length / 3} tris`);

  try {
    await fs.access(BACKUP);
    console.log("backup already exists, leaving it");
  } catch {
    await fs.writeFile(BACKUP, raw);
    console.log(`backup written: ${BACKUP} (${raw.byteLength} bytes)`);
  }

  const glb = buildGlb(newIdx, newPos, newNor);
  await fs.writeFile(SRC, glb);
  console.log(`wrote ${SRC}: ${glb.byteLength} bytes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
