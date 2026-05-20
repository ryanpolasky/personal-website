"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PerspectiveCamera,
  ContactShadows,
  Environment,
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

// hero scene: a compact set of polished objects with soft collisions, smooth
// pointer response, and controlled studio lighting.

// horizontal offset (in world units) applied to the whole cluster group so
// the cluster sits to one side of the hero text instead of directly behind
// it. positive = right, negative = left. tweak freely.
const CLUSTER_OFFSET_X = 3;

// depth offset (in world units). negative pushes the cluster further away
// from the camera, making it feel less claustrophobic. positive pulls it
// closer. tweak freely.
const CLUSTER_OFFSET_Z = -4;

type ShapeKind = "glyphR";
// 3 finishes × 3 colors = 9 distinct material identities. what separates the
// finishes is *how they reflect light*, not the color tint:
//   matte    - zero specular. fully rough surface, only diffuse shading.
//              reads like chalk, paper, unpolished plaster.
//   jelly    - wide soft specular. clearcoat layer with HIGH clearcoat
//              roughness so the highlight is a smudge, not a dot. reads like
//              gummy candy, silicone, rubber.
//   plastic  - narrow sharp specular. clearcoat with VERY low clearcoat
//              roughness so the highlight is a tight crisp dot. reads like
//              polished LEGO / molded ABS / a glossy phone case.
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
}

interface BodyState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  mass: number;
}

type PointerRef = { current: PointerState };
type BodiesRef = { current: BodyState[] };

// 16 hero pieces. order roughly alternates so neighboring instances rarely
// share a finish, keeping the cluster visually busy.
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
    mat: "blackPlastic",
    spinAxis: new THREE.Vector3(1, 0.5, 0.3).normalize(),
    spinSpeed: 0.09,
  },
  {
    position: [-0.08, -1.25, 0.48],
    rotation: [0.44, 0.12, 1.15],
    scale: 1.34,
    kind: "glyphR",
    mat: "whitePlastic",
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
];
const MEDIUM_SHAPES = SHAPES.slice(0, 13);
const LOW_SHAPES = SHAPES.slice(0, 10);

// build the (color × finish) material. each finish is driven primarily by
// specular behavior (roughness + clearcoatRoughness), not by color tinting.
// matte gets no specular at all, jelly gets wide smudgy highlights, plastic
// gets crisp pinpoint highlights - that's what makes them feel different
// under the studio lights.
function useMaterial(
  mat: MatKind,
  tier: PerformanceTier,
): THREE.MeshStandardMaterial {
  const accent = useAccent();
  return useMemo(() => {
    const [palette, finish] = mat.replace(/([A-Z])/g, " $1").split(" ") as [
      "white" | "black" | "accent",
      "Matte" | "Jelly" | "Plastic",
    ];

    // per-finish body colors. each finish gets a *slightly* different tint
    // within its color column so the viewer can read "matte vs jelly vs
    // plastic" from the body alone (warmer/chalkier for matte, creamier for
    // jelly, cooler/cleaner for plastic) - the highlight identity then
    // doubles down on it.
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
      // velvet/chalk. roughness pegged to 1.0 (env reflection fully blurred),
      // zero specular, zero clearcoat. heavy sheen with a tinted sheenColor
      // gives a soft halo on the silhouette - that's what reads as "this is
      // a fuzzy/papery thing" vs the next two finishes. accent matte gets a
      // faint pigment-style emissive so it doesn't go dead in shadow.
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
      // gummy candy / silicone. wide blurry clearcoat halo from a moderate
      // clearcoatRoughness (0.45) blurs the env reflection into a soft
      // smudge. transmission + thickness allows the studio HDRI to refract
      // through the volume, instantly selling it as a dense gummy/glass.
      // higher ior + sheen + emissive together simulate subsurface scatter.
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

    // Plastic - molded ABS / glossy phone case. clearcoatRoughness 0.02
    // keeps the env reflection razor-crisp. low base roughness so the
    // body is heavily glossed. black plastic gets slight metalness for a
    // lacquered-piano sheen. specularIntensity boosted so the pinpoint
    // highlight punches through.
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
  }, [mat, tier, accent.base, accent.warm, accent.soft]);
}

// procedural extruded R: a 2D shape with the letter outline plus a bowl-hole
// path, extruded with generous bevel so the front + back faces and the bowl
// rim all have chamfered edges that catch the studio lights. the stem has a
// vertical right edge and the leg slopes off the bowl-stem junction, so the
// negative space below the bowl reads as an asymmetric right triangle (an R)
// rather than a symmetric A-style counter. evaluated once at module scope and
// shared across every hero body.
function makeRGeometry(tier: PerformanceTier): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // outer outline, counterclockwise. coordinates live in a roughly
  // [-0.6, 0.6] x [-1.0, 1.0] box, normalized by geom.scale below.
  shape.moveTo(-0.6, 1.0); // top-left of stem
  shape.lineTo(-0.6, -1.0); // down the left edge of stem
  shape.lineTo(-0.35, -1.0); // along the bottom of the stem
  shape.lineTo(-0.35, 0.05); // STRAIGHT up the stem's right edge to the bowl-stem junction
  shape.lineTo(0.3, -1.0); // diagonal back down along the leg's inner edge
  shape.lineTo(0.6, -1.0); // along the bottom of the leg
  shape.lineTo(-0.05, 0.05); // up the leg's outer-right edge (parallel to the inner edge for uniform stroke width)
  // up the right side of the bowl, sweeping out to the right
  shape.bezierCurveTo(0.5, 0.05, 0.7, 0.4, 0.6, 0.66);
  // over the top of the bowl
  shape.bezierCurveTo(0.55, 0.92, 0.4, 1.0, 0.2, 1.0);
  shape.lineTo(-0.6, 1.0); // along the top back to start

  // bowl interior hole. clockwise (opposite winding from outer).
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
    bevelSegments: tier === "low" ? 2 : tier === "medium" ? 3 : 5,
    curveSegments: tier === "low" ? 8 : tier === "medium" ? 12 : 18,
    steps: 1,
  });

  // center on origin so rotation/physics pivot through the visual middle,
  // then normalize the longest axis to 1.55 like the old gltf fit math.
  geom.center();
  geom.computeBoundingBox();
  const size = geom.boundingBox!.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const norm = 1.55 / maxDim;
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
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // scroll gate: trackpad / wheel scrolling can fire micro pointermoves with
    // tiny dx/dy. those accumulate into ref.current.velocity which feeds the
    // cluster's push force, making the simulation react every time the user
    // scrolls. while a scroll is in flight we still update the pointer's
    // position (so smoothX/Y stay in sync with the real cursor) but skip the
    // velocity + move-delta accumulation that drives the kinetic push.
    let scrolling = false;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      scrolling = true;
      // also drop any velocity already accumulated this gesture so the cluster
      // doesn't continue coasting into a scroll.
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

    const onPointerDown = () => {
      ref.current.down = 1;
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
}: ShapeData & {
  index: number;
  bodiesRef: BodiesRef;
  pointerRef: PointerRef;
  tier: PerformanceTier;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const material = useMaterial(mat, tier);
  const accent = useAccent();
  // per-instance emissive cache so we lerp smoothly rather than snap.
  const glowRef = useRef(0);
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
    const pointerEnergy =
      pointer.active > 0.5 ? pointer.velocity + pointer.down * 0.35 : 0;
    g.rotateOnAxis(spinAxis, spinSpeed * step * (1 + pointerEnergy * 1.8));

    // proximity glow: ramp emissive when the pointer's world projection is
    // within ~1.4 units of this body. anchor (index 0) gets a more generous
    // radius so it leads when the cursor is anywhere near center.
    if (glowEnabled && body && baseEmissiveRef.current) {
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
      <GlyphRShape material={material} tier={tier} />
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
  // local time accumulator. only advances while useFrame actually runs, so
  // when the canvas pauses (scroll out of view) and resumes minutes later,
  // any sin(t)/cos(t)/linear-in-t targets driven by this clock don't jump
  // forward by the whole pause duration. avoids the "mach 20 catch-up" spin
  // that state.clock.elapsedTime produces when the wallclock keeps ticking
  // through a frameloop=never window.
  const timeRef = useRef(0);
  const shapes =
    tier === "low" ? LOW_SHAPES : tier === "medium" ? MEDIUM_SHAPES : SHAPES;
  const collisionPasses = tier === "high" ? 6 : tier === "medium" ? 3 : 0;

  if (bodiesRef.current.length !== shapes.length) {
    // tight bounding sphere derived from the extruded R geometry. fudge factor
    // < 1 because the R has empty space (the bowl hole, the V notch) so a
    // strict bounding sphere reads as 'bouncing off thin air'. tuning lower
    // lets neighbors overlap slightly which looks more natural for non-
    // spherical shapes.
    const sphereRadius = getRGeometry(tier).boundingSphere!.radius;
    bodiesRef.current = shapes.map((shape) => ({
      position: new THREE.Vector3(...shape.position),
      velocity: new THREE.Vector3(),
      radius: shape.scale * sphereRadius * 0.82,
      mass: 1.2 + shape.scale * 2.6,
    }));
  }

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;

    const pointer = pointerRef.current;
    const pointerActive = pointer.active > 0.5;
    const pointerX = pointerActive ? pointer.smoothX * 3.55 : 0;
    const pointerY = pointerActive ? pointer.smoothY * 2.75 : 0;
    const pointerZ = pointerActive ? 0.35 + pointer.down * 0.6 : 0;

    const bodies = bodiesRef.current;
    const step = Math.min(dt, 1 / 30);
    const damping = Math.exp(-3.55 * step);
    const spring = tier === "low" ? 0.62 : 0.82;
    const centerGravity = tier === "low" ? 6.6 : 8.8;
    const orbitalPull = tier === "low" ? 0.07 : 0.11;
    const pushForce = pointerActive
      ? (tier === "low" ? 0.56 : 0.82) +
        pointer.velocity * (tier === "low" ? 1.05 : 1.65) +
        pointer.down * (tier === "low" ? 0.5 : 0.8)
      : 0;

    for (let i = 0; i < bodies.length; i += 1) {
      const body = bodies[i];
      const shape = shapes[i];

      const springScale = spring / body.mass;
      body.velocity.x +=
        (shape.position[0] - body.position.x) * springScale * step;
      body.velocity.y +=
        (shape.position[1] - body.position.y) * springScale * step;
      body.velocity.z +=
        (shape.position[2] - body.position.z) * springScale * step;

      const cx = -body.position.x;
      const cy = -body.position.y;
      const cz = -body.position.z;
      const centerDistSq = cx * cx + cy * cy + cz * cz + 0.55;
      const centerInv = 1 / Math.sqrt(centerDistSq);
      const gravity = centerGravity / (centerDistSq * body.mass);

      body.velocity.x += cx * centerInv * gravity * step * 19;
      body.velocity.y += cy * centerInv * gravity * step * 19;
      body.velocity.z += cz * centerInv * gravity * step * 14;
      body.velocity.x += (-body.position.y * orbitalPull * step) / body.mass;
      body.velocity.y += (body.position.x * orbitalPull * step) / body.mass;

      const dx = body.position.x - pointerX;
      const dy = body.position.y - pointerY;
      const dz = body.position.z - pointerZ;
      const distSq = dx * dx + dy * dy + dz * dz + 0.18;
      const invDist = 1 / Math.sqrt(distSq);
      const push = pushForce / (distSq * body.mass);
      const wake = pointerActive ? Math.max(0, 1 - Math.sqrt(distSq) / 3.2) : 0;

      body.velocity.x += dx * invDist * push * step * 30;
      body.velocity.y += dy * invDist * push * step * 30;
      body.velocity.z += dz * invDist * push * step * 18;
      body.velocity.x += (pointer.moveX * wake * step * 12) / body.mass;
      body.velocity.y += (pointer.moveY * wake * step * 12) / body.mass;
      body.velocity.z +=
        ((Math.abs(pointer.moveX) + Math.abs(pointer.moveY)) *
          wake *
          step *
          2.2) /
        body.mass;

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

          const overlap = (minDist - dist) * 1.08;
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

          const restitution = 0.08;
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

    // advance our local time only by the clamped step. crucially this does
    // NOT use state.clock.elapsedTime, which jumps forward by the entire
    // pause duration whenever the frameloop resumes.
    timeRef.current += step;
    const t = timeRef.current;
    // idle drift: when pointer hasn't moved recently, slightly amplify the
    // ambient orbital motion so the cluster keeps breathing.
    const idleBoost = pointer.active < 0.5 ? 1.4 : 1.0;
    const targetRotX =
      Math.sin(t * 0.32) * 0.065 * idleBoost + pointer.smoothY * 0.16;
    const targetRotY = t * 0.08 * idleBoost + pointer.smoothX * 0.18;
    const targetRotZ = pointer.smoothX * 0.055 + pointer.velocity * 0.025;

    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetRotX, 5, step);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetRotY, 5, step);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, targetRotZ, 5, step);
    g.position.y = THREE.MathUtils.damp(
      g.position.y,
      Math.sin(t * 0.6) * 0.09 * idleBoost + pointer.smoothY * 0.06,
      4,
      step,
    );
    g.position.x = THREE.MathUtils.damp(
      g.position.x,
      CLUSTER_OFFSET_X + Math.cos(t * 0.35) * 0.06 * idleBoost,
      3,
      step,
    );
    g.position.z = THREE.MathUtils.damp(
      g.position.z,
      CLUSTER_OFFSET_Z,
      3,
      step,
    );
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
        />
      ))}
    </group>
  );
}

function HeroScene({ tier }: { tier: PerformanceTier }) {
  const accent = useAccent();
  const pointerRef = useViewportPointer();
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.08, 8.25]} fov={34} />

      <fog attach="fog" args={["#0B0B0F", 7.5, 16]} />

      {/* studio HDRI lights up the clearcoat layer of plastic + jelly with
          real environment reflections - without this, plastic looks dull
          and jelly's smudgy halo has nothing to reflect. matte is unaffected
          because its roughness=1 + zero specular skip the env contribution. */}
      {tier !== "low" && (
        <Environment
          preset="studio"
          environmentIntensity={tier === "medium" ? 0.55 : 0.75}
        />
      )}

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
      {tier === "high" && (
        <rectAreaLight
          position={[4.3, 1.0, 2.6]}
          rotation={[-0.18, 0.68, 0.0]}
          width={1.1}
          height={4.8}
          intensity={3.6}
          color="#FFFFFF"
        />
      )}
      <directionalLight position={[5, 6, 4]} intensity={0.85} color="#FFFFFF" />
      {tier !== "low" && (
        <directionalLight
          position={[-5, 3, 2]}
          intensity={0.4}
          color="#E7EBFF"
        />
      )}
      <directionalLight
        position={[0, -3, -5]}
        intensity={0.65}
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
      {tier === "high" && (
        <pointLight
          position={[3, 2, -2]}
          intensity={1.0}
          color={accent.warm}
          distance={8}
        />
      )}
      <ambientLight intensity={tier === "low" ? 0.24 : 0.12} />

      {tier === "high" && (
        <ContactShadows
          position={[0, -2.6, 0]}
          opacity={0.62}
          scale={14}
          blur={3.4}
          far={5}
          color="#000000"
        />
      )}

      <Cluster pointerRef={pointerRef} tier={tier} />
    </>
  );
}

export function HeroClusterView({ className }: { className?: string }) {
  const { ref, visible } = useIsVisible<HTMLDivElement>("1400px");
  const reduced = useReducedMotion();
  const tier = usePerformanceTier(reduced);
  const dpr = tierDpr(tier, 1.5, 1.1);
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
          gl.toneMappingExposure = 1.08;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        style={{ background: "transparent" }}
      >
        <HeroScene tier={tier} />
      </Canvas>
    </div>
  );
}
