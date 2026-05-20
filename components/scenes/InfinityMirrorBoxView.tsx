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
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  tier: PerformanceTier;
}) {
  if (tier === "low") {
    // dark not-quite-mirror - still reads as a wall of the room and catches
    // the central sigil's light, but skips the per-frame reflection pass.
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
        // blur kernel adds depth + hides the fact that we're only doing one
        // real reflection bounce (not true recursive infinity). higher blur
        // at high tier sells the "fog of mirrors" feel better.
        blur={tier === "high" ? [120, 40] : [56, 22]}
        // 160 at high is the sweet spot - 192 was overkill for a wall that's
        // usually viewed at an oblique angle. cheaper per frame.
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

function MirrorRoom({ tier }: { tier: PerformanceTier }) {
  // walls are ordered by importance to the infinity-room illusion when the
  // camera is INSIDE the box looking toward a corner:
  //   0 floor  - catches sigil light, grounds the scene
  //   1 back   - primary depth corridor
  //   2 left   - sidewall recursion
  //   3 right  - sidewall recursion
  //   4 ceiling - only matters when camera tilts up
  //   5 front  - behind the camera most of the time, expensive for nothing
  // tier slicing trims from the end so we keep the visually critical walls.
  const walls = useMemo(() => {
    const s = 7.6;
    return [
      {
        position: [0, -s / 2, 0],
        rotation: [-Math.PI / 2, 0, 0],
        size: [s, s],
      }, // floor
      { position: [0, 0, -s / 2], rotation: [0, 0, 0], size: [s, s] }, // back
      { position: [-s / 2, 0, 0], rotation: [0, Math.PI / 2, 0], size: [s, s] }, // left
      { position: [s / 2, 0, 0], rotation: [0, -Math.PI / 2, 0], size: [s, s] }, // right
      { position: [0, s / 2, 0], rotation: [Math.PI / 2, 0, 0], size: [s, s] }, // ceiling
      { position: [0, 0, s / 2], rotation: [0, Math.PI, 0], size: [s, s] }, // front
    ] as Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      size: [number, number];
    }>;
  }, []);
  // high: 5 walls (skip front - camera is between mid and back of box, the
  //   front wall behind it adds reflection cost with almost no visual gain).
  // medium: 4 walls (skip front + ceiling).
  // low: still renders all 6 walls but as cheap meshStandard (no per-frame
  //   reflection pass at all), so the cost is negligible.
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
        />
      ))}
    </group>
  );
}

// glow shards orbiting the central sigil at varying radii + speeds. these
// don't carry their own point lights (would blow the per-frame light budget
// in the reflection passes), but they ARE emissive + meshBasic + additive,
// so they read as small bright streaks in every mirror reflection. the
// recursive bounce of moving streaks is what really sells the infinity-room
// feel beyond just "the room is mirrored."
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
      // each shard gets its own orbit plane + speed so they don't sync up
      // into an obvious ring - feels more like fireflies in a cathedral.
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
          {/* shards softened from 0.92 → 0.65 opacity. additive blending
              already stacks brightness in mirror reflections; full-strength
              shards combined with the dimmed sigil were still over-glaring. */}
          <meshBasicMaterial
            color={shard.tint}
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
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
  const particles = useMemo(() => {
    const count = tier === "high" ? 180 : tier === "medium" ? 110 : 56;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      const layer = i % 5;
      return {
        a,
        layer,
        r: 1.1 + layer * 0.22 + Math.sin(i * 17.3) * 0.05,
        y: (layer - 2) * 0.22,
        s: 0.018 + ((i * 13) % 9) * 0.003,
      };
    });
  }, [tier]);

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
    const pointer = pointerRef.current;
    if (group) {
      // scroll-driven rotation amounts intentionally larger than they look on
      // paper: the camera also orbits during scroll, so the *visible* sigil
      // rotation is the sum of the sigil spin + camera arc. previous values
      // (x: 0.22, y: 0, z: π*0.28) made the core element feel static while
      // the camera did all the work. these give the sigil a near-full spin
      // on the Y axis and a meaningful tilt + roll over the section so the
      // central object actually sells the "scrolling through a chamber"
      // feel rather than just rotating "a little."
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
        1 + Math.sin(timeRef.current * 0.8) * 0.035 + p * 0.24 + pulse * 0.2,
      );
    }
    if (knot) {
      knot.rotation.x += step * 0.22;
      knot.rotation.y += step * 0.18;
      const mat = knot.material as THREE.MeshStandardMaterial;
      // dimmer base + smaller scroll ramp. previous values (1.7 + p*1.1)
      // blew out the bloom pass and reads as a sun rather than a glow.
      mat.emissiveIntensity = 0.5 + p * 0.32 + pulse * 0.42;
      if (sigilTexture) {
        sigilTexture.offset.x = (sigilTexture.offset.x + step * 0.018) % 1;
        sigilTexture.offset.y = (sigilTexture.offset.y + step * 0.006) % 1;
      }
    }
    if (coreLightRef.current) {
      coreLightRef.current.intensity = 2.75 + p * 0.65 + pulse * 2.25;
    }
    if (warmLightRef.current) {
      warmLightRef.current.intensity = 1.15 + pulse * 1.25;
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
      <mesh>
        <sphereGeometry
          args={[0.58, tier === "high" ? 64 : 32, tier === "high" ? 32 : 16]}
        />
        {/* the inner additive glow sphere - halved from 0.16 to 0.08 so it's
            a halo not a beacon. additive blending stacks the brightness in
            reflections, so what feels mild here goes nuclear when bounced. */}
        <meshBasicMaterial
          color={accent.base}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {particles.map((particle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(particle.a) * particle.r,
            particle.y,
            Math.sin(particle.a) * particle.r,
          ]}
          scale={particle.s}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial
            color={
              i % 3 === 0
                ? accent.warm
                : i % 3 === 1
                  ? accent.base
                  : accent.soft
            }
            transparent
            opacity={0.72}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* main fill light from inside the sigil. dropped 6.5 → 3.2 because
          mirror reflections were doubling/tripling the perceived intensity. */}
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

// camera anchored INSIDE the box, locked to a constant 1.9-unit radius
// from the central sigil. scroll only rotates the ORBIT angle (covers
// ~80° of arc end-to-end) - there's no forward dolly. previous version
// dollied through the box on scroll, which felt like flying and broke
// the "infinity room" frame; now you're observing the room from
// gradually shifting angles, which is what an infinity room actually
// invites you to do.
//
// box half-width is 3.8 units, so a 1.9-unit camera radius leaves ~1.9
// units of clearance to any wall - we never clip or poke through.
function MirrorCamera({
  pointerRef,
  reduced,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  reduced: boolean;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const progressRef = useSectionProgress();
  const timeRef = useRef(0);

  useFrame((_, dt) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const step = Math.min(dt, 1 / 30);
    timeRef.current += step;
    const p = reduced ? 0.5 : progressRef.current;
    const pulse = Math.sin(p * Math.PI);
    const pointer = pointerRef.current;
    pointer.smoothX = THREE.MathUtils.damp(pointer.smoothX, pointer.x, 4, step);
    pointer.smoothY = THREE.MathUtils.damp(pointer.smoothY, pointer.y, 4, step);
    const t = timeRef.current;
    // orbit angle: -0.55 (front-right corner view) → +0.85 (past front-left).
    // sin wobble keeps it alive when scroll is paused. pointer nudge lets
    // the user push the orbit slightly without taking control.
    const angle =
      -0.7 + p * 1.75 + Math.sin(t * 0.07) * 0.08 + pointer.smoothX * 0.2;
    const radius = 1.9;
    // vertical: subtle bob + pointer parallax. NO scroll-driven y change,
    // so it doesn't feel like an elevator.
    const yOffset = 0.42 + Math.sin(t * 0.06) * 0.14 + pointer.smoothY * 0.18;
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
    camera.fov = THREE.MathUtils.damp(camera.fov, 66 + pulse * 8, 2.8, step);
    camera.updateProjectionMatrix();
    // always look at the central sigil. small pointer-driven offset for
    // micro-parallax without the lookpoint feeling unanchored.
    camera.lookAt(pointer.smoothX * 0.15, pointer.smoothY * 0.12, 0);
    // slight cinematic roll, capped tight.
    camera.rotateZ(Math.sin(t * 0.09) * 0.022 + (p - 0.5) * 0.035);
  });

  // FOV 68 inside the small box stretches the recursive reflections
  // toward the frame edges - reads as more depth than the geometry has.
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
      {/* tight fog so distant reflections fade into pure black - gives
          the corridor depth even with only one real bounce, and hides
          the far-mirror seams completely. */}
      <fog attach="fog" args={["#010105", 3.2, 11]} />
      <MirrorCamera pointerRef={pointerRef} reduced={reduced} />
      {/* near-zero ambient keeps the room genuinely dark - the only light
          should be coming from the sigil itself + its orbiting shards. */}
      <ambientLight intensity={0.035} />
      <MirrorRoom tier={tier} />
      <LightSigil
        pointerRef={pointerRef}
        progressRef={progressRef}
        tier={tier}
      />
      <OrbitingShards tier={tier} progressRef={progressRef} />
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
