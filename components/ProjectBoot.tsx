"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PROJECT_HOLD, type ProjectArrival } from "@/lib/projectMotion";

const destinations = [
  [-0.45, 0.34, -0.6], [-0.26, 0.44, 0.5], [0.04, 0.51, -0.8],
  [0.35, 0.33, 0.6], [0.49, 0.15, -0.4], [-0.48, 0.04, 0.7],
  [-0.40, -0.32, 0.5], [-0.15, -0.44, -0.5], [0.17, -0.41, 0.7],
  [0.45, -0.30, -0.8], [-0.09, 0.18, 0.4], [0.28, -0.04, -0.5],
] as const;
const ease = (value: number) => 1 - (1 - THREE.MathUtils.clamp(value, 0, 1)) ** 3;

function makeR() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, 1);
  shape.lineTo(-0.6, -1);
  shape.lineTo(-0.35, -1);
  shape.lineTo(-0.35, 0.05);
  shape.lineTo(0.3, -1);
  shape.lineTo(0.6, -1);
  shape.lineTo(-0.05, 0.05);
  shape.bezierCurveTo(0.5, 0.05, 0.7, 0.4, 0.6, 0.66);
  shape.bezierCurveTo(0.55, 0.92, 0.4, 1, 0.2, 1);
  shape.lineTo(-0.6, 1);
  const hole = new THREE.Path();
  hole.moveTo(-0.32, 0.8);
  hole.lineTo(0.16, 0.8);
  hole.bezierCurveTo(0.4, 0.78, 0.45, 0.5, 0.16, 0.22);
  hole.lineTo(-0.32, 0.22);
  hole.lineTo(-0.32, 0.8);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.46,
    bevelEnabled: true,
    bevelThickness: 0.085,
    bevelSize: 0.055,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geometry.center();
  geometry.scale(0.875, 0.875, 0.875);
  const abstract = geometry.clone();
  const points = abstract.getAttribute("position");
  const point = new THREE.Vector3();
  for (let i = 0; i < points.count; i++) {
    point.fromBufferAttribute(points, i);
    const angle = point.y * 1.3;
    const x = point.x * Math.cos(angle) - point.z * Math.sin(angle);
    const z = point.x * Math.sin(angle) + point.z * Math.cos(angle);
    points.setXYZ(i, x * 1.12 + Math.sin(point.y * 2) * 0.2, point.y * 1.12, z * 1.45);
  }
  abstract.computeVertexNormals();
  geometry.morphAttributes.position = [points];
  geometry.morphAttributes.normal = [abstract.getAttribute("normal")];
  geometry.computeBoundingSphere();
  return geometry;
}

export default function ProjectBoot({ section, active, reduced, ready, arrival }: {
  section: HTMLElement; active: boolean; reduced: boolean; ready: () => void; arrival: RefObject<ProjectArrival>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const prepared = useRef(false);
  const accent = useRef("");
  const color = useRef(new THREE.Color());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(makeR, []);
  const morph = useMemo(() => new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()), [geometry]);
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: "#4b6dff", roughness: 0.26, metalness: 0.12,
    clearcoat: 0.6, clearcoatRoughness: 0.2, transparent: true,
    opacity: 0.5, depthWrite: false,
  }), []);
  const { gl, camera, scene } = useThree();

  useEffect(() => {
    let alive = true;
    if (mesh.current) {
      for (let i = 0; i < destinations.length; i++) mesh.current.setMorphAt(i, morph);
      mesh.current.morphTexture!.needsUpdate = true;
    }
    if (mesh.current) gl.compileAsync(mesh.current, camera, scene).then(() => {
      if (!alive) return;
      prepared.current = true;
      ready();
    }).catch(() => {});
    return () => {
      alive = false;
      geometry.dispose();
      material.dispose();
      morph.material.dispose();
    };
  }, [geometry, material, morph, gl, camera, scene, ready]);

  useFrame(({ viewport, clock, size }, delta) => {
    const field = mesh.current;
    if (!field || (!active && !reduced)) return;
    if (!prepared.current) { field.visible = false; return; }
    const time = reduced ? 4 : arrival.current.time;
    field.visible = time > PROJECT_HOLD;
    if (!field.visible) return;

    const raw = section.style.getPropertyValue("--pd-active") ||
      getComputedStyle(document.documentElement).getPropertyValue("--color-accent");
    if (raw !== accent.current) {
      const initial = !accent.current;
      accent.current = raw;
      const hsl = raw.match(/hsl\(([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/);
      if (hsl) color.current.setHSL(+hsl[1] / 360, +hsl[2] / 100, +hsl[3] / 100, THREE.SRGBColorSpace);
      else color.current.setStyle(raw.trim());
      if (initial) material.color.copy(color.current);
    }
    material.color.lerp(color.current, 1 - Math.exp(-Math.min(delta, 0.1) * 5));
    const phone = size.width < 650;
    const baseScale = phone ? 0.3 : Math.min(0.55, 0.44 * size.width / size.height);
    const start = time - PROJECT_HOLD;
    material.opacity = 0.5 * ease(start / 0.22);
    for (let i = 0; i < destinations.length; i++) {
      const [x, y, tilt] = destinations[i];
      const progress = ease((start - i * 0.018) / 1.15);
      morph.morphTargetInfluences![0] = ease((start - 0.45 - i * 0.018) / 0.8) * (0.78 + (i % 3) * 0.11);
      field.setMorphAt(i, morph);
      const burst = progress + Math.sin(progress * Math.PI) * 0.13;
      const drift = reduced ? 0 : Math.sin(clock.elapsedTime * 0.38 + i * 2.1) * (phone ? 0.008 : 0.016) * progress;
      dummy.position.set(
        (x * burst + drift) * viewport.width,
        (y * burst + drift * 0.8) * viewport.height,
        -4.6 + Math.sin(progress * Math.PI) * 1.8,
      );
      dummy.rotation.set(
        progress * (tilt + 0.5 + Math.PI * (i % 2 ? 2 : -2)) + drift * 2,
        progress * (tilt * 1.8 + 0.65 + Math.PI * (i % 3 ? -2 : 2)) + drift * 3,
        progress * tilt + drift,
      );
      const scale = phone && [1, 8, 10, 11].includes(i) ? 0 : baseScale *
        (0.12 + progress * 0.88) * (1 + Math.sin(progress * Math.PI) * 1.3);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      field.setMatrixAt(i, dummy.matrix);
    }
    field.instanceMatrix.needsUpdate = true;
    field.morphTexture!.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, destinations.length]} frustumCulled={false} />;
}
