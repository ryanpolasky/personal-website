import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function createRGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.65, 1);
  shape.lineTo(-0.65, -1);
  shape.lineTo(-0.25, -1);
  shape.lineTo(-0.25, -0.02);
  shape.lineTo(0.3, -1);
  shape.lineTo(0.77, -1);
  shape.lineTo(0.16, 0.03);
  shape.bezierCurveTo(0.8, 0.1, 0.88, 0.86, 0.24, 1);
  shape.lineTo(-0.65, 1);
  const hole = new THREE.Path();
  hole.moveTo(-0.25, 0.65);
  hole.lineTo(0.15, 0.65);
  hole.bezierCurveTo(0.44, 0.65, 0.44, 0.32, 0.15, 0.32);
  hole.lineTo(-0.25, 0.32);
  hole.closePath();
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.58, bevelEnabled: true, bevelThickness: 0.15,
    bevelSize: 0.1, bevelSegments: 8, curveSegments: 28, steps: 1,
  });
  geometry.center();
  geometry.computeBoundingSphere();
  const smooth = toCreasedNormals(geometry, Math.PI / 2);
  geometry.dispose();
  return smooth;
}
