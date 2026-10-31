import * as THREE from "three";

const sliceHeight = 0.125;
const stride = 11;
type Vertex = number[];

function split(polygon: Vertex[], height: number) {
  const below: Vertex[] = [];
  const above: Vertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (a[1] <= height) below.push(a);
    if (a[1] >= height) above.push(a);
    if ((a[1] < height && b[1] > height) || (a[1] > height && b[1] < height)) {
      const t = (height - a[1]) / (b[1] - a[1]);
      const point = a.map((value, j) => value + (b[j] - value) * t);
      point[1] = height;
      below.push(point);
      above.push(point);
    }
  }
  return [below, above];
}

function append(polygon: Vertex[], output: number[]) {
  for (let i = 1; i < polygon.length - 1; i++) {
    const pending = [[polygon[0], polygon[i], polygon[i + 1]]];
    while (pending.length) {
      const triangle = pending.pop()!;
      const distances = triangle.map((a, j) => Math.hypot(...a.slice(0, 3).map((value, axis) => value - triangle[(j + 1) % 3][axis])));
      const edge = distances.indexOf(Math.max(...distances));
      const height = Math.max(...triangle.map((v) => v[1])) - Math.min(...triangle.map((v) => v[1]));
      if (height * distances[edge] > 0.012) {
        const a = triangle[edge];
        const b = triangle[(edge + 1) % 3];
        const c = triangle[(edge + 2) % 3];
        const middle = a.map((value, j) => (value + b[j]) / 2);
        pending.push([a, middle, c], [middle, b, c]);
        continue;
      }
      for (const vertex of triangle) {
        const length = Math.hypot(vertex[3], vertex[4], vertex[5]) || 1;
        output.push(...vertex.slice(0, 3), vertex[3] / length, vertex[4] / length, vertex[5] / length, ...vertex.slice(6));
      }
    }
  }
}

export function bakeProjectObject(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const parts: { geometry: THREE.BufferGeometry; materials: THREE.Material[] }[] = [];
  const instance = new THREE.Matrix4();
  const instanceColor = new THREE.Color();
  const bounds = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const materialCopies = new Map<THREE.Material, THREE.Material>();
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const instanced = object instanceof THREE.InstancedMesh;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const tinted = instanced && object.instanceColor;
    const bakedMaterials = materials.map((material) => {
      if (!tinted && materialCopies.has(material)) return materialCopies.get(material)!;
      const copy = material.clone();
      if (tinted && "vertexColors" in copy) copy.vertexColors = true;
      if (!tinted) materialCopies.set(material, copy);
      return copy;
    });
    for (let i = 0; i < (instanced ? object.count : 1); i++) {
      const matrix = object.matrixWorld.clone();
      if (instanced) {
        object.getMatrixAt(i, instance);
        matrix.multiply(instance);
      }
      const geometry = object.geometry.clone();
      for (const name of ["position", "normal"]) {
        const attribute = geometry.getAttribute(name);
        if (!attribute) continue;
        const values = new Float32Array(attribute.count * 3);
        for (let j = 0; j < attribute.count; j++) {
          values[j * 3] = attribute.getX(j);
          values[j * 3 + 1] = attribute.getY(j);
          values[j * 3 + 2] = attribute.getZ(j);
        }
        geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
      }
      geometry.applyMatrix4(matrix);
      if (matrix.determinant() < 0) {
        const indices = Array.from({ length: geometry.index?.count ?? geometry.getAttribute("position").count }, (_, j) => geometry.index?.getX(j) ?? j);
        for (let j = 0; j < indices.length; j += 3) [indices[j + 1], indices[j + 2]] = [indices[j + 2], indices[j + 1]];
        geometry.setIndex(indices);
      }
      if (!geometry.hasAttribute("normal")) geometry.computeVertexNormals();
      const position = geometry.getAttribute("position");
      if (tinted) {
        object.getColorAt(i, instanceColor);
        const color = geometry.getAttribute("color");
        const colors = new Float32Array(position.count * 3);
        for (let j = 0; j < position.count; j++) {
          colors[j * 3] = instanceColor.r * (color?.getX(j) ?? 1);
          colors[j * 3 + 1] = instanceColor.g * (color?.getY(j) ?? 1);
          colors[j * 3 + 2] = instanceColor.b * (color?.getZ(j) ?? 1);
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox!);
      parts.push({ geometry, materials: bakedMaterials });
    }
  });
  if (!parts.length) throw new Error("Project object has no meshes");
  const center = bounds.getCenter(new THREE.Vector3());
  let radius = 0;
  for (const { geometry } of parts) {
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++)
      radius = Math.max(radius, vertex.fromBufferAttribute(position, i).distanceTo(center));
  }
  if (!radius) throw new Error("Project object has no volume");
  const batches = new Map<THREE.Material, number[]>();
  for (const { geometry, materials } of parts) {
    geometry.translate(-center.x, -center.y, -center.z).scale(3 / radius, 3 / radius, 3 / radius);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    const color = geometry.getAttribute("color");
    const count = geometry.index?.count ?? position.count;
    const groups = geometry.groups.length && materials.length > 1
      ? geometry.groups
      : [{ start: 0, count, materialIndex: 0 }];
    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0];
      if (!batches.has(material)) batches.set(material, []);
      const output = batches.get(material)!;
      for (let i = group.start; i < group.start + group.count; i += 3) {
        let polygon: Vertex[] = [0, 1, 2].map((offset) => {
          const j = geometry.index?.getX(i + offset) ?? i + offset;
          return [position.getX(j), position.getY(j), position.getZ(j), normal.getX(j), normal.getY(j), normal.getZ(j), uv?.getX(j) ?? 0, uv?.getY(j) ?? 0, color?.getX(j) ?? 1, color?.getY(j) ?? 1, color?.getZ(j) ?? 1];
        });
        const low = Math.min(...polygon.map((point) => point[1]));
        const high = Math.max(...polygon.map((point) => point[1]));
        for (let y = (Math.floor(low / sliceHeight) + 1) * sliceHeight; y < high; y += sliceHeight) {
          const [below, above] = split(polygon, y);
          append(below, output);
          polygon = above;
        }
        append(polygon, output);
      }
    }
    geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  const data = new Float32Array(Array.from(batches.values()).reduce((sum, batch) => sum + batch.length, 0));
  let offset = 0;
  const materials = Array.from(batches.keys());
  for (const batch of batches.values()) {
    geometry.addGroup(offset / stride, batch.length / stride, geometry.groups.length);
    data.set(batch, offset);
    offset += batch.length;
  }
  const buffer = new THREE.InterleavedBuffer(data, stride);
  geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  geometry.setAttribute("normal", new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  geometry.setAttribute("uv", new THREE.InterleavedBufferAttribute(buffer, 2, 6));
  geometry.setAttribute("color", new THREE.InterleavedBufferAttribute(buffer, 3, 8));
  geometry.computeBoundingBox();
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3.00001);
  const baked = new THREE.Group();
  baked.add(new THREE.Mesh(geometry, materials));
  return baked;
}

export function applyProjectTwist(root: THREE.Group) {
  const twist = { value: 0 };
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial)) continue;
      material.userData.projectTwist = twist;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uProjectTwist = twist;
        shader.vertexShader = `uniform float uProjectTwist;\n${shader.vertexShader}`
          .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
            float twistRate = uProjectTwist / 3.0;
            float angle = position.y * twistRate;
            mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
            objectNormal = normalize(vec3((turn * normal.xz).x, normal.y + twistRate * (position.x * normal.z - position.z * normal.x), (turn * normal.xz).y));`)
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            float positionAngle = position.y * uProjectTwist / 3.0;
            transformed.xz = mat2(cos(positionAngle), -sin(positionAngle), sin(positionAngle), cos(positionAngle)) * position.xz;`);
      };
      material.customProgramCacheKey = () => "project-object-baked-twist-v1";
    }
  });
}
