"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PerspectiveCamera,
  Environment,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAccent } from "@/components/AccentProvider";
import {
  isAppleGPU,
  tierDpr,
  usePerformanceTier,
  type PerformanceTier,
} from "@/lib/performance";
import { useIsVisible, useReducedMotion } from "@/lib/scroll";

const CLUSTER_OFFSET_X = 2.5;

const CLUSTER_OFFSET_Z = -4;

const GLASS_INDICES = new Set<number>([0, 1, 2]);
const GLASS_THICKNESS = 0.35;
const GLASS_IOR = 1.5;
const GLASS_CHROMATIC_ABERRATION = 0.12;
const GLASS_ANISOTROPIC_BLUR = 0.1;
const GLASS_ATTENUATION_DISTANCE = 2.5;

type ShapeKind = "glyphR";
type MatKind =
  | "whiteMatte"
  | "whiteJelly"
  | "whitePlastic"
  | "blackMatte"
  | "blackJelly"
  | "blackPlastic"
  | "accentMatte"
  | "accentJelly"
  | "accentPlastic";

interface ShapeData {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  kind: ShapeKind;
  mat: MatKind;
  spinAxis: THREE.Vector3;
  spinSpeed: number;
}

interface PointerState {
  x: number;
  y: number;
  smoothX: number;
  smoothY: number;
  moveX: number;
  moveY: number;
  velocity: number;
  down: number;
  active: number;
  clicks: number;
}

interface BodyState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  mass: number;
}

type PointerRef = { current: PointerState };
type BodiesRef = { current: BodyState[] };

const SHAPES: ShapeData[] = [
  {
    position: [-1.65, 0.42, 0.35],
    rotation: [0.62, 0.44, 0.18],
    scale: 1.55,
    kind: "glyphR",
    mat: "whiteJelly",
    spinAxis: new THREE.Vector3(0.4, 1, 0.2).normalize(),
    spinSpeed: 0.08,
  },
  {
    position: [1.35, -0.22, 0.18],
    rotation: [0.24, 1.02, 0.7],
    scale: 1.48,
    kind: "glyphR",
    mat: "accentPlastic",
    spinAxis: new THREE.Vector3(0.7, 0.4, 1).normalize(),
    spinSpeed: -0.12,
  },
  {
    position: [0.05, 1.15, -0.35],
    rotation: [1.1, 0.35, 0.42],
    scale: 1.38,
    kind: "glyphR",
    mat: "accentJelly",
    spinAxis: new THREE.Vector3(1, 0.5, 0.3).normalize(),
    spinSpeed: 0.09,
  },
  {
    position: [-0.08, -1.25, 0.48],
    rotation: [0.44, 0.12, 1.15],
    scale: 1.34,
    kind: "glyphR",
    mat: "accentPlastic",
    spinAxis: new THREE.Vector3(0.2, 1, 0.6).normalize(),
    spinSpeed: -0.1,
  },
  {
    position: [2.25, 0.9, -0.42],
    rotation: [0.2, 1.1, -0.4],
    scale: 1.26,
    kind: "glyphR",
    mat: "accentJelly",
    spinAxis: new THREE.Vector3(1, 0.2, 0.8).normalize(),
    spinSpeed: -0.13,
  },
  {
    position: [-2.35, -1.0, -0.18],
    rotation: [1.2, -0.6, 0.3],
    scale: 1.22,
    kind: "glyphR",
    mat: "blackMatte",
    spinAxis: new THREE.Vector3(0.2, 1, 0.6).normalize(),
    spinSpeed: 0.16,
  },
  {
    position: [2.75, -0.84, 0.48],
    rotation: [-0.8, 0.3, 0.6],
    scale: 1.15,
    kind: "glyphR",
    mat: "whiteMatte",
    spinAxis: new THREE.Vector3(0.6, 0.8, 1).normalize(),
    spinSpeed: -0.18,
  },
  {
    position: [-2.95, 0.7, 0.72],
    rotation: [0.3, -0.9, 1.2],
    scale: 1.12,
    kind: "glyphR",
    mat: "accentMatte",
    spinAxis: new THREE.Vector3(0.8, 0.3, 1).normalize(),
    spinSpeed: 0.14,
  },
  {
    position: [0.55, 2.25, 0.55],
    rotation: [0.5, 1.3, -0.1],
    scale: 1.08,
    kind: "glyphR",
    mat: "blackJelly",
    spinAxis: new THREE.Vector3(1, 0.7, 0.5).normalize(),
    spinSpeed: -0.18,
  },
  {
    position: [-0.55, -2.35, -0.55],
    rotation: [-1.1, 0.6, 0.8],
    scale: 1.05,
    kind: "glyphR",
    mat: "whiteJelly",
    spinAxis: new THREE.Vector3(0.4, 1, 0.7).normalize(),
    spinSpeed: 0.16,
  },
  {
    position: [1.9, 1.9, 0.82],
    rotation: [0.1, 0.7, 0.9],
    scale: 1.0,
    kind: "glyphR",
    mat: "accentPlastic",
    spinAxis: new THREE.Vector3(0.7, 1, 0.2).normalize(),
    spinSpeed: -0.2,
  },
  {
    position: [-1.92, -1.9, 0.88],
    rotation: [0.8, 0.6, -0.3],
    scale: 0.98,
    kind: "glyphR",
    mat: "whitePlastic",
    spinAxis: new THREE.Vector3(1, 0.3, 0.7).normalize(),
    spinSpeed: 0.18,
  },
  {
    position: [3.05, 0.1, -0.85],
    rotation: [-0.5, 0.4, 0.2],
    scale: 0.95,
    kind: "glyphR",
    mat: "blackPlastic",
    spinAxis: new THREE.Vector3(0.5, 0.4, 1).normalize(),
    spinSpeed: -0.18,
  },
  {
    position: [0.95, -2.75, 0.82],
    rotation: [-0.8, 0.1, 0.9],
    scale: 0.9,
    kind: "glyphR",
    mat: "accentJelly",
    spinAxis: new THREE.Vector3(0.7, 0.3, 1).normalize(),
    spinSpeed: -0.19,
  },
  {
    position: [-1.02, 2.82, -0.84],
    rotation: [0.2, 0.8, -0.2],
    scale: 0.88,
    kind: "glyphR",
    mat: "blackMatte",
    spinAxis: new THREE.Vector3(1, 0.4, 0.4).normalize(),
    spinSpeed: 0.18,
  },
  {
    position: [-2.25, 2.15, 0.35],
    rotation: [-0.2, 1.2, 0.4],
    scale: 0.84,
    kind: "glyphR",
    mat: "accentMatte",
    spinAxis: new THREE.Vector3(0.8, 0.2, 1).normalize(),
    spinSpeed: 0.21,
  },
  // extra fill for a busier cluster. high tier only (slices below drop these).
  {
    position: [1.95, 1.4, 0.55],
    rotation: [0.3, -0.7, 0.5],
    scale: 0.9,
    kind: "glyphR",
    mat: "accentPlastic",
    spinAxis: new THREE.Vector3(0.6, 0.5, 1).normalize(),
    spinSpeed: -0.16,
  },
  {
    position: [-1.5, 1.55, 0.42],
    rotation: [0.7, 0.4, -0.5],
    scale: 0.85,
    kind: "glyphR",
    mat: "whitePlastic",
    spinAxis: new THREE.Vector3(1, 0.6, 0.4).normalize(),
    spinSpeed: 0.18,
  },
  {
    position: [1.65, -1.6, -0.35],
    rotation: [-0.4, 0.9, 0.3],
    scale: 0.88,
    kind: "glyphR",
    mat: "blackPlastic",
    spinAxis: new THREE.Vector3(0.5, 1, 0.3).normalize(),
    spinSpeed: 0.2,
  },
];
const MEDIUM_SHAPES = SHAPES.slice(0, 13);
const LOW_SHAPES = SHAPES.slice(0, 8);

type Palette = "white" | "black" | "accent";
type Finish = "Matte" | "Jelly" | "Plastic";

function parseMat(mat: MatKind): [Palette, Finish] {
  return mat.replace(/([A-Z])/g, " $1").split(" ") as [Palette, Finish];
}

const ACCENT_SURFACE_MIX: Record<Finish, number> = {
  Matte: 0.2,
  Jelly: 0.45,
  Plastic: 0,
};

const tintScratch = new THREE.Color();

// only the accent palette tracks the live accent, so recolor in place instead
// of rebuilding. disposing a material destroys its compiled program, and
// windows/angle stalls for hundreds of ms re-translating these shaders.
function applyAccentTint(
  material: THREE.MeshStandardMaterial,
  palette: Palette,
  finish: Finish,
  tier: PerformanceTier,
  accent: { base: string; warm: string; soft: string },
) {
  if (palette !== "accent") return;
  material.color.set(accent.base);
  const mix = ACCENT_SURFACE_MIX[finish];
  if (mix > 0) material.color.lerp(tintScratch.set(accent.soft), mix);
  material.emissive.set(
    tier !== "low" && finish === "Jelly" ? accent.warm : accent.base,
  );
  const physical = material as THREE.MeshPhysicalMaterial;
  if (tier !== "low" && finish !== "Plastic" && physical.sheenColor) {
    physical.sheenColor.set(accent.warm);
  }
}

function useMaterial(
  mat: MatKind,
  tier: PerformanceTier,
): THREE.MeshStandardMaterial {
  const liveAccent = useAccent();
  const accentRef = useRef(liveAccent);
  accentRef.current = liveAccent;
  const [palette, finish] = useMemo(() => parseMat(mat), [mat]);

  const material = useMemo(() => {
    // seeded from the accent at build time; applyAccentTint owns it after that.
    const accent = accentRef.current;
    const [palette, finish] = parseMat(mat);

    const colorMap: Record<typeof palette, Record<typeof finish, string>> = {
      white: {
        Matte: "#E0DDD3", // chalky beige-white, soaks up light
        Jelly: "#F2EEE2", // warm cream, looks edible
        Plastic: "#F7F7F5", // bright cool off-white, lacquered
      },
      black: {
        Matte: "#151515", // deep pure charcoal, no blue
        Jelly: "#181716", // warm dark amber, hints at translucency
        Plastic: "#050505", // absolute obsidian black, glossy
      },
      accent: {
        // somewhere between bright and pastel
        Matte:
          "#" +
          new THREE.Color(accent.base)
            .lerp(new THREE.Color(accent.soft), 0.2)
            .getHexString(),
        // pastel / washed out
        Jelly:
          "#" +
          new THREE.Color(accent.base)
            .lerp(new THREE.Color(accent.soft), 0.45)
            .getHexString(),
        // brightest
        Plastic: accent.base,
      },
    };

    if (tier === "low") {
      return new THREE.MeshStandardMaterial({
        color: colorMap[palette][finish],
        roughness:
          finish === "Plastic" ? 0.34 : finish === "Jelly" ? 0.52 : 0.9,
        metalness: finish === "Plastic" && palette === "black" ? 0.08 : 0,
        emissive:
          palette === "accent"
            ? new THREE.Color(accent.base)
            : finish === "Jelly"
              ? new THREE.Color(palette === "black" ? "#221B17" : "#FFF0D8")
              : new THREE.Color("#000000"),
        emissiveIntensity:
          palette === "accent" ? 0.08 : finish === "Jelly" ? 0.04 : 0,
        flatShading: false,
      });
    }

    if (finish === "Matte") {
      return new THREE.MeshPhysicalMaterial({
        color: colorMap[palette].Matte,
        roughness: 1.0,
        metalness: 0,
        clearcoat: 0,
        specularIntensity: 0.05,
        sheen: 1.0,
        sheenRoughness: 0.95,
        sheenColor:
          palette === "accent"
            ? new THREE.Color(accent.warm)
            : palette === "white"
              ? new THREE.Color("#FFFFFF")
              : new THREE.Color("#333333"), // pure neutral dark grey
        emissive:
          palette === "accent"
            ? new THREE.Color(accent.base)
            : new THREE.Color("#000000"),
        emissiveIntensity: palette === "accent" ? 0.05 : 0,
        flatShading: false,
      });
    }

    if (finish === "Jelly") {
      return new THREE.MeshPhysicalMaterial({
        color: colorMap[palette].Jelly,
        roughness: tier === "medium" ? 0.46 : 0.35,
        metalness: 0,
        clearcoat: tier === "medium" ? 0.65 : 1.0,
        clearcoatRoughness: tier === "medium" ? 0.58 : 0.45,
        ior: 1.5,
        transmission: tier === "medium" ? 0 : 0.15,
        thickness: tier === "medium" ? 0 : 2.0,
        sheen: tier === "medium" ? 0.35 : 0.7,
        sheenRoughness: tier === "medium" ? 0.62 : 0.5,
        sheenColor:
          palette === "accent"
            ? new THREE.Color(accent.warm)
            : palette === "white"
              ? new THREE.Color("#FFEDD6")
              : new THREE.Color("#403833"), // warm grey, no purple
        emissive:
          palette === "accent"
            ? new THREE.Color(accent.warm)
            : palette === "black"
              ? new THREE.Color("#2A221E") // amber/warm glow instead of purple
              : new THREE.Color("#FFEDD6"),
        emissiveIntensity:
          palette === "accent" ? 0.25 : palette === "black" ? 0.1 : 0.1,
        flatShading: false,
      });
    }

    return new THREE.MeshPhysicalMaterial({
      color: colorMap[palette].Plastic,
      roughness: tier === "medium" ? 0.2 : 0.1,
      metalness: palette === "black" ? 0.1 : 0.0,
      clearcoat: tier === "medium" ? 0.65 : 1.0,
      clearcoatRoughness: tier === "medium" ? 0.08 : 0.02,
      ior: 1.6,
      specularIntensity: tier === "medium" ? 1.1 : 2.0,
      specularColor: new THREE.Color("#FFFFFF"),
      emissive:
        palette === "accent"
          ? new THREE.Color(accent.base)
          : new THREE.Color("#000000"),
      emissiveIntensity: palette === "accent" ? 0.1 : 0,
      flatShading: false,
    });
  }, [mat, tier]);

  // recolor the live material rather than letting the accent rebuild it.
  useEffect(() => {
    applyAccentTint(material, palette, finish, tier, liveAccent);
  }, [material, palette, finish, tier, liveAccent]);

  // dispose the outgoing material on tier change or unmount (r3f won't,
  // it's passed by prop not as a child).
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

function makeRGeometry(tier: PerformanceTier): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, 1.0); // top-left of stem
  shape.lineTo(-0.6, -1.0); // down the left edge of stem
  shape.lineTo(-0.35, -1.0); // along the bottom of the stem
  shape.lineTo(-0.35, 0.05); // STRAIGHT up the stem's right edge to the bowl-stem junction
  shape.lineTo(0.3, -1.0); // diagonal back down along the leg's inner edge
  shape.lineTo(0.6, -1.0); // along the bottom of the leg
  shape.lineTo(-0.05, 0.05); // up the leg's outer-right edge (parallel to the inner edge for uniform stroke width)
  shape.bezierCurveTo(0.5, 0.05, 0.7, 0.4, 0.6, 0.66);
  shape.bezierCurveTo(0.55, 0.92, 0.4, 1.0, 0.2, 1.0);
  shape.lineTo(-0.6, 1.0); // along the top back to start

  const hole = new THREE.Path();
  hole.moveTo(-0.32, 0.8);
  hole.lineTo(0.16, 0.8);
  hole.bezierCurveTo(0.4, 0.78, 0.45, 0.5, 0.16, 0.22);
  hole.lineTo(-0.32, 0.22);
  hole.lineTo(-0.32, 0.8);
  shape.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.46,
    bevelEnabled: true,
    bevelThickness: 0.085,
    bevelSize: 0.055,
    bevelOffset: 0,
    bevelSegments: tier === "low" ? 2 : tier === "medium" ? 4 : 7,
    curveSegments: tier === "low" ? 10 : tier === "medium" ? 16 : 26,
    steps: 1,
  });

  geom.center();
  geom.computeBoundingBox();
  const size = geom.boundingBox!.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const norm = 1.75 / maxDim;
  geom.scale(norm, norm, norm);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

// evaluated lazily but only once. all hero R instances share this geometry.
const _rGeometry: Partial<Record<PerformanceTier, THREE.ExtrudeGeometry>> = {};
function getRGeometry(tier: PerformanceTier = "high"): THREE.ExtrudeGeometry {
  if (!_rGeometry[tier]) _rGeometry[tier] = makeRGeometry(tier);
  return _rGeometry[tier]!;
}

function GlyphRShape({
  material,
  tier,
}: {
  material: THREE.MeshStandardMaterial;
  tier: PerformanceTier;
}) {
  const geometry = getRGeometry(tier);
  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

function GlassGlyphR({ tier }: { tier: PerformanceTier }) {
  const accent = useAccent();
  const geometry = getRGeometry(tier);
  const apple = isAppleGPU();
  const samples = tier === "high" ? (apple ? 6 : 9) : tier === "medium" ? 6 : 4;
  const resolution =
    tier === "high" ? (apple ? 192 : 256) : tier === "medium" ? 192 : 128;
  return (
    <mesh geometry={geometry} castShadow={false} receiveShadow={false}>
      <MeshTransmissionMaterial
        samples={samples}
        resolution={resolution}
        thickness={GLASS_THICKNESS}
        roughness={0}
        ior={GLASS_IOR}
        chromaticAberration={GLASS_CHROMATIC_ABERRATION}
        anisotropicBlur={GLASS_ANISOTROPIC_BLUR}
        clearcoat={1}
        clearcoatRoughness={0.1}
        attenuationColor={accent.warm}
        attenuationDistance={GLASS_ATTENUATION_DISTANCE}
      />
    </mesh>
  );
}

function useViewportPointer() {
  const ref = useRef<PointerState>({
    x: 0,
    y: 0,
    smoothX: 0,
    smoothY: 0,
    moveX: 0,
    moveY: 0,
    velocity: 0,
    down: 0,
    active: 0,
    clicks: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let scrolling = false;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      scrolling = true;
      ref.current.velocity = 0;
      ref.current.moveX = 0;
      ref.current.moveY = 0;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        scrolling = false;
      }, 140);
    };

    const onPointerMove = (e: PointerEvent) => {
      const nextX = (e.clientX / window.innerWidth) * 2 - 1;
      const nextY = -((e.clientY / window.innerHeight) * 2 - 1);
      const dx = nextX - ref.current.x;
      const dy = nextY - ref.current.y;
      ref.current.x = THREE.MathUtils.clamp(nextX, -1, 1);
      ref.current.y = THREE.MathUtils.clamp(nextY, -1, 1);
      ref.current.active = 1;
      if (scrolling) return;
      ref.current.moveX = THREE.MathUtils.clamp(
        ref.current.moveX + dx * 2.4,
        -2.4,
        2.4,
      );
      ref.current.moveY = THREE.MathUtils.clamp(
        ref.current.moveY + dy * 2.4,
        -2.4,
        2.4,
      );
      ref.current.velocity = Math.min(
        3.2,
        ref.current.velocity + Math.hypot(dx, dy) * 9.5,
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      const nextX = (e.clientX / window.innerWidth) * 2 - 1;
      const nextY = -((e.clientY / window.innerHeight) * 2 - 1);
      ref.current.x = THREE.MathUtils.clamp(nextX, -1, 1);
      ref.current.y = THREE.MathUtils.clamp(nextY, -1, 1);
      ref.current.active = 1;
      ref.current.down = 1;
      ref.current.clicks += 1;
    };

    const onPointerUp = () => {
      ref.current.down = 0;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("blur", onPointerUp);

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
    };
  }, []);

  useFrame((_state, dt) => {
    const p = ref.current;
    p.smoothX = THREE.MathUtils.damp(p.smoothX, p.x, 7, dt);
    p.smoothY = THREE.MathUtils.damp(p.smoothY, p.y, 7, dt);
    p.moveX = THREE.MathUtils.damp(p.moveX, 0, 7, dt);
    p.moveY = THREE.MathUtils.damp(p.moveY, 0, 7, dt);
    p.velocity = THREE.MathUtils.damp(p.velocity, 0, 2.6, dt);
    if (p.active < 0.5) {
      p.smoothX = THREE.MathUtils.damp(p.smoothX, 0, 6, dt);
      p.smoothY = THREE.MathUtils.damp(p.smoothY, 0, 6, dt);
    }
  });

  return ref;
}

function Shape({
  index,
  bodiesRef,
  pointerRef,
  position,
  rotation,
  scale,
  mat,
  spinAxis,
  spinSpeed,
  tier,
  glass,
}: ShapeData & {
  index: number;
  bodiesRef: BodiesRef;
  pointerRef: PointerRef;
  tier: PerformanceTier;
  glass?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const material = useMaterial(mat, tier);
  const accent = useAccent();
  // per-instance emissive cache so we lerp smoothly rather than snap.
  const glowRef = useRef(0);
  const spinBoostRef = useRef(0);
  const lastClickRef = useRef(0);
  // snapshot of the material's idle emissive identity - the proximity glow
  // ADDS to this instead of replacing it, so each finish keeps its unique
  // base emissive tone (jelly subsurface cream, matte pigment, plastic
  // accent wash) even when no pointer is near.
  const baseEmissiveRef = useRef<{
    color: THREE.Color;
    intensity: number;
  } | null>(null);
  const scratchColor = useRef(new THREE.Color()).current;
  if (baseEmissiveRef.current === null) {
    baseEmissiveRef.current = {
      color: material.emissive.clone(),
      intensity: material.emissiveIntensity,
    };
  }
  const glowEnabled = tier !== "low";
  const isGlass = !!glass;

  useFrame((_state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    // clamp dt so a long frameloop pause (user scrolled away for a while)
    // doesn't apply one giant rotation step the moment the canvas resumes.
    const step = Math.min(dt, 1 / 30);
    const body = bodiesRef.current[index];
    if (body) {
      g.position.copy(body.position);
    }
    const pointer = pointerRef.current;
    // each click gives every R a quick spin that decays back to its idle rate.
    if (pointer.clicks !== lastClickRef.current) {
      lastClickRef.current = pointer.clicks;
      spinBoostRef.current = 1;
    }
    spinBoostRef.current = Math.max(0, spinBoostRef.current - step * 1.6);
    const pointerEnergy =
      pointer.active > 0.5 ? pointer.velocity + pointer.down * 0.35 : 0;
    g.rotateOnAxis(
      spinAxis,
      spinSpeed * step * (isGlass ? 1.4 : 1) * (1 + pointerEnergy * 1.8) +
        Math.sign(spinSpeed) * spinBoostRef.current * 16 * step,
    );

    // proximity glow: ramp emissive when the pointer's world projection is
    // within ~1.4 units of this body. anchor (index 0) gets a more generous
    // radius so it leads when the cursor is anywhere near center.
    if (glowEnabled && !isGlass && body && baseEmissiveRef.current) {
      const base = baseEmissiveRef.current;
      const px = pointer.active > 0.5 ? pointer.smoothX * 3.4 : 0;
      const py = pointer.active > 0.5 ? pointer.smoothY * 2.5 : 0;
      const dx = body.position.x - px;
      const dy = body.position.y - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      const radius = index === 0 ? 2.6 : 1.4;
      const proximity = pointer.active > 0.5 ? Math.max(0, 1 - d / radius) : 0;
      // anchor stays subtle; supporting shapes can flare brighter.
      const targetGlow =
        (index === 0 ? 0.18 : 0.55) * proximity +
        pointer.down * (index === 0 ? 0.06 : 0.18) * proximity;
      glowRef.current = THREE.MathUtils.damp(
        glowRef.current,
        targetGlow,
        6,
        step,
      );

      // emissive intensity = base (preserves the finish's idle identity) +
      // glow contribution (boosts on pointer proximity).
      material.emissiveIntensity = base.intensity + glowRef.current;

      // for the glow color: keep the material's own emissive when idle, then
      // blend toward a finish-aware accent on hover so white/black pieces
      // don't look black-glowing.
      if (glowRef.current > 0.005) {
        const blend = THREE.MathUtils.clamp(glowRef.current / 0.55, 0, 1);
        if (mat.startsWith("white")) {
          scratchColor.set(accent.warm);
        } else if (mat.startsWith("black")) {
          scratchColor.set("#2A2522"); // warm amber glow instead of purple/blue
        } else {
          scratchColor.copy(base.color);
        }
        material.emissive.copy(base.color).lerp(scratchColor, blend);
      } else {
        material.emissive.copy(base.color);
      }
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {isGlass ? (
        <GlassGlyphR tier={tier} />
      ) : (
        <GlyphRShape material={material} tier={tier} />
      )}
    </group>
  );
}

function Cluster({
  pointerRef,
  tier,
}: {
  pointerRef: PointerRef;
  tier: PerformanceTier;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodiesRef = useRef<BodyState[]>([]);
  const timeRef = useRef(0);
  const attractorRef = useRef(new THREE.Vector3(0, 0, 0.35));
  const spinRef = useRef({ y: 0 });
  const shapes =
    tier === "low" ? LOW_SHAPES : tier === "medium" ? MEDIUM_SHAPES : SHAPES;
  const collisionPasses = tier === "high" ? 6 : tier === "medium" ? 3 : 2;

  if (bodiesRef.current.length !== shapes.length) {
    const sphereRadius = getRGeometry("high").boundingSphere!.radius;
    bodiesRef.current = shapes.map((shape, i) => {
      const base = 1.2 + shape.scale * 2.6;
      return {
        position: new THREE.Vector3(...shape.position),
        velocity: new THREE.Vector3(),
        radius: shape.scale * sphereRadius * 1,
        mass: GLASS_INDICES.has(i) ? base * 2 : base,
      };
    });
  }

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;

    const pointer = pointerRef.current;
    g.updateMatrixWorld();

    const bodies = bodiesRef.current;

    const step = Math.min(dt, 1 / 30);
    timeRef.current += step;
    const t = timeRef.current;
    const damping = Math.exp(-3.55 * step);

    // attractor stays gently centered so the swarm keeps its place; the cursor
    // spins the whole mass instead of dragging it off-center (see rotation).
    const attractor = attractorRef.current;
    const ax = Math.sin(t * 0.3) * 0.25;
    const ay = Math.cos(t * 0.22) * 0.08;
    const az = 0.35 + Math.sin(t * 0.18) * 0.35;
    attractor.x = THREE.MathUtils.damp(attractor.x, ax, 6, step);
    attractor.y = THREE.MathUtils.damp(attractor.y, ay, 6, step);
    attractor.z = THREE.MathUtils.damp(attractor.z, az, 6, step);

    const pull = tier === "low" ? 2.2 : tier === "medium" ? 2.8 : 3.2;

    for (let i = 0; i < bodies.length; i += 1) {
      const body = bodies[i];
      const shape = shapes[i];

      // spring toward the attractor. glass (heavier) lags, matte darts ahead.
      const pullScale = (pull / body.mass) * step;
      body.velocity.x += (attractor.x - body.position.x) * pullScale;
      body.velocity.y += (attractor.y - body.position.y) * pullScale;
      body.velocity.z += (attractor.z - body.position.z) * pullScale;

      body.velocity.multiplyScalar(damping);
      body.position.addScaledVector(body.velocity, step * 4.9);

      const limitX = 3.45 + shape.scale * 0.24;
      const limitY = 2.72 + shape.scale * 0.24;
      const limitZ = 2.05;

      if (body.position.x > limitX) {
        body.position.x = limitX;
        body.velocity.x *= -0.26;
      } else if (body.position.x < -limitX) {
        body.position.x = -limitX;
        body.velocity.x *= -0.26;
      }

      if (body.position.y > limitY) {
        body.position.y = limitY;
        body.velocity.y *= -0.26;
      } else if (body.position.y < -limitY) {
        body.position.y = -limitY;
        body.velocity.y *= -0.26;
      }

      if (body.position.z > limitZ) {
        body.position.z = limitZ;
        body.velocity.z *= -0.26;
      } else if (body.position.z < -limitZ) {
        body.position.z = -limitZ;
        body.velocity.z *= -0.26;
      }
    }

    for (let pass = 0; pass < collisionPasses; pass += 1) {
      for (let i = 0; i < bodies.length; i += 1) {
        const a = bodies[i];
        for (let j = i + 1; j < bodies.length; j += 1) {
          const b = bodies[j];
          const minDist = a.radius + b.radius;

          let nx = b.position.x - a.position.x;
          let ny = b.position.y - a.position.y;
          let nz = b.position.z - a.position.z;
          const distSq = nx * nx + ny * ny + nz * nz;
          const dist = Math.sqrt(Math.max(distSq, 0.0001));

          if (dist >= minDist) continue;

          nx /= dist;
          ny /= dist;
          nz /= dist;

          // firm-but-under-1 correction plus a little slop: resolves overlap
          // without the old 1.08 factor's jitter.
          const overlap = Math.max(0, minDist - dist - 0.012) * 0.85;
          const totalMass = a.mass + b.mass;
          const aShare = b.mass / totalMass;
          const bShare = a.mass / totalMass;

          a.position.x -= nx * overlap * aShare;
          a.position.y -= ny * overlap * aShare;
          a.position.z -= nz * overlap * aShare;
          b.position.x += nx * overlap * bShare;
          b.position.y += ny * overlap * bShare;
          b.position.z += nz * overlap * bShare;

          const rvx = b.velocity.x - a.velocity.x;
          const rvy = b.velocity.y - a.velocity.y;
          const rvz = b.velocity.z - a.velocity.z;
          const separatingVelocity = rvx * nx + rvy * ny + rvz * nz;

          if (separatingVelocity >= 0) continue;

          const restitution = 0.05;
          const impulse =
            (-(1 + restitution) * separatingVelocity) /
            (1 / a.mass + 1 / b.mass);

          a.velocity.x -= (nx * impulse) / a.mass;
          a.velocity.y -= (ny * impulse) / a.mass;
          a.velocity.z -= (nz * impulse) / a.mass;
          b.velocity.x += (nx * impulse) / b.mass;
          b.velocity.y += (ny * impulse) / b.mass;
          b.velocity.z += (nz * impulse) / b.mass;
        }
      }
    }

    let meanX = 0;
    let meanY = 0;
    for (let i = 0; i < bodies.length; i += 1) {
      meanX += bodies[i].position.x;
      meanY += bodies[i].position.y;
    }
    meanX = (meanX / bodies.length) * 0.12;
    meanY = (meanY / bodies.length) * 0.12;
    for (let i = 0; i < bodies.length; i += 1) {
      bodies[i].position.x -= meanX;
      bodies[i].position.y -= meanY;
    }

    const spin = spinRef.current;
    spin.y = THREE.MathUtils.damp(spin.y, pointer.moveX * 0.9 + 0.06, 2, step);
    g.rotation.y += spin.y * step;

    const targetRotX = pointer.smoothY * 0.35 + Math.sin(t * 0.12) * 0.05;
    const targetRotZ = pointer.smoothX * 0.05 + pointer.velocity * 0.02;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetRotX, 4, step);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, targetRotZ, 4, step);
    const aspect = state.size.width / Math.max(1, state.size.height);
    const narrowPull = aspect >= 1.3 ? 0 : (1.3 - Math.max(0.5, aspect)) * 4.5;
    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      (tier === "low" ? 11.5 : 8.25) + narrowPull,
      3,
      step,
    );
    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = THREE.MathUtils.damp(
        fog.near,
        (tier === "low" ? 10.75 : 7.5) + narrowPull,
        3,
        step,
      );
      fog.far = THREE.MathUtils.damp(
        fog.far,
        (tier === "low" ? 19.25 : 16) + narrowPull,
        3,
        step,
      );
    }
    const yOffset = Math.max(0, 0.6 - aspect) * 10;
    const targetX = aspect >= 1.3 ? CLUSTER_OFFSET_X : 0;
    g.position.y = THREE.MathUtils.damp(
      g.position.y,
      yOffset + Math.sin(t * 0.4) * 0.015,
      4,
      step,
    );
    g.position.x = THREE.MathUtils.damp(g.position.x, targetX, 3, step);
    g.position.z = THREE.MathUtils.damp(g.position.z, CLUSTER_OFFSET_Z, 3, step);
  });

  return (
    <group ref={groupRef}>
      {shapes.map((s, i) => (
        <Shape
          key={i}
          {...s}
          index={i}
          bodiesRef={bodiesRef}
          pointerRef={pointerRef}
          tier={tier}
          glass={GLASS_INDICES.has(i)}
        />
      ))}
    </group>
  );
}

function ReadySignal() {
  const n = useRef(0);
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    n.current += 1;
    if (n.current < 4) return;
    fired.current = true;
    (window as Window & { __heroReady?: boolean }).__heroReady = true;
    window.dispatchEvent(new Event("hero:ready"));
  });
  return null;
}

function HeroScene({ tier }: { tier: PerformanceTier }) {
  const accent = useAccent();
  const apple = isAppleGPU();
  const pointerRef = useViewportPointer();
  return (
    <>
      <ReadySignal />
      <PerspectiveCamera
        makeDefault
        position={[0, 0.08, tier === "low" ? 11.5 : 8.25]}
        fov={34}
      />

      <fog
        attach="fog"
        args={[
          "#0B0B0F",
          tier === "low" ? 10.75 : 7.5,
          tier === "low" ? 19.25 : 16,
        ]}
      />

      <Environment
        preset="studio"
        resolution={tier === "low" ? 64 : apple ? 128 : undefined}
        environmentIntensity={
          tier === "low" ? 0.6 : tier === "medium" ? 0.55 : 0.75
        }
      />

      {tier !== "low" && (
        <rectAreaLight
          position={[-4.2, 4.3, 5.2]}
          rotation={[-0.72, -0.58, 0.04]}
          width={5.8}
          height={2.2}
          intensity={tier === "medium" ? 4.8 : 6.4}
          color="#FFFFFF"
        />
      )}
      {tier === "high" && !apple && (
        <rectAreaLight
          position={[4.3, 1.0, 2.6]}
          rotation={[-0.18, 0.68, 0.0]}
          width={1.1}
          height={4.8}
          intensity={3.6}
          color="#FFFFFF"
        />
      )}
      <directionalLight
        position={[5, 6, 4]}
        intensity={tier === "low" ? 1.55 : 0.85}
        color="#FFFFFF"
      />
      <directionalLight
        position={[-5, 3, 2]}
        intensity={tier === "low" ? 0.95 : 0.4}
        color="#E7EBFF"
      />
      <directionalLight
        position={[0, -3, -5]}
        intensity={tier === "low" ? 0.95 : 0.65}
        color={accent.warm}
      />
      {tier !== "low" && (
        <pointLight
          position={[-3, -2, 3]}
          intensity={1.5}
          color={accent.base}
          distance={9}
        />
      )}
      {tier === "high" && !apple && (
        <pointLight
          position={[3, 2, -2]}
          intensity={1.0}
          color={accent.warm}
          distance={8}
        />
      )}
      <ambientLight intensity={tier === "low" ? 0.6 : 0.12} />

      <Cluster pointerRef={pointerRef} tier={tier} />
    </>
  );
}

export function HeroClusterView({ className }: { className?: string }) {
  const { ref, visible } = useIsVisible<HTMLDivElement>("1400px");
  const reduced = useReducedMotion();
  const tier = usePerformanceTier(reduced, visible);
  const apple = isAppleGPU();
  const dpr = tierDpr(tier, apple ? 1.25 : 1.5, 1.1);
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
        resize={{ scroll: false }}
        gl={{
          antialias: tier === "high" && !apple,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = tier === "low" ? 1.25 : 1.08;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        style={{ background: "transparent" }}
      >
        <HeroScene tier={tier} />
      </Canvas>
    </div>
  );
}
