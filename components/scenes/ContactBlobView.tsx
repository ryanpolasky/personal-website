"use client";

import { useEffect, useRef, useState } from "react";
import {
  PerspectiveCamera,
  Environment,
  MeshDistortMaterial,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAccent } from "@/components/AccentProvider";
import {
  tierDpr,
  usePerformanceTier,
  type PerformanceTier,
} from "@/lib/performance";
import { useIsVisible, useReducedMotion } from "@/lib/scroll";

// contact blob: glossy distorting icosphere reacting to window-level pointer.

interface StressState {
  x: number;
  y: number;
  smoothX: number;
  smoothY: number;
  pressure: number;
  targetPressure: number;
  drag: number;
  pulse: number;
  near: number; // 1 when pointer is over stage rect.
  scrolling: number; // ramps on scroll, decays in useFrame to silence drift.
}

type StressRef = React.MutableRefObject<StressState>;

// global pointer tracker: stage-local normalized x/y + 'near' rect proximity.
function useGlobalContactPointer(
  stress: StressRef,
  hostRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let suppressPointerUntil = 0;

    const onScroll = () => {
      suppressPointerUntil = performance.now() + 180;
      stress.current.drag = 0;
      stress.current.targetPressure = 0;
      stress.current.scrolling = 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!active) return;
      const host = hostRef.current;
      if (!host) return;
      const now = performance.now();
      // post-scroll quiet window: rect moves under cursor mid-scroll, so we
      // ignore pointer events for ~180ms to avoid blob "shake".
      if (now < suppressPointerUntil) return;

      const rect = host.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const lx = (e.clientX - cx) / (rect.width * 0.5);
      const ly = -((e.clientY - cy) / (rect.height * 0.5));
      const dx = lx - stress.current.x;
      const dy = ly - stress.current.y;
      stress.current.x = THREE.MathUtils.clamp(lx, -2, 2);
      stress.current.y = THREE.MathUtils.clamp(ly, -2, 2);
      stress.current.drag = Math.min(
        1.2,
        stress.current.drag + Math.hypot(dx, dy) * 2.4,
      );
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      stress.current.near = inside ? 1 : 0;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!active) return;
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) return;
      stress.current.targetPressure = Math.max(0.72, e.pressure || 0.72);
      stress.current.pulse = 1;
    };

    const onPointerUp = () => {
      stress.current.targetPressure = 0;
      stress.current.pulse = Math.max(stress.current.pulse, 0.35);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("blur", onPointerUp);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
    };
  }, [stress, hostRef, active]);
}

function Blob({
  stressRef,
  tier,
}: {
  stressRef: StressRef;
  tier: PerformanceTier;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<{ distort: number; speed: number } & THREE.Material>(
    null,
  );
  const accent = useAccent();

  const target = useRef({ distort: 0.32, rotY: 0, rotX: 0 });
  // capped-dt clock avoids wave-phase pop when canvas resumes from `never`.
  const timeRef = useRef(0);
  const detail = tier === "low" ? 2 : tier === "medium" ? 3 : 5;

  useFrame((_state, rawDt) => {
    if (!meshRef.current) return;
    const dt = Math.min(rawDt, 1 / 30);
    timeRef.current += dt;
    const t = timeRef.current;

    const stress = stressRef.current;
    stress.smoothX = THREE.MathUtils.damp(stress.smoothX, stress.x, 8, dt);
    stress.smoothY = THREE.MathUtils.damp(stress.smoothY, stress.y, 8, dt);
    stress.pressure = THREE.MathUtils.damp(
      stress.pressure,
      stress.targetPressure,
      7,
      dt,
    );
    stress.drag = THREE.MathUtils.damp(stress.drag, 0, 4.5, dt);
    stress.pulse = THREE.MathUtils.damp(stress.pulse, 0, 5, dt);
    stress.scrolling = THREE.MathUtils.damp(stress.scrolling, 0, 5, dt);

    // calm = idle wobble factor; suppressed during scroll.
    const calm = 1 - Math.min(1, stress.scrolling);

    const baseDistort = 0.2 + Math.sin(t * 0.45) * 0.04 * calm;
    const localDist = Math.min(1, Math.hypot(stress.smoothX, stress.smoothY));
    const proximityBonus = (1 - localDist) * 0.18 * stress.near;
    const energy = Math.min(
      1.4,
      stress.pressure + stress.drag * 0.45 + stress.pulse * 0.35,
    );
    target.current.distort = baseDistort + proximityBonus + energy * 0.36;
    target.current.rotY = stress.smoothX * 0.42;
    target.current.rotX = -stress.smoothY * 0.32;

    // dt-normalized smoothing keeps convergence feel framerate-independent.
    const rotLerp = 1 - Math.exp(-dt * 6);
    meshRef.current.rotation.y +=
      (target.current.rotY - meshRef.current.rotation.y) * rotLerp +
      dt * 0.1 * calm;
    meshRef.current.rotation.x +=
      (target.current.rotX - meshRef.current.rotation.x) * rotLerp;

    if (matRef.current) {
      const cur = matRef.current.distort ?? 0;
      const distLerp = 1 - Math.exp(-dt * 9);
      matRef.current.distort = cur + (target.current.distort - cur) * distLerp;
      matRef.current.speed = (tier === "low" ? 1 : 2.2) * calm;
    }

    const squeezeX =
      1.18 + stress.pressure * 0.26 + Math.abs(stress.smoothX) * 0.05;
    const squeezeY =
      1.18 - stress.pressure * 0.2 + Math.abs(stress.smoothY) * 0.04;
    const squeezeZ = 1.18 + stress.pressure * 0.16 + stress.pulse * 0.12;
    meshRef.current.scale.set(squeezeX, squeezeY, squeezeZ);
    meshRef.current.position.y = Math.sin(t * 0.7) * 0.1 * calm;
  });

  return (
    <mesh ref={meshRef} scale={1.18}>
      <icosahedronGeometry args={[1, detail]} />
      <MeshDistortMaterial
        ref={matRef as never}
        color={accent.base}
        roughness={tier === "low" ? 0.28 : 0.12}
        metalness={0.0}
        clearcoat={tier === "low" ? 0.35 : 1.0}
        clearcoatRoughness={tier === "low" ? 0.16 : 0.04}
        distort={tier === "low" ? 0.12 : 0.24}
        speed={tier === "low" ? 1 : 2.2}
      />
    </mesh>
  );
}

function ContactScene({
  stressRef,
  tier,
}: {
  stressRef: StressRef;
  tier: PerformanceTier;
}) {
  const accent = useAccent();
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5.5]} fov={34} />
      {tier !== "low" && (
        <Environment
          preset="studio"
          environmentIntensity={tier === "medium" ? 0.6 : 1.0}
        />
      )}
      <directionalLight position={[3, 5, 4]} intensity={0.9} color="#FFFFFF" />
      {tier !== "low" && (
        <directionalLight
          position={[-4, -2, 3]}
          intensity={0.35}
          color={accent.soft}
        />
      )}
      <directionalLight
        position={[0, 0, -4]}
        intensity={tier === "low" ? 1.0 : 1.4}
        color={accent.warm}
      />
      <ambientLight intensity={tier === "low" ? 0.34 : 0.2} />
      <Blob stressRef={stressRef} tier={tier} />
    </>
  );
}

export function ContactBlobView({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stressRef = useRef<StressState>({
    x: 0,
    y: 0,
    smoothX: 0,
    smoothY: 0,
    pressure: 0,
    targetPressure: 0,
    drag: 0,
    pulse: 0,
    near: 0,
    scrolling: 0,
  });

  const { ref: visRef, visible } = useIsVisible<HTMLDivElement>("200px");
  useGlobalContactPointer(stressRef, hostRef, visible);
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

  const setRef = (el: HTMLDivElement | null) => {
    hostRef.current = el;
    visRef.current = el;
  };

  return (
    <div ref={setRef} className={className} style={{ touchAction: "none" }}>
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
        <ContactScene stressRef={stressRef} tier={tier} />
      </Canvas>
    </div>
  );
}
