import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeProjectObject, applyProjectTwist } from "../lib/projectObjectGeometry.ts";

function turn(p, amount) {
  const a = p.y * amount / 3;
  return new THREE.Vector3(Math.cos(a) * p.x + Math.sin(a) * p.z, p.y, -Math.sin(a) * p.x + Math.cos(a) * p.z);
}

test("bakes nested and mirrored transforms without changing source geometry", () => {
  const root = new THREE.Group();
  const child = new THREE.Group();
  child.rotation.set(0.3, 0.6, -0.4);
  child.position.set(2, -1, 0.5);
  child.scale.set(-1, 2, 0.7);
  const geometry = new THREE.BoxGeometry(2, 3, 0.5);
  const original = Array.from(geometry.attributes.position.array);
  child.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
  root.add(child);
  const baked = bakeProjectObject(root);
  assert.equal(baked.children.length, 1);
  const mesh = baked.children[0];
  assert.ok(mesh.matrix.equals(new THREE.Matrix4()));
  assert.deepEqual(Array.from(geometry.attributes.position.array), original);
  const p = mesh.geometry.attributes.position;
  const n = mesh.geometry.attributes.normal;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i);
    const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const normal = new THREE.Vector3().fromBufferAttribute(n, i);
    assert.ok(a.length() <= 3.00001);
    assert.ok(Math.abs(normal.length() - 1) < 1e-6);
    assert.ok(b.sub(a).cross(c.sub(a)).dot(normal) >= -1e-7);
  }
});

test("bakes instances and their colors into the same mesh", () => {
  const root = new THREE.Group();
  const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 2);
  instances.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-1, 0, 0));
  instances.setMatrixAt(1, new THREE.Matrix4().makeTranslation(1, 0, 0));
  instances.setColorAt(0, new THREE.Color("red"));
  instances.setColorAt(1, new THREE.Color("blue"));
  root.add(instances);
  const mesh = bakeProjectObject(root).children[0];
  assert.ok(!mesh.isInstancedMesh);
  assert.equal(mesh.material.length, 1);
  assert.equal(mesh.material[0].vertexColors, true);
  const p = mesh.geometry.attributes.position;
  const color = mesh.geometry.attributes.color;
  for (let i = 0; i < p.count; i++) {
    assert.equal(color.getX(i), p.getX(i) < 0 ? 1 : 0);
    assert.equal(color.getZ(i), p.getX(i) < 0 ? 0 : 1);
  }
});

test("expands quantized GLB positions before applying node transforms", () => {
  const geometry = new THREE.BoxGeometry();
  const positions = geometry.attributes.position;
  const values = Int16Array.from(positions.array, (value) => Math.round(value * 32767));
  geometry.setAttribute("position", new THREE.Int16BufferAttribute(values, 3, true));
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.scale.set(40, 10, 2);
  mesh.position.set(50, 30, -20);
  root.add(mesh);
  const baked = bakeProjectObject(root).children[0];
  const size = baked.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x / size.y - 4) < 1e-5);
  assert.ok(Math.abs(size.x / size.z - 20) < 1e-5);
});

test("preserves material groups and UVs while bounding twist interpolation error", () => {
  const root = new THREE.Group();
  const colors = ["red", "blue", "green", "yellow", "white", "black"];
  root.add(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.7), colors.map((color) => new THREE.MeshStandardMaterial({ color }))));
  const mesh = bakeProjectObject(root).children[0];
  assert.equal(mesh.geometry.groups.length, 6);
  assert.equal(mesh.material.length, 6);
  const p = mesh.geometry.attributes.position;
  const uv = mesh.geometry.attributes.uv;
  let error = 0;
  for (let i = 0; i < p.count; i += 3) {
    const points = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(p, i + j));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
    const interpolated = points.reduce((sum, point) => sum.add(turn(point, 2)), new THREE.Vector3()).multiplyScalar(1 / 3);
    error = Math.max(error, turn(center, 2).distanceTo(interpolated));
    for (let j = 0; j < 3; j++) assert.ok(uv.getX(i + j) >= 0 && uv.getX(i + j) <= 1);
  }
  assert.ok(error < 0.005, String(error));
});

test("twists normals with the surface and shares one amount across all materials", () => {
  const group = new THREE.Group();
  const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial()];
  group.add(new THREE.Mesh(new THREE.BoxGeometry(), materials));
  applyProjectTwist(group);
  assert.equal(materials[0].userData.projectTwist, materials[1].userData.projectTwist);
  const shader = { uniforms: {}, vertexShader: "#include <beginnormal_vertex>\n#include <begin_vertex>" };
  materials[0].onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes("objectNormal = normalize"));
  assert.ok(!shader.vertexShader.includes("mvPosition"));
  const p = new THREE.Vector3(1.2, -0.7, 0.9);
  const n = new THREE.Vector3(0.2, 0.8, -0.4).normalize();
  const k = 2 / 3;
  const a = p.y * k;
  const transformed = new THREE.Vector3(Math.cos(a) * n.x + Math.sin(a) * n.z, n.y + k * (p.x * n.z - p.z * n.x), -Math.sin(a) * n.x + Math.cos(a) * n.z).normalize();
  const tangent = new THREE.Vector3(1, 0, 0).cross(n).normalize();
  const along = turn(p.clone().addScaledVector(tangent, 1e-5), 2).sub(turn(p, 2)).normalize();
  assert.ok(Math.abs(along.dot(transformed)) < 1e-5);
});

test("every compressed asset keeps shared coordinates, complete groups, and smooth twist topology", async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const manifest = JSON.parse(await readFile(new URL("../lib/projectObjects.json", import.meta.url)));
  const projects = await readFile(new URL("../lib/projects.ts", import.meta.url), "utf8");
  const ids = Array.from(projects.matchAll(/id: "([^"]+)"/g), (match) => match[1]);
  assert.deepEqual(Object.keys(manifest).sort(), ids.sort());
  for (const [id, asset] of Object.entries(manifest)) {
    const file = new URL("../public/assets/project-objects/" + asset.file, import.meta.url);
    const data = await readFile(file);
    assert.equal(data.byteLength, asset.bytes);
    assert.ok(asset.file.includes(createHash("sha256").update(data).digest("hex").slice(0, 10)));
    const document = await io.read(file.pathname);
    for (const node of document.getRoot().listNodes()) {
      assert.deepEqual(node.getTranslation(), [0, 0, 0], id);
      assert.deepEqual(node.getRotation(), [0, 0, 0, 1], id);
      assert.deepEqual(node.getScale(), [1, 1, 1], id);
    }
    let triangles = 0;
    let worstError = 0;
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute("POSITION");
        assert.equal(position.getComponentType(), 5126, id);
        assert.ok(primitive.getMaterial(), id);
        const indices = primitive.getIndices();
        for (let i = 0; i < (indices?.getCount() ?? position.getCount()); i += 3) {
          const points = [0, 1, 2].map((j) => {
            const p = position.getElement(indices?.getScalar(i + j) ?? i + j, []);
            assert.ok(p.every(Number.isFinite), id);
            return new THREE.Vector3(...p);
          });
          const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
          const interpolated = points.reduce((sum, point) => sum.add(turn(point, 2)), new THREE.Vector3()).multiplyScalar(1 / 3);
          worstError = Math.max(worstError, turn(center, 2).distanceTo(interpolated));
          triangles++;
        }
      }
    }
    assert.ok(worstError < 0.005, `${id}: ${worstError}`);
    console.log(`${id}: ${triangles} triangles, max bend error ${worstError.toFixed(5)}`);
  }
});
