"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useAccent } from "@/components/AccentProvider";
import {
  isAppleGPU,
  tierDpr,
  usePerformanceTier,
  type PerformanceTier,
} from "@/lib/performance";
import {
  useElementProgress,
  useIsVisible,
  useReducedMotion,
} from "@/lib/scroll";
import { HDRI_STUDIO_HREF } from "@/lib/site";

// 3d ribbon: catmull-rom tube morphed by sin(t) + scroll progress.

const SEG_ALONG = 224;
const SEG_AROUND = 14;

const Y_TOP = 4.0;
const Y_BOTTOM = -11.2;
const Y_RANGE = Y_TOP - Y_BOTTOM;
const HEAD_WORLD_Y_AT_START = 2.0;
const HEAD_WORLD_Y_AT_END = -2.0;

// one tube geometry, rewritten in place. the previous version built a fresh
// THREE.TubeGeometry (new position/normal/uv/index buffers + gpu upload) up
// to 48x a second and disposed the old one, which was constant gc churn and
// a buffer re-allocation every rebuild. vertex math and frenet frames mirror
// three's TubeGeometry / Curve.computeFrenetFrames exactly, but every array
// and Vector3 here is allocated once and reused.
class ReusableTube {
  readonly geometry: THREE.BufferGeometry;
  private readonly position: THREE.BufferAttribute;
  private readonly normal: THREE.BufferAttribute;
  private readonly tangents: THREE.Vector3[];
  private readonly normals: THREE.Vector3[];
  private readonly binormals: THREE.Vector3[];
  private readonly P = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly vec = new THREE.Vector3();
  private readonly mat = new THREE.Matrix4();

  constructor(
    private readonly segAlong: number,
    private readonly segAround: number,
  ) {
    const rows = segAlong + 1;
    const ring = segAround + 1;
    const vertexCount = rows * ring;
    this.position = new THREE.BufferAttribute(
      new Float32Array(vertexCount * 3),
      3,
    );
    this.normal = new THREE.BufferAttribute(
      new Float32Array(vertexCount * 3),
      3,
    );
    this.position.setUsage(THREE.DynamicDrawUsage);
    this.normal.setUsage(THREE.DynamicDrawUsage);
    const uvs = new Float32Array(vertexCount * 2);
    for (let i = 0; i <= segAlong; i++) {
      for (let j = 0; j <= segAround; j++) {
        const o = (i * ring + j) * 2;
        uvs[o] = i / segAlong;
        uvs[o + 1] = j / segAround;
      }
    }
    const index: number[] = [];
    for (let j = 1; j <= segAlong; j++) {
      for (let i = 1; i <= segAround; i++) {
        const a = ring * (j - 1) + (i - 1);
        const b = ring * j + (i - 1);
        const c = ring * j + i;
        const d = ring * (j - 1) + i;
        index.push(a, b, d, b, c, d);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", this.position);
    this.geometry.setAttribute("normal", this.normal);
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    this.geometry.setIndex(index);
    this.tangents = Array.from({ length: rows }, () => new THREE.Vector3());
    this.normals = Array.from({ length: rows }, () => new THREE.Vector3());
    this.binormals = Array.from({ length: rows }, () => new THREE.Vector3());
  }

  // Curve.computeFrenetFrames (open curve) into the preallocated arrays.
  private frames(curve: THREE.Curve<THREE.Vector3>) {
    const { segAlong, tangents, normals, binormals, vec, mat, n } = this;
    for (let i = 0; i <= segAlong; i++) {
      curve.getTangentAt(i / segAlong, tangents[i]);
    }
    const t0 = tangents[0];
    let min = Number.MAX_VALUE;
    const tx = Math.abs(t0.x);
    const ty = Math.abs(t0.y);
    const tz = Math.abs(t0.z);
    if (tx <= min) {
      min = tx;
      n.set(1, 0, 0);
    }
    if (ty <= min) {
      min = ty;
      n.set(0, 1, 0);
    }
    if (tz <= min) n.set(0, 0, 1);
    vec.crossVectors(t0, n).normalize();
    normals[0].crossVectors(t0, vec);
    binormals[0].crossVectors(t0, normals[0]);
    for (let i = 1; i <= segAlong; i++) {
      normals[i].copy(normals[i - 1]);
      vec.crossVectors(tangents[i - 1], tangents[i]);
      if (vec.length() > Number.EPSILON) {
        vec.normalize();
        const theta = Math.acos(
          THREE.MathUtils.clamp(tangents[i - 1].dot(tangents[i]), -1, 1),
        );
        normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
      }
      binormals[i].crossVectors(tangents[i], normals[i]);
    }
  }

  update(curve: THREE.Curve<THREE.Vector3>, radius: number) {
    this.frames(curve);
    const { segAlong, segAround, P, n } = this;
    const pos = this.position.array as Float32Array;
    const nor = this.normal.array as Float32Array;
    let o = 0;
    for (let i = 0; i <= segAlong; i++) {
      curve.getPointAt(i / segAlong, P);
      const N = this.normals[i];
      const B = this.binormals[i];
      for (let j = 0; j <= segAround; j++) {
        const v = (j / segAround) * Math.PI * 2;
        const sin = Math.sin(v);
        const cos = -Math.cos(v);
        n.set(
          cos * N.x + sin * B.x,
          cos * N.y + sin * B.y,
          cos * N.z + sin * B.z,
        ).normalize();
        nor[o] = n.x;
        nor[o + 1] = n.y;
        nor[o + 2] = n.z;
        pos[o] = P.x + radius * n.x;
        pos[o + 1] = P.y + radius * n.y;
        pos[o + 2] = P.z + radius * n.z;
        o += 3;
      }
    }
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
  }
}

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

  // scratch control points, mutated in place each rebuild. the curve is built
  // once over this same array; `updateArcLengths()` refreshes its cache.
  const scratch = useMemo(
    () => baseCtrl.map((v) => v.clone()),
    [baseCtrl],
  );
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(scratch, false, "centripetal", 0.5),
    [scratch],
  );

  const tube = useMemo(() => {
    const t = new ReusableTube(segAlong, segAround);
    t.update(curve, 0.34);
    t.geometry.setDrawRange(0, segAround * 6);
    return t;
  }, [curve, segAlong, segAround]);
  useEffect(() => () => tube.dispose(), [tube]);

  // shared material across tube + caps so iridescence reads as one surface.
  // built once per tier; the accent recolors it in place below rather than
  // rebuilding, which would destroy the compiled iridescence shader.
  const accentRef = useRef(accent);
  accentRef.current = accent;
  const material = useMemo<THREE.Material>(() => {
    const accent = accentRef.current;
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
  }, [tier]);

  useEffect(() => {
    const m = material as THREE.MeshPhysicalMaterial;
    m.color.set(accent.base);
    if (tier === "low") m.emissive.set(accent.base);
    else if (m.sheenColor) m.sheenColor.set(accent.warm);
  }, [material, tier, accent.base, accent.warm]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

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
      // control points moved under the curve; refresh its arc-length table so
      // getPointAt/getTangentAt sample evenly along the new path.
      curve.updateArcLengths();
      const tubeRadius = 0.31 + p * 0.08;
      tube.update(curve, tubeRadius);

      // grow tube top→bottom by trimming index buffer to leading segments.
      const visibleSegments = Math.max(1, Math.floor(p * segAlong));
      tube.geometry.setDrawRange(0, visibleSegments * segAround * 6);
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
      {/* frustumCulled off: the vertex buffer is rewritten in place, so the
          bounding sphere computed on first draw would go stale. the tube is
          always on screen while this canvas has a frameloop anyway. */}
      <mesh
        ref={meshRef}
        geometry={tube.geometry}
        material={material}
        frustumCulled={false}
      />
      {/* left cap: radius set per-frame via mesh.scale to match tube radius. */}
      <mesh
        ref={leftCapRef}
        material={material}
        position={[baseCtrl[0].x, baseCtrl[0].y, baseCtrl[0].z]}
        scale={0.34 * 0.96}
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

// anchor the perspective camera to a 16:9 frame: at that aspect use 42°
// vertical fov (current look). on wider aspects, narrow the vertical fov
// so horizontal coverage stays constant - keeps the ribbon's leftmost
// world point (~x=-8.8) off-screen left on ultrawide displays.
const REF_ASPECT = 16 / 9;
const BASE_FOV_DEG = 42;
function aspectAdjustedFov(aspect: number): number {
  if (aspect <= REF_ASPECT) return BASE_FOV_DEG;
  const baseHalf = (BASE_FOV_DEG * 0.5 * Math.PI) / 180;
  const tanHHalf = Math.tan(baseHalf) * REF_ASPECT;
  return (Math.atan(tanHHalf / aspect) * 2 * 180) / Math.PI;
}

function RibbonScene({
  progressRef,
  tier,
}: {
  progressRef: React.MutableRefObject<number>;
  tier: PerformanceTier;
}) {
  const accent = useAccent();
  const { size } = useThree();
  const fov = aspectAdjustedFov(size.width / Math.max(1, size.height));
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={fov} />
      {tier !== "low" && (
        <Environment
          files={HDRI_STUDIO_HREF}
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
  progressRef: externalProgressRef,
}: {
  className?: string;
  // optional externally-measured progress ref (0-1) for sticky containers.
  // a ref, not a number: the frame loop reads it directly, so scroll never
  // re-renders this component or the <Canvas> under it.
  progressRef?: React.MutableRefObject<number>;
}) {
  const { ref: progRef, progressRef: internalProgressRef } =
    useElementProgress<HTMLDivElement>(!externalProgressRef);
  const { ref: visRef, visible } = useIsVisible<HTMLDivElement>("200px");
  const reduced = useReducedMotion();
  const tier = usePerformanceTier(reduced, visible);
  const apple = isAppleGPU();
  const dpr = tierDpr(tier, 1.25, 1, 0.85);
  const progressRef = externalProgressRef ?? internalProgressRef;

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
      {/* no `key={tier}`: tier changes re-tune the live scene (geometry
          density, material, lights) rather than recreating the webgl context. */}
      <Canvas
        dpr={dpr}
        frameloop={frameloop}
        gl={{
          antialias: tier === "high" && !apple,
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
