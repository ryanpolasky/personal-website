"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MeshReflectorMaterial, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useAccent } from "@/components/AccentProvider";
import {
  tierDpr,
  usePerformanceTier,
  type PerformanceTier,
} from "@/lib/performance";
import { useIsVisible, useReducedMotion } from "@/lib/scroll";

type PointerState = {
  x: number;
  y: number;
  smoothX: number;
  smoothY: number;
  active: number;
};

// scroll-arc phase helpers: split 720vh of travel into perceptual acts.
// ignition peaks at ~0.5 (apex). dive is a narrow camera-dolly window.
function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
function ignitionT(p: number): number {
  return smoothstep01(0.3, 0.5, p) * (1 - smoothstep01(0.5, 0.85, p));
}
function diveT(p: number): number {
  return Math.sin(
    THREE.MathUtils.clamp((p - 0.42) / 0.16, 0, 1) * Math.PI,
  );
}

function makeSigilTexture(accent: {
  base: string;
  warm: string;
  soft: string;
}) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const base = ctx.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, "#f6f3ea");
  base.addColorStop(0.28, accent.soft);
  base.addColorStop(0.5, "#8f91a3");
  base.addColorStop(0.72, accent.base);
  base.addColorStop(1, "#11131f");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 110; i += 1) {
    const y = (i / 110) * 512;
    const alpha = 0.035 + Math.sin(i * 1.7) * 0.018;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1 + (i % 5) * 0.35;
    ctx.beginPath();
    ctx.moveTo(-80, y);
    ctx.bezierCurveTo(
      120,
      y + Math.sin(i) * 28,
      330,
      y - Math.cos(i * 0.7) * 38,
      592,
      y + Math.sin(i * 0.4) * 18,
    );
    ctx.stroke();
  }

  for (let i = 0; i < 32; i += 1) {
    const x = ((i * 73) % 512) - 80;
    const glow = ctx.createRadialGradient(x, 256, 0, x, 256, 220);
    glow.addColorStop(
      0,
      i % 2 === 0 ? "rgba(255,255,255,0.18)" : `${accent.warm}33`,
    );
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 512);
  }

  const grain = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = ((i * 17 + i / 7) % 31) - 15;
    grain.data[i] = Math.max(0, Math.min(255, grain.data[i] + n));
    grain.data[i + 1] = Math.max(0, Math.min(255, grain.data[i + 1] + n));
    grain.data[i + 2] = Math.max(0, Math.min(255, grain.data[i + 2] + n));
  }
  ctx.putImageData(grain, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1.15);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function useSectionProgress() {
  const ref = useRef(0);
  const { gl } = useThree();

  useFrame(() => {
    if (typeof window === "undefined") return;
    const tunnel = gl.domElement.closest(
      "[data-kaleidoscope-tunnel]",
    ) as HTMLElement | null;
    const vh = window.innerHeight || 1;
    if (!tunnel) return;
    const rect = tunnel.getBoundingClientRect();
    const travel = Math.max(1, rect.height - vh);
    ref.current = THREE.MathUtils.clamp(-rect.top / travel, 0, 1);
  });

  return ref;
}

function usePointer(active: boolean) {
  const pointer = useRef<PointerState>({
    x: 0,
    y: 0,
    smoothX: 0,
    smoothY: 0,
    active: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const move = (e: PointerEvent) => {
      if (!active) return;
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
      pointer.current.active = 1;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [active]);

  return pointer;
}

function MirrorWall({
  position,
  rotation,
  size,
  tier,
  progressRef,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  tier: PerformanceTier;
  progressRef: React.MutableRefObject<number>;
}) {
  // drei's MeshReflectorMaterial subclasses MeshStandardMaterial; ref the
  // shared base shape so we can mutate .color each frame for the wall drift.
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const baseColor = useMemo(() => new THREE.Color(0x020208), []);
  const tintColor = useMemo(() => new THREE.Color(0x190a23), []);

  useFrame(() => {
    if (tier === "low") return;
    const mat = matRef.current;
    if (!mat || !mat.color) return;
    const ignition = ignitionT(progressRef.current);
    mat.color.copy(baseColor).lerp(tintColor, ignition * 0.35);
  });

  if (tier === "low") {
    return (
      <mesh position={position} rotation={rotation}>
        <planeGeometry args={size} />
        <meshStandardMaterial
          color="#04040a"
          roughness={0.22}
          metalness={0.92}
        />
      </mesh>
    );
  }

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <MeshReflectorMaterial
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={matRef as any}
        blur={tier === "high" ? [120, 40] : [56, 22]}
        resolution={tier === "high" ? 160 : 88}
        mixBlur={0.92}
        mixStrength={tier === "high" ? 4.6 : 2.6}
        mirror={0.96}
        color="#020208"
        roughness={0.06}
        metalness={1}
        depthScale={0.92}
        minDepthThreshold={0.18}
        maxDepthThreshold={1.85}
      />
    </mesh>
  );
}

function MirrorRoom({
  tier,
  progressRef,
}: {
  tier: PerformanceTier;
  progressRef: React.MutableRefObject<number>;
}) {
  const walls = useMemo(() => {
    const s = 7.6;
    return [
      {
        position: [0, -s / 2, 0],
        rotation: [-Math.PI / 2, 0, 0],
        size: [s, s],
      },
      { position: [0, 0, -s / 2], rotation: [0, 0, 0], size: [s, s] },
      { position: [-s / 2, 0, 0], rotation: [0, Math.PI / 2, 0], size: [s, s] },
      { position: [s / 2, 0, 0], rotation: [0, -Math.PI / 2, 0], size: [s, s] },
      { position: [0, s / 2, 0], rotation: [Math.PI / 2, 0, 0], size: [s, s] },
      { position: [0, 0, s / 2], rotation: [0, Math.PI, 0], size: [s, s] },
    ] as Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      size: [number, number];
    }>;
  }, []);
  const activeWalls =
    tier === "high"
      ? walls.slice(0, 5)
      : tier === "medium"
        ? walls.slice(0, 4)
        : walls;

  return (
    <group>
      {activeWalls.map((wall, i) => (
        <MirrorWall
          key={i}
          position={wall.position}
          rotation={wall.rotation}
          size={wall.size}
          tier={tier}
          progressRef={progressRef}
        />
      ))}
    </group>
  );
}

// armillary outer cage: 2-3 thin emissive toruses counter-rotating at
// different tilts. mirror walls turn this into an orrery-style infinity.
function ArmillaryRings({
  tier,
  progressRef,
}: {
  tier: PerformanceTier;
  progressRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const accent = useAccent();

  useFrame((_, dt) => {
    const step = Math.min(dt, 1 / 30);
    timeRef.current += step;
    const t = timeRef.current;
    const p = progressRef.current;
    const ignition = ignitionT(p);

    if (groupRef.current) {
      groupRef.current.scale.setScalar(1 + ignition * 0.12);
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.y = t * 0.35 + p * 1.2;
      ring1Ref.current.rotation.z = Math.sin(t * 0.2) * 0.08;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -t * 0.42 - p * 0.9;
      ring2Ref.current.rotation.y = Math.cos(t * 0.18) * 0.12;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = t * 0.28 + p * 0.6;
      ring3Ref.current.rotation.x = Math.sin(t * 0.16) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={ring1Ref} rotation={[0.5, 0, 0]}>
        <torusGeometry args={[1.05, 0.018, 10, 96]} />
        <meshBasicMaterial
          color={accent.soft}
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ring2Ref} rotation={[0, 0, Math.PI / 2.4]}>
        <torusGeometry args={[1.22, 0.014, 10, 96]} />
        <meshBasicMaterial
          color={accent.warm}
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      {tier === "high" && (
        <mesh ref={ring3Ref} rotation={[Math.PI / 3, 0, Math.PI / 3]}>
          <torusGeometry args={[1.38, 0.011, 8, 80]} />
          <meshBasicMaterial
            color={accent.base}
            transparent
            opacity={0.78}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

// instanced dust ring around the sigil. one draw call for 130-420 particles.
// per-instance color cycles warm/base/soft for chromatic variety in bloom.
function OrbitingParticles({ tier }: { tier: PerformanceTier }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const accent = useAccent();
  const count = tier === "high" ? 420 : tier === "medium" ? 260 : 130;
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      const layer = i % 6;
      return {
        a,
        baseR: 1.1 + layer * 0.22 + Math.sin(i * 17.3) * 0.05,
        baseY: (layer - 2.5) * 0.2,
        s: 0.018 + ((i * 13) % 9) * 0.003,
        speed: 0.04 + ((i * 7) % 5) * 0.012,
      };
    });
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const timeRef = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const hex =
        i % 3 === 0
          ? accent.warm
          : i % 3 === 1
            ? accent.base
            : accent.soft;
      c.set(hex);
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [accent, count]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const step = Math.min(dt, 1 / 30);
    timeRef.current += step;
    const t = timeRef.current;
    for (let i = 0; i < count; i += 1) {
      const cfg = particles[i];
      const angle = cfg.a + t * cfg.speed;
      const r = cfg.baseR + Math.sin(t * 0.6 + i) * 0.04;
      dummy.position.set(
        Math.cos(angle) * r,
        cfg.baseY,
        Math.sin(angle) * r,
      );
      const s = cfg.s * (1 + Math.sin(t * 2.2 + i) * 0.18);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        transparent
        opacity={0.72}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function randomOuterPointInto(v: THREE.Vector3) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 2.5 + Math.random() * 0.9;
  v.set(
    Math.sin(phi) * Math.cos(theta) * r,
    Math.cos(phi) * r * 0.7,
    Math.sin(phi) * Math.sin(theta) * r,
  );
}

// inward-streaming energy sparks: each spawns at a random outer point,
// travels toward origin with eased trajectory, fades out, respawns.
// sells the sigil as "gathering energy". very cheap (instanced, low count).
function EnergySparks({ tier }: { tier: PerformanceTier }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const accent = useAccent();
  const count = tier === "high" ? 36 : tier === "medium" ? 20 : 8;

  const sparks = useMemo(() => {
    return Array.from({ length: count }, () => {
      const origin = new THREE.Vector3();
      randomOuterPointInto(origin);
      return {
        origin,
        t: Math.random(),
        duration: 1.6 + Math.random() * 1.4,
      };
    });
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const step = Math.min(dt, 1 / 30);
    for (let i = 0; i < count; i += 1) {
      const s = sparks[i];
      s.t += step / s.duration;
      if (s.t >= 1) {
        randomOuterPointInto(s.origin);
        s.t = 0;
        s.duration = 1.6 + Math.random() * 1.4;
      }
      const eased = 1 - Math.pow(1 - s.t, 3);
      const k = 1 - eased;
      dummy.position.set(s.origin.x * k, s.origin.y * k, s.origin.z * k);
      const fade = Math.sin(s.t * Math.PI);
      dummy.scale.setScalar(0.055 * fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial
        color={accent.warm}
        transparent
        opacity={0.98}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

// emissive shards orbiting the sigil; bounced in reflections to sell depth.
function OrbitingShards({
  tier,
  progressRef,
}: {
  tier: PerformanceTier;
  progressRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const accent = useAccent();
  const shards = useMemo(() => {
    const count = tier === "high" ? 7 : tier === "medium" ? 5 : 3;
    return Array.from({ length: count }, (_, i) => ({
      radius: 1.6 + (i % 3) * 0.55 + Math.sin(i * 1.7) * 0.18,
      tilt: (i / count) * Math.PI * 1.4 + Math.sin(i) * 0.4,
      yawSpeed: 0.18 + ((i * 7) % 5) * 0.04,
      pitchSpeed: 0.06 + ((i * 11) % 7) * 0.018,
      phase: (i / count) * Math.PI * 2,
      scale: 0.075 + ((i * 13) % 9) * 0.012,
      tint: i % 3 === 0 ? accent.warm : i % 3 === 1 ? accent.base : accent.soft,
    }));
  }, [tier, accent]);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;
    const step = Math.min(dt, 1 / 30);
    timeRef.current += step;
    const p = progressRef.current;
    const t = timeRef.current;
    for (let i = 0; i < group.children.length; i += 1) {
      const shard = group.children[i] as THREE.Mesh;
      const cfg = shards[i];
      const yaw = t * cfg.yawSpeed + cfg.phase + p * 0.6;
      const pitch = t * cfg.pitchSpeed + cfg.tilt;
      const r = cfg.radius * (1 + Math.sin(t * 0.4 + i) * 0.04 + p * 0.18);
      shard.position.x = Math.cos(yaw) * Math.cos(pitch) * r;
      shard.position.y = Math.sin(pitch) * r * 0.7;
      shard.position.z = Math.sin(yaw) * Math.cos(pitch) * r;
      shard.rotation.x += step * 0.6;
      shard.rotation.y += step * 0.45;
      shard.scale.setScalar(
        cfg.scale * (1 + Math.sin(t * 1.4 + i * 2.1) * 0.18),
      );
    }
  });

  return (
    <group ref={groupRef}>
      {shards.map((shard, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial
            color={shard.tint}
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function LightSigil({
  pointerRef,
  progressRef,
  tier,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  progressRef: React.MutableRefObject<number>;
  tier: PerformanceTier;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const knotRef = useRef<THREE.Mesh>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);
  const warmLightRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);
  const accent = useAccent();
  const sigilTexture = useMemo(() => makeSigilTexture(accent), [accent]);

  const baseEmissive = useMemo(
    () => new THREE.Color(accent.soft),
    [accent.soft],
  );
  const warmEmissive = useMemo(
    () => new THREE.Color(accent.warm),
    [accent.warm],
  );
  const baseLightColor = useMemo(
    () => new THREE.Color(accent.base),
    [accent.base],
  );
  const warmLightColor = useMemo(
    () => new THREE.Color(accent.warm),
    [accent.warm],
  );

  useEffect(() => {
    return () => {
      sigilTexture?.dispose();
    };
  }, [sigilTexture]);

  useFrame((_, dt) => {
    const group = groupRef.current;
    const knot = knotRef.current;
    const step = Math.min(dt, 1 / 30);
    timeRef.current += step;
    const p = progressRef.current;
    const pulse = Math.sin(p * Math.PI);
    const ignition = ignitionT(p);
    const pointer = pointerRef.current;
    if (group) {
      group.rotation.x = THREE.MathUtils.damp(
        group.rotation.x,
        pointer.smoothY * 0.22 + p * 0.72 + pulse * 0.16,
        3,
        step,
      );
      group.rotation.y = THREE.MathUtils.damp(
        group.rotation.y,
        timeRef.current * 0.12 + pointer.smoothX * 0.22 + p * Math.PI * 1.9,
        2.2,
        step,
      );
      group.rotation.z = THREE.MathUtils.damp(
        group.rotation.z,
        p * Math.PI * 1.05,
        2,
        step,
      );
      group.scale.setScalar(
        1 +
          Math.sin(timeRef.current * 0.8) * 0.035 +
          p * 0.24 +
          pulse * 0.2 +
          ignition * 0.18,
      );
    }
    if (knot) {
      knot.rotation.x += step * 0.22;
      knot.rotation.y += step * 0.18;
      const mat = knot.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity =
        0.5 + p * 0.32 + pulse * 0.42 + ignition * 0.55;
      mat.emissive.copy(baseEmissive).lerp(warmEmissive, ignition);
      if (sigilTexture) {
        sigilTexture.offset.x = (sigilTexture.offset.x + step * 0.018) % 1;
        sigilTexture.offset.y = (sigilTexture.offset.y + step * 0.006) % 1;
      }
    }
    if (coreLightRef.current) {
      coreLightRef.current.intensity =
        2.75 + p * 0.65 + pulse * 2.25 + ignition * 1.8;
      coreLightRef.current.color
        .copy(baseLightColor)
        .lerp(warmLightColor, ignition * 0.6);
    }
    if (warmLightRef.current) {
      warmLightRef.current.intensity =
        1.15 + pulse * 1.25 + ignition * 0.9;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={knotRef}>
        <torusKnotGeometry
          args={[
            0.68,
            0.13,
            tier === "high" ? 180 : 96,
            tier === "high" ? 20 : 12,
            2,
            5,
          ]}
        />
        <meshPhysicalMaterial
          map={sigilTexture}
          color="#f0edf6"
          emissive={accent.soft}
          emissiveIntensity={0.42}
          roughness={0.24}
          metalness={0.34}
          clearcoat={0.72}
          clearcoatRoughness={0.18}
          iridescence={0.55}
          iridescenceIOR={1.45}
          sheen={0.36}
          sheenColor={accent.warm}
        />
      </mesh>
      {/* inner additive glow core - amplified by bloom + bounced in reflections. */}
      <mesh>
        <sphereGeometry
          args={[0.58, tier === "high" ? 64 : 32, tier === "high" ? 32 : 16]}
        />
        <meshBasicMaterial
          color={accent.base}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* armillary cage around the knot */}
      <ArmillaryRings tier={tier} progressRef={progressRef} />
      <pointLight
        ref={coreLightRef}
        color={accent.base}
        intensity={3.2}
        distance={18}
      />
      <pointLight
        ref={warmLightRef}
        color={accent.warm}
        intensity={1.6}
        distance={12}
        position={[1.8, -1.2, 0.6]}
      />
    </group>
  );
}

// camera path: base orbit + apex dive (narrow window at ~p=0.5 that dollies
// inward + widens FOV for a single dramatic beat instead of constant motion).
function MirrorCamera({
  pointerRef,
  reduced,
  progressRef,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  reduced: boolean;
  progressRef: React.MutableRefObject<number>;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const timeRef = useRef(0);

  useFrame((_, dt) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const step = Math.min(dt, 1 / 30);
    timeRef.current += step;
    const p = reduced ? 0.5 : progressRef.current;
    const pulse = Math.sin(p * Math.PI);
    const dive = diveT(p);
    const pointer = pointerRef.current;
    pointer.smoothX = THREE.MathUtils.damp(pointer.smoothX, pointer.x, 4, step);
    pointer.smoothY = THREE.MathUtils.damp(pointer.smoothY, pointer.y, 4, step);
    const t = timeRef.current;
    const angle =
      -0.7 + p * 1.75 + Math.sin(t * 0.07) * 0.08 + pointer.smoothX * 0.2;
    const radius = 1.9 - dive * 0.55;
    const yOffset =
      0.42 + Math.sin(t * 0.06) * 0.14 + pointer.smoothY * 0.18 - dive * 0.18;
    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      Math.sin(angle) * radius,
      2.6,
      step,
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      yOffset,
      2.6,
      step,
    );
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      Math.cos(angle) * radius,
      2.6,
      step,
    );
    camera.fov = THREE.MathUtils.damp(
      camera.fov,
      66 + pulse * 8 + dive * 7,
      2.8,
      step,
    );
    camera.updateProjectionMatrix();
    camera.lookAt(pointer.smoothX * 0.15, pointer.smoothY * 0.12, 0);
    camera.rotateZ(Math.sin(t * 0.09) * 0.022 + (p - 0.5) * 0.035);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={68}
      position={[-1.05, 0.42, 1.58]}
      near={0.05}
      far={45}
    />
  );
}

// fog opens up during ignition for visual clarity at the apex.
function FogAnimator({
  progressRef,
}: {
  progressRef: React.MutableRefObject<number>;
}) {
  const { scene } = useThree();
  useFrame(() => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    const ignition = ignitionT(progressRef.current);
    fog.far = 11 + ignition * 3.5;
    fog.near = 3.2 - ignition * 0.7;
  });
  return null;
}

function MirrorPost({ tier }: { tier: PerformanceTier }) {
  if (tier === "low") return null;
  const chroma =
    tier === "high" ? (
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.00055, 0.00055)}
        radialModulation
        modulationOffset={0.38}
      />
    ) : (
      <></>
    );

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={tier === "high" ? 1.52 : 0.96}
        luminanceThreshold={0.14}
        luminanceSmoothing={0.48}
      />
      {chroma}
      <Vignette offset={0.16} darkness={0.68} eskil={false} />
    </EffectComposer>
  );
}

function InfinityMirrorScene({
  tier,
  reduced,
}: {
  tier: PerformanceTier;
  reduced: boolean;
}) {
  const pointerRef = usePointer(!reduced);
  const progressRef = useSectionProgress();

  return (
    <>
      <color attach="background" args={["#010105"]} />
      <fog attach="fog" args={["#010105", 3.2, 11]} />
      <FogAnimator progressRef={progressRef} />
      <MirrorCamera
        pointerRef={pointerRef}
        reduced={reduced}
        progressRef={progressRef}
      />
      <ambientLight intensity={0.035} />
      <MirrorRoom tier={tier} progressRef={progressRef} />
      <LightSigil
        pointerRef={pointerRef}
        progressRef={progressRef}
        tier={tier}
      />
      <OrbitingShards tier={tier} progressRef={progressRef} />
      <OrbitingParticles tier={tier} />
      <EnergySparks tier={tier} />
      <MirrorPost tier={tier} />
    </>
  );
}

export function InfinityMirrorBoxView({ className }: { className?: string }) {
  const { ref, visible } = useIsVisible<HTMLDivElement>("900px");
  const reduced = useReducedMotion();
  const tier = usePerformanceTier(reduced);
  const dpr = tierDpr(tier, 1.25, 1, 0.85);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  const frameloop = !ready
    ? "never"
    : reduced
      ? "demand"
      : visible
        ? "always"
        : "never";

  return (
    <div ref={ref} className={className}>
      <Canvas
        key={tier}
        dpr={dpr}
        frameloop={frameloop}
        gl={{
          antialias: tier === "high",
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        style={{ background: "transparent" }}
      >
        <InfinityMirrorScene tier={tier} reduced={reduced} />
      </Canvas>
    </div>
  );
}
