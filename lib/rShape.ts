import * as THREE from "three";

export function createRShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, 1.0);
  shape.lineTo(-0.6, -1.0);
  shape.lineTo(-0.35, -1.0);
  shape.lineTo(-0.35, 0.05);
  shape.lineTo(0.3, -1.0);
  shape.lineTo(0.6, -1.0);
  shape.lineTo(-0.05, 0.05);
  shape.bezierCurveTo(0.5, 0.05, 0.7, 0.4, 0.6, 0.66);
  shape.bezierCurveTo(0.55, 0.92, 0.4, 1.0, 0.2, 1.0);
  shape.lineTo(-0.6, 1.0);

  const hole = new THREE.Path();
  hole.moveTo(-0.32, 0.8);
  hole.lineTo(0.16, 0.8);
  hole.bezierCurveTo(0.4, 0.78, 0.45, 0.5, 0.16, 0.22);
  hole.lineTo(-0.32, 0.22);
  hole.lineTo(-0.32, 0.8);
  shape.holes.push(hole);

  return shape;
}
