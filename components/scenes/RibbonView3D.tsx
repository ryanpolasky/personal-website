"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useAccent } from "@/components/AccentProvider";
import {
  tierDpr,
  usePerformanceTier,
  type PerformanceTier,
} from "@/lib/performance";
import {
  useElementProgress,
  useIsVisible,
  useReducedMotion,
} from "@/lib/scroll";

// 3d ribbon mesh: tube extruded along a catmull-rom curve. control points
// morph by sin(t) + scroll progress, giving the ribbon a slow weave through
// the about section. geometry is disposed + rebuilt each frame at low
// segment counts so the gpu/cpu cost stays bounded.

const SEG_ALONG = 224;
// segAround controls how many faces ring the tube cross-section. was 8 (very
// faceted in silhouette) - at 14 the tube reads as cleanly cylindrical from
// every angle without doubling vert count vs the original spec.
const SEG_AROUND = 14;

// the ribbon's curve is a vertical snake that spans Y_TOP → Y_BOTTOM in
// model space. as scroll progress goes 0 → 1, the entire group is translated
// vertically so the "drawing head" moves from upper viewport → lower viewport.
// effect: the ribbon visually flows downward through the page as the user
// scrolls past about + experience, reading as one continuous thread woven
// through the content rather than a static horizontal decorative layer.
const Y_TOP = 4.0;
const Y_BOTTOM = -11.2;
const Y_RANGE = Y_TOP - Y_BOTTOM;
// where the drawing head sits vertically in world coords at p=0 vs p=1.
// chosen so head enters from top-of-viewport (y≈+2) and exits at
// bottom-of-viewport (y≈-2), giving ~4 units of head travel through the
// 6.9-unit-tall camera frustum at z=9 fov=42.
const HEAD_WORLD_Y_AT_START = 2.0;
const HEAD_WORLD_Y_AT_END = -2.0;

function Ribbon({
  progressRef,
  tier,
}: {
  progressRef: React.MutableRefObject<number>;
  tier: PerformanceTier;
}) {
  const accent = useAccent();
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  // hemispherical caps plugging the open ends of the tube. without these,
  // the tube reads as hollow - both the leftmost (fixed start) and the
  // rightmost (current draw-head as the tube grows with scroll) ends show
  // an empty circular hole right into the void. each cap is a sphere the
  // size of the tube radius; only the outward-facing hemisphere is
  // visible from outside the tube, so it reads as a clean rounded plug.
  const leftCapRef = useRef<THREE.Mesh>(null);
  const rightCapRef = useRef<THREE.Mesh>(null);
  const lastGeometryAt = useRef(-Infinity);
  const segAlong = tier === "low" ? 96 : tier === "medium" ? 144 : SEG_ALONG;
  const segAround = tier === "low" ? 8 : tier === "medium" ? 12 : SEG_AROUND;
  const rebuildFps = tier === "low" ? 18 : tier === "medium" ? 36 : 48;
  // local time accumulator. only advances via clamped useFrame dt so a paused
  // frameloop (when the about section scrolls off-screen) cannot produce a
  // huge phase jump on resume.
  const timeRef = useRef(0);
  // only the geometries WE generate live here. `initial` is owned by the
  // useMemo below and is referenced by the <mesh geometry={...}> jsx prop,
  // so disposing it would leave the mesh attached to a freed buffer on any
  // future re-render that re-diffs the prop (which is exactly the
  // disappear-after-scrolling-back failure mode this fixes).
  const generatedRef = useRef<THREE.TubeGeometry | null>(null);

  // base control points form a descending path with depth variation in z so
  // the ribbon visibly passes "behind" and "in front of" the camera plane.
  const baseCtrl = useMemo(
    () => [
      new THREE.Vector3(-8.8, Y_TOP, -0.7),
      new THREE.Vector3(-7.4, 3.35, 1.7),
      new THREE.Vector3(-4.8, 2.25, -2.0),
      new THREE.Vector3(0.6, 2.4, 1.4),
      new THREE.Vector3(5.4, 1.7, -1.9),
      new THREE.Vector3(7.6, 0.35, 2.1),
      new THREE.Vector3(1.8, -0.7, -2.4),
      new THREE.Vector3(-4.8, -1.4, 1.6),
      new THREE.Vector3(-5.6, -3.0, -1.9),
      new THREE.Vector3(-0.8, -4.2, 2.35),
      new THREE.Vector3(5.0, -5.5, -1.65),
      new THREE.Vector3(3.0, -7.0, 2.05),
      new THREE.Vector3(-4.1, -8.1, -2.1),
      new THREE.Vector3(-5.2, -9.5, 1.85),
      new THREE.Vector3(1.2, -10.4, -1.7),
      new THREE.Vector3(14.0, Y_BOTTOM, 0.85),
    ],
    [],
  );

  const initial = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      baseCtrl,
      false,
      "centripetal",
      0.5,
    );
    const geometry = new THREE.TubeGeometry(
      curve,
      segAlong,
      0.34,
      segAround,
      false,
    );
    geometry.setDrawRange(0, segAround * 6);
    return geometry;
  }, [baseCtrl, segAlong, segAround]);

  // re-use a scratch buffer of vectors so we don't allocate every frame.
  const scratch = useMemo(
    () => baseCtrl.map(() => new THREE.Vector3()),
    [baseCtrl],
  );

  // single shared material for the tube + both caps. critical that they
  // share an instance so the iridescent reading is identical across the
  // three meshes - separate materials would technically have the same
  // params but the visual hand-off where cap meets tube would be subtly
  // misaligned. disposed via the effect below when tier/accent changes.
  const material = useMemo<THREE.Material>(() => {
    if (tier === "low") {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(accent.base),
        roughness: 0.2,
        metalness: 0.04,
        emissive: new THREE.Color(accent.base),
        emissiveIntensity: 0.08,
      });
    }
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(accent.base),
      roughness: tier === "medium" ? 0.14 : 0.08,
      metalness: 0.0,
      clearcoat: tier === "medium" ? 0.55 : 1.0,
      clearcoatRoughness: tier === "medium" ? 0.12 : 0.04,
      iridescence: tier === "medium" ? 0.35 : 0.85,
      iridescenceIOR: 1.4,
      iridescenceThicknessRange: [140, 580],
      sheen: tier === "medium" ? 0.25 : 0.6,
      sheenColor: new THREE.Color(accent.warm),
    });
  }, [tier, accent.base, accent.warm]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    return () => {
      generatedRef.current?.dispose();
      generatedRef.current = null;
    };
  }, []);

  useFrame((_state, dt) => {
    const g = groupRef.current;
    const m = meshRef.current;
    if (!g || !m) return;
    // unclamped dt tells us whether the frameloop just resumed from a long
    // pause (visible→invisible→visible). that's when we must force a
    // rebuild so the tube reflects the current scroll progress, not the
    // stale geometry that was on screen when the loop paused.
    const longPauseResume = dt > 0.1;
    const safeDt = Math.min(dt, 1 / 30);
    timeRef.current += safeDt;
    const t = timeRef.current;
    const p = THREE.MathUtils.clamp(progressRef.current, 0, 1);

    if (longPauseResume || t - lastGeometryAt.current > 1 / rebuildFps) {
      for (let i = 0; i < baseCtrl.length; i += 1) {
        const v = baseCtrl[i];
        const phase = i * 0.57 + t * 0.42 + p * 1.35;
        const dx = Math.sin(phase * 0.82) * (0.1 + p * 0.22);
        const dy = Math.sin(phase) * (0.08 + p * 0.22);
        const dz = Math.cos(phase * 0.92) * (0.42 + p * 0.72);
        scratch[i].set(v.x + dx, v.y + dy, v.z + dz);
      }
      const curve = new THREE.CatmullRomCurve3(
        scratch,
        false,
        "centripetal",
        0.5,
      );
      const tubeRadius = 0.31 + p * 0.08;
      const next = new THREE.TubeGeometry(
        curve,
        segAlong,
        tubeRadius,
        segAround,
        false,
      );

      // grow the tube from top to bottom as we scroll. TubeGeometry packs
      // its index buffer in (tubular, radial) order, so the first
      // visibleSegments * SEG_AROUND * 6 indices are exactly the leading
      // segments. clamp to at least one segment so p=0 isn't fully blank.
      const visibleSegments = Math.max(1, Math.floor(p * segAlong));
      const indexCount = visibleSegments * segAround * 6;
      next.setDrawRange(0, indexCount);

      if (generatedRef.current) {
        generatedRef.current.dispose();
      }
      generatedRef.current = next;
      m.geometry = next;
      lastGeometryAt.current = t;

      // park the caps at the tube's current start + current draw-head,
      // scaled to match the tube radius exactly. the left cap stays at
      // u=0 (the catmull-rom curve passes through scratch[0] there), the
      // right cap rides u = visibleSegments / segAlong as the tube grows.
      // scale slightly under tubeRadius so the cap reads as a tucked-in
      // rounded end rather than a bulging bead - the sphere's outermost
      // extent now sits ~tubeRadius * 0.96 past the tube end (vs full
      // tubeRadius before), which kills the "ball on a stick" silhouette.
      const capRadius = tubeRadius * 0.96;
      const leftCap = leftCapRef.current;
      const rightCap = rightCapRef.current;
      if (leftCap) {
        curve.getPointAt(0, leftCap.position);
        leftCap.scale.setScalar(capRadius);
      }
      if (rightCap) {
        const u = Math.min(1, visibleSegments / segAlong);
        curve.getPointAt(u, rightCap.position);
        rightCap.scale.setScalar(capRadius);
      }
    }
    const headTargetY = THREE.MathUtils.lerp(
      HEAD_WORLD_Y_AT_START,
      HEAD_WORLD_Y_AT_END,
      p,
    );
    const headLocalY = Y_TOP - Y_RANGE * p;
    g.position.set(
      Math.sin(p * Math.PI * 2.1 + t * 0.12) * 0.18,
      headTargetY - headLocalY,
      -0.25 + Math.sin(p * Math.PI * 1.5) * 0.18,
    );
    // rotate the whole group (tube + caps) so the caps stay locked to the
    // tube ends through the scroll-driven roll.
    g.rotation.x = Math.sin(t * 0.18 + p * 2.2) * 0.035;
    g.rotation.y = Math.sin(t * 0.16 + p * 1.8) * 0.08;
    g.rotation.z =
      Math.sin(t * 0.25) * 0.035 + Math.sin(p * Math.PI * 1.7) * 0.055;
  });

  return (
    <group ref={groupRef} position={[0, HEAD_WORLD_Y_AT_START - Y_TOP, 0]}>
      <mesh
        ref={meshRef}
        geometry={initial}
        material={material}
        castShadow={tier === "high"}
        receiveShadow={tier === "high"}
      />
      {/* left cap: sphereGeometry of radius 1 - actual size is set per
          frame via mesh.scale so it always matches the tube radius.
          initial position + scale match what useFrame will set on the
          first tick so there's no "giant sphere at origin" flash before
          the frameloop starts. */}
      <mesh
        ref={leftCapRef}
        material={material}
        position={[baseCtrl[0].x, baseCtrl[0].y, baseCtrl[0].z]}
        scale={0.34 * 0.96}
        castShadow={tier === "high"}
        receiveShadow={tier === "high"}
      >
        <sphereGeometry
          args={[
            1,
            tier === "low" ? 16 : tier === "medium" ? 24 : 32,
            tier === "low" ? 12 : tier === "medium" ? 18 : 24,
          ]}
        />
      </mesh>
      {/* right cap: same shape, parks at the current draw-head so the
          growing leading edge of the tube reads as a rounded tip rather
          than an open hole. starts co-located with the left cap because
          at p=0 the tube has only one visible segment. */}
      <mesh
        ref={rightCapRef}
        material={material}
        position={[baseCtrl[0].x, baseCtrl[0].y, baseCtrl[0].z]}
        scale={0.34 * 0.96}
        castShadow={tier === "high"}
        receiveShadow={tier === "high"}
      >
        <sphereGeometry
          args={[
            1,
            tier === "low" ? 16 : tier === "medium" ? 24 : 32,
            tier === "low" ? 12 : tier === "medium" ? 18 : 24,
          ]}
        />
      </mesh>
    </group>
  );
}

function RibbonScene({
  progressRef,
  tier,
}: {
  progressRef: React.MutableRefObject<number>;
  tier: PerformanceTier;
}) {
  const accent = useAccent();
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={42} />
      {tier !== "low" && (
        <Environment
          preset="studio"
          environmentIntensity={tier === "medium" ? 0.55 : 0.9}
        />
      )}
      <directionalLight position={[5, 6, 5]} intensity={0.95} color="#FFFFFF" />
      {tier !== "low" && (
        <directionalLight
          position={[-5, -2, 3]}
          intensity={0.55}
          color={accent.warm}
        />
      )}
      {tier === "high" && (
        <directionalLight
          position={[2, -4, -2]}
          intensity={0.3}
          color={accent.soft}
        />
      )}
      <ambientLight intensity={0.32} />
      <Ribbon progressRef={progressRef} tier={tier} />
    </>
  );
}

export function RibbonView3D({
  className,
  progress: externalProgress,
}: {
  className?: string;
  // optional externally-measured progress (0-1). when the ribbon container
  // is sticky, its own bounding rect is fixed at viewport top through the
  // scroll-through so internal measurement stalls - pass the parent
  // section's `useElementProgress` value in to drive the ribbon's grow +
  // weave through a longer scroll runway.
  progress?: number;
}) {
  const { ref: progRef, progress: internalProgress } =
    useElementProgress<HTMLDivElement>();
  const { ref: visRef, visible } = useIsVisible<HTMLDivElement>("200px");
  const reduced = useReducedMotion();
  const tier = usePerformanceTier(reduced);
  const dpr = tierDpr(tier, 1.25, 1, 0.85);
  const progressRef = useRef(0);
  progressRef.current = externalProgress ?? internalProgress;

  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const frameloop = !ready
    ? "never"
    : reduced
      ? "demand"
      : visible
        ? "always"
        : "never";

  // attach both refs to the same wrapping div.
  const setRef = (el: HTMLDivElement | null) => {
    progRef.current = el;
    visRef.current = el;
  };

  return (
    <div ref={setRef} className={className}>
      <Canvas
        key={tier}
        dpr={dpr}
        frameloop={frameloop}
        gl={{
          antialias: tier === "high",
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <RibbonScene progressRef={progressRef} tier={tier} />
      </Canvas>
    </div>
  );
}
