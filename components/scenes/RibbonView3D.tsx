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

// 3d ribbon: catmull-rom tube morphed by sin(t) + scroll progress.

const SEG_ALONG = 224;
const SEG_AROUND = 14;

const Y_TOP = 4.0;
const Y_BOTTOM = -11.2;
const Y_RANGE = Y_TOP - Y_BOTTOM;
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
  // hemispherical caps plug the open tube ends so they don't read as hollow.
  const leftCapRef = useRef<THREE.Mesh>(null);
  const rightCapRef = useRef<THREE.Mesh>(null);
  const lastGeometryAt = useRef(-Infinity);
  const segAlong = tier === "low" ? 72 : tier === "medium" ? 144 : SEG_ALONG;
  const segAround = tier === "low" ? 6 : tier === "medium" ? 12 : SEG_AROUND;
  // rebuild cadence: mobile/low rebuilds 12x/sec (half-fast still looks fluid
  // since the tube path is smooth and small phase shifts blend visually).
  const rebuildFps = tier === "low" ? 12 : tier === "medium" ? 36 : 48;
  // clamped-dt accumulator survives paused frameloops without phase jump.
  const timeRef = useRef(0);
  // only OUR generated geometries live here; `initial` is owned by the useMemo.
  const generatedRef = useRef<THREE.TubeGeometry | null>(null);

  // base control points form a descending path with z-depth variation.
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

  // scratch buffer reused each frame to avoid allocation.
  const scratch = useMemo(
    () => baseCtrl.map(() => new THREE.Vector3()),
    [baseCtrl],
  );

  // shared material across tube + caps so iridescence reads as one surface.
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
    // long-pause resume forces geometry rebuild so tube matches current scroll.
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

      // grow tube top→bottom by trimming index buffer to leading segments.
      const visibleSegments = Math.max(1, Math.floor(p * segAlong));
      const indexCount = visibleSegments * segAround * 6;
      next.setDrawRange(0, indexCount);

      if (generatedRef.current) {
        generatedRef.current.dispose();
      }
      generatedRef.current = next;
      m.geometry = next;
      lastGeometryAt.current = t;

      // caps ride curve endpoints, scaled just under tubeRadius for clean tuck.
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
      {/* left cap: radius set per-frame via mesh.scale to match tube radius. */}
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
      {/* right cap: parks at current draw-head so leading edge reads rounded. */}
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
  // optional externally-measured progress (0-1) for sticky containers.
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
