"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useAccent } from "@/components/AccentProvider";
import { useIsVisible, useReducedMotion } from "@/lib/scroll";
import { tierDpr, usePerformanceTier } from "@/lib/performance";
import { HDRI_STUDIO_HREF } from "@/lib/site";

function makeGlyph() {
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
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.055, bevelSegments: 8, curveSegments: 32, steps: 1 });
  geometry.center();
  const indexed = mergeVertices(geometry);
  geometry.dispose();
  indexed.computeBoundingSphere();
  return indexed;
}

const pieces = [
  { position: [0.2, 0.1, 0.65], rotation: [0.18, -0.4, -0.2], scale: 1.48, finish: "accent" },
  { position: [-1.25, 1.7, -0.65], rotation: [0.5, 0.6, 0.7], scale: 0.95, finish: "silver" },
  { position: [1.4, 1.9, -1.4], rotation: [-0.7, 0.25, -0.55], scale: 0.82, finish: "white" },
  { position: [1.6, -1.15, -0.8], rotation: [0.6, -0.6, -0.4], scale: 1.05, finish: "silver" },
  { position: [-1.45, -1.7, -0.7], rotation: [-0.25, 0.5, 0.65], scale: 0.95, finish: "white" },
  { position: [0.1, -2.3, -1.3], rotation: [1.1, 0.2, -0.1], scale: 0.7, finish: "accent" },
] as const;

function Sculpture({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  const accent = useAccent();
  const frames = useRef(0);
  const geometry = useMemo(makeGlyph, []);
  const bodies = useMemo(() => pieces.map((piece) => ({
    position: new THREE.Vector3(...piece.position),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Vector3(...piece.rotation),
    spin: new THREE.Vector3(),
    mesh: null as THREE.Mesh | null,
  })), []);
  const drag = useRef<{ index: number; id: number; target: Element; plane: THREE.Plane; offset: THREE.Vector3; time: number } | null>(null);
  const scratch = useMemo(() => ({ hit: new THREE.Vector3(), delta: new THREE.Vector3(), normal: new THREE.Vector3() }), []);
  const { gl, invalidate } = useThree();
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const canvas = gl.domElement;
    const release = () => {
      const active = drag.current;
      drag.current = null;
      if (active?.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
      canvas.style.cursor = "grab";
    };
    const shuffle = () => {
      release();
      for (const body of bodies) {
        body.velocity.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3);
        body.spin.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
      }
      invalidate();
    };
    canvas.style.cursor = "grab";
    canvas.addEventListener("webglcontextlost", onError);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", release);
    window.addEventListener("blur", release);
    window.addEventListener("sculpture:shuffle", shuffle);
    return () => {
      release();
      canvas.removeEventListener("webglcontextlost", onError);
      canvas.removeEventListener("pointercancel", release);
      canvas.removeEventListener("lostpointercapture", release);
      window.removeEventListener("blur", release);
      window.removeEventListener("sculpture:shuffle", shuffle);
    };
  }, [gl, bodies, onError, invalidate]);

  const grab = (index: number, event: ThreeEvent<PointerEvent>) => {
    if (drag.current || event.button !== 0) return;
    event.stopPropagation();
    const body = bodies[index];
    const target = event.target as Element;
    target.setPointerCapture(event.pointerId);
    drag.current = { index, id: event.pointerId, target, plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -event.point.z), offset: event.point.clone().sub(body.position), time: event.timeStamp };
    body.velocity.set(0, 0, 0);
    body.spin.set(0, 0, 0);
    gl.domElement.style.cursor = "grabbing";
    invalidate();
  };
  const move = (index: number, event: ThreeEvent<PointerEvent>) => {
    const active = drag.current;
    if (!active || active.index !== index || active.id !== event.pointerId) return;
    event.stopPropagation();
    if (!event.ray.intersectPlane(active.plane, scratch.hit)) return;
    const body = bodies[index];
    scratch.hit.sub(active.offset);
    scratch.delta.subVectors(scratch.hit, body.position).clampLength(0, 1.5);
    body.position.add(scratch.delta);
    const elapsed = Math.max(0.008, Math.min(0.1, (event.timeStamp - active.time) / 1000));
    body.velocity.lerp(scratch.normal.copy(scratch.delta).divideScalar(elapsed).clampLength(0, 12), 0.45);
    body.rotation.x -= scratch.delta.y * 0.35;
    body.rotation.y += scratch.delta.x * 0.5;
    body.spin.set(-body.velocity.y * 0.25, body.velocity.x * 0.3, -body.velocity.x * 0.12);
    active.time = event.timeStamp;
    invalidate();
  };
  const drop = (event: ThreeEvent<PointerEvent>) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    event.stopPropagation();
    drag.current = null;
    if (event.timeStamp - active.time > 100) bodies[active.index].velocity.set(0, 0, 0);
    if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
    gl.domElement.style.cursor = "grab";
    invalidate();
  };

  useFrame(({ pointer, camera, size }, delta) => {
    if (frames.current++ === 2) onReady();
    const step = Math.min(delta, 0.033);
    let moving = frames.current < 4 || !!drag.current;
    for (let index = 0; index < bodies.length; index++) {
      const body = bodies[index];
      const piece = pieces[index];
      if (drag.current?.index !== index) {
        scratch.delta.set(piece.position[0], piece.position[1], piece.position[2]).sub(body.position);
        body.velocity.addScaledVector(scratch.delta, 9 * step).multiplyScalar(Math.exp(-3.8 * step));
        body.position.addScaledVector(body.velocity, step);
        body.spin.multiplyScalar(Math.exp(-2.5 * step));
        body.rotation.addScaledVector(body.spin, step);
        body.rotation.x = THREE.MathUtils.damp(body.rotation.x, piece.rotation[0] - pointer.y * 0.06, 1.4, step);
        body.rotation.y = THREE.MathUtils.damp(body.rotation.y, piece.rotation[1] + pointer.x * 0.08, 1.4, step);
        body.rotation.z = THREE.MathUtils.damp(body.rotation.z, piece.rotation[2], 1.4, step);
      }
      moving ||= body.velocity.lengthSq() > 0.0001 || body.spin.lengthSq() > 0.0001
        || Math.abs(body.rotation.x - piece.rotation[0] + pointer.y * 0.06) > 0.001
        || Math.abs(body.rotation.y - piece.rotation[1] - pointer.x * 0.08) > 0.001
        || Math.abs(body.rotation.z - piece.rotation[2]) > 0.001;
    }
    for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
      const first = bodies[a], second = bodies[b];
      scratch.normal.subVectors(second.position, first.position);
      const distance = scratch.normal.length();
      const separation = (pieces[a].scale + pieces[b].scale) * 0.72;
      if (!distance || distance >= separation) continue;
      scratch.normal.divideScalar(distance);
      const heldA = drag.current?.index === a, heldB = drag.current?.index === b;
      const correction = separation - distance;
      if (!heldA) first.position.addScaledVector(scratch.normal, -correction * (heldB ? 1 : 0.5));
      if (!heldB) second.position.addScaledVector(scratch.normal, correction * (heldA ? 1 : 0.5));
      const closing = scratch.delta.subVectors(second.velocity, first.velocity).dot(scratch.normal);
      if (closing < 0) {
        if (!heldA) first.velocity.addScaledVector(scratch.normal, closing * 0.7);
        if (!heldB) second.velocity.addScaledVector(scratch.normal, -closing * 0.7);
      }
    }
    for (let index = 0; index < bodies.length; index++) {
      const body = bodies[index];
      const radius = geometry.boundingSphere!.radius * pieces[index].scale;
      body.position.z = THREE.MathUtils.clamp(body.position.z, -2.5, 1.3);
      const distance = camera.position.z - body.position.z;
      const slopeY = Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2));
      const slopeX = slopeY * size.width / size.height;
      const xLimit = Math.max(0.1, distance * slopeX - radius * Math.hypot(1, slopeX) - 0.15);
      const yLimit = Math.max(0.1, distance * slopeY - radius * Math.hypot(1, slopeY) - 0.15);
      for (const axis of ["x", "y"] as const) {
        const limit = axis === "x" ? xLimit : yLimit;
        if (Math.abs(body.position[axis]) > limit) {
          body.position[axis] = THREE.MathUtils.clamp(body.position[axis], -limit, limit);
          body.velocity[axis] *= -0.45;
        }
      }
      body.mesh?.position.copy(body.position);
      body.mesh?.rotation.set(body.rotation.x, body.rotation.y, body.rotation.z);
    }
    if (moving) invalidate();
  });
  return (
    <>
      <Environment files={HDRI_STUDIO_HREF} environmentIntensity={1.2} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[-4, 5, 6]} intensity={3} />
      <directionalLight position={[4, -2, 3]} intensity={1.2} />
      <group>
        {pieces.map((piece, index) => <mesh key={index} ref={(mesh) => { bodies[index].mesh = mesh; }} geometry={geometry} position={[...piece.position]} rotation={[...piece.rotation]} scale={piece.scale} onPointerDown={(event) => grab(index, event)} onPointerMove={(event) => move(index, event)} onPointerUp={drop}>
          <meshPhysicalMaterial color={piece.finish === "accent" ? accent.base : piece.finish === "silver" ? "#c8ccd0" : "#f6f5f1"} metalness={piece.finish === "silver" ? 1 : piece.finish === "accent" ? 0.24 : 0.06} roughness={piece.finish === "silver" ? 0.16 : 0.2} clearcoat={1} clearcoatRoughness={0.12} />
        </mesh>)}
      </group>
    </>
  );
}

export function HeroSculptureView({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  const { ref, visible } = useIsVisible<HTMLDivElement>("0px");
  const reduced = useReducedMotion();
  const tier = usePerformanceTier(reduced, visible);
  return (
    <div ref={ref} className="sculpture-canvas">
      <Canvas camera={{ position: [0, 0, 10], fov: 40 }} dpr={tierDpr(tier, 1.5, 1.1)} frameloop={visible ? "demand" : "never"} resize={{ scroll: false }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; gl.domElement.style.touchAction = "pan-y"; }} fallback={null}>
        <Sculpture onReady={onReady} onError={onError} />
      </Canvas>
    </div>
  );
}
