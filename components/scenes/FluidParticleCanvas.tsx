"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PerformanceTier } from "@/lib/performance";

// fluid particle canvas - heavy three.js half of FluidParticleBand, dynamic-imported.

// particle count + substep budget scale with perf tier. counts are tuned so
// the settled pile fills a little under half the section height per device
// class: mobile/low gets ~280 - enough to clear the sparse ~1/3 fill without
// the wallpaper-of-confetti effect at full desktop density.
function tierParticleCount(tier: PerformanceTier): number {
  if (tier === "high") return 900;
  if (tier === "medium") return 620;
  return 280;
}
function tierSubsteps(tier: PerformanceTier): number {
  if (tier === "high") return 6;
  if (tier === "medium") return 5;
  // 5 substeps minimum to prevent particle "boiling" and jittering.
  // 3 was too low for the pressure solver to find equilibrium.
  return 5;
}
const CELL_SIZE = 0.35;
const GRAVITY = 20;
const FRICTION = 0.995;
const FLOOR_FRICTION = 0.9;
const MAX_CURSOR_SPEED = 30.0;
const MAX_PARTICLE_STEP = 0.15;

const PRESSURE_RADIUS = 0.42;
const REST_DENSITY = 2.15;
const PRESSURE_STRENGTH = 0.018;
const MAX_PRESSURE_PUSH = 0.008;

const SEPARATION_PADDING = 0.1;

type Shape = 0 | 1 | 2 | 3; // 0 square, 1 circle, 2 plus, 3 x

interface Particle {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  rot: number;
  r: number; // collision radius in world units
  shape: Shape;
  scale: number; // visual size multiplier
}

// PointerState: shared between parent's window pointer wiring and canvas useFrame.
export interface PointerState {
  nx: number;
  ny: number;
  active: number;
  target: number;
  smoothX: number;
  smoothY: number;
  vx: number;
  vy: number;
  radius: number;
  needsSync: boolean;
  // tap-burst pulse (0..1). decays toward 0 each frame; while > 0 it adds
  // to the cursor radius + strength so a tap creates an outward shove of
  // nearby particles. used on touch where there is no hover/drag motion to
  // organically push particles around.
  pulse: number;
}

// spatial hash: fixed bucket table + per-particle linked lists, all typed
// arrays allocated once. the previous Map<string, cell> grid built a
// `${cx},${cy}` string for every insert and every neighbor lookup - on the
// order of 100k string allocations + hashes per frame at 900 particles x 6
// substeps x 3 passes, all on the main thread.
const HASH_SIZE = 4096;
const HASH_MASK = HASH_SIZE - 1;
function hashCell(cx: number, cy: number): number {
  return ((cx * 73856093) ^ (cy * 19349663)) & HASH_MASK;
}

interface SpatialHash {
  head: Int32Array; // bucket -> first particle index, -1 if empty
  next: Int32Array; // particle -> next particle in the same bucket
  cellX: Int32Array; // particle -> its cell coords (collision check)
  cellY: Int32Array;
}

function makeSpatialHash(count: number): SpatialHash {
  return {
    head: new Int32Array(HASH_SIZE),
    next: new Int32Array(count),
    cellX: new Int32Array(count),
    cellY: new Int32Array(count),
  };
}

/* ----- shape geometries (unit-sized, scaled per-instance) ----- */

function makeSquareGeom(size: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(size, size);
}

function makeCircleGeom(radius: number): THREE.BufferGeometry {
  return new THREE.CircleGeometry(radius, 14);
}

function makePlusGeom(w: number, t: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    -w / 2,
    -t / 2,
    0,
    w / 2,
    -t / 2,
    0,
    w / 2,
    t / 2,
    0,
    -w / 2,
    -t / 2,
    0,
    w / 2,
    t / 2,
    0,
    -w / 2,
    t / 2,
    0,
    -t / 2,
    -w / 2,
    0,
    t / 2,
    -w / 2,
    0,
    t / 2,
    w / 2,
    0,
    -t / 2,
    -w / 2,
    0,
    t / 2,
    w / 2,
    0,
    -t / 2,
    w / 2,
    0,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  return g;
}

function makeXGeom(w: number, t: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const cos = Math.cos(Math.PI / 4);
  const sin = Math.sin(Math.PI / 4);
  const rect: Array<[number, number]> = [
    [-w / 2, -t / 2],
    [w / 2, -t / 2],
    [w / 2, t / 2],
    [-w / 2, -t / 2],
    [w / 2, t / 2],
    [-w / 2, t / 2],
  ];
  const verts: number[] = [];
  rect.forEach(([px, py]) =>
    verts.push(px * cos - py * sin, px * sin + py * cos, 0),
  );
  rect.forEach(([px, py]) =>
    verts.push(px * cos + py * sin, -px * sin + py * cos, 0),
  );
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return g;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  // useLayoutEffect: zoom must commit before first frame, else init uses stale viewport.
  useLayoutEffect(() => {
    const ortho = camera as THREE.OrthographicCamera;
    if (!ortho.isOrthographicCamera) return;
    // height-based zoom is the original sizing logic (calibrated for 16:9).
    // also derive a WIDTH-based equivalent that matches at exactly 16:9. on
    // wider-than-16:9 viewports we blend toward it with a geometric mean
    // instead of taking it outright: particles still scale up with width so
    // they don't shrink against the extra space, but the pile stops
    // over-filling the section height on ultrawide monitors. <=16:9 and
    // portrait/mobile are unaffected (they stay height-driven).
    const heightZoom = size.height / 6.5;
    const widthZoom = size.width / (6.5 * (16 / 9));
    const blendedZoom =
      widthZoom > heightZoom
        ? Math.sqrt(heightZoom * widthZoom)
        : heightZoom;
    const targetZoom = Math.max(110, Math.min(280, blendedZoom));
    ortho.zoom = targetZoom;
    ortho.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/* ----- particle field (canvas-internal scene + physics rAF) ----- */

function ParticleField({
  pointerRef,
  particles,
  counts,
  substeps,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  particles: Particle[];
  counts: number[];
  substeps: number;
}) {
  const { gl } = useThree();

  const baseSize = 0.12;
  const geoms = useMemo(
    () => [
      makeSquareGeom(baseSize),
      makeCircleGeom(baseSize / 2),
      makePlusGeom(baseSize, baseSize * 0.34),
      makeXGeom(baseSize, baseSize * 0.34),
    ],
    [],
  );

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide }),
    [],
  );

  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([
    null,
    null,
    null,
    null,
  ]);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempEuler = useMemo(() => new THREE.Euler(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  // scratch arrays follow the particle set: a tier change swaps `particles`
  // in place now (the canvas no longer remounts), so these must resize with
  // it and the settled-pile init must run again for the new set.
  const hashRef = useRef<SpatialHash>(makeSpatialHash(0));
  const densityRef = useRef(new Float32Array(0));
  const pressureRef = useRef(new Float32Array(0));
  const initRef = useRef(false);
  const initFor = useRef<Particle[] | null>(null);
  if (initFor.current !== particles) {
    initFor.current = particles;
    initRef.current = false;
    hashRef.current = makeSpatialHash(particles.length);
    densityRef.current = new Float32Array(particles.length);
    pressureRef.current = new Float32Array(particles.length);
  }

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => e.preventDefault();
    canvas.addEventListener("webglcontextlost", onLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
    };
  }, [gl]);

  // dispose geoms + material on unmount (passed via args, so r3f won't).
  useEffect(
    () => () => {
      geoms.forEach((g) => g.dispose());
      material.dispose();
    },
    [geoms, material],
  );

  const advancePhysics = (
    dt: number,
    cursorX: number,
    cursorY: number,
    cursorVx: number,
    cursorVy: number,
    pointerActive: number,
    cursorRadius: number,
    cursorStrength: number,
    cursorDrag: number,
    cursorPulse: number,
    halfW: number,
    halfH: number,
  ) => {
    const subDt = dt / substeps;
    for (let step = 0; step < substeps; step++) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let vx = (p.x - p.oldX) * FRICTION;
        let vy = (p.y - p.oldY) * FRICTION;
        const particleSpeed = Math.hypot(vx, vy);
        if (particleSpeed > MAX_PARTICLE_STEP) {
          const scale = MAX_PARTICLE_STEP / particleSpeed;
          vx *= scale;
          vy *= scale;
        }
        p.oldX = p.x;
        p.oldY = p.y;
        p.x += vx;
        p.y += vy - GRAVITY * subDt * subDt;
        p.rot += (p.x - p.oldX) * 2.0;
      }

      // rebuild the spatial hash for this substep. no allocation: buckets are
      // reset with fill(-1) and particles are threaded onto linked lists.
      const { head, next, cellX, cellY } = hashRef.current;
      const n = particles.length;
      head.fill(-1);
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        const cx = Math.floor(p.x / CELL_SIZE);
        const cy = Math.floor(p.y / CELL_SIZE);
        cellX[i] = cx;
        cellY[i] = cy;
        const h = hashCell(cx, cy);
        next[i] = head[h];
        head[h] = i;
      }

      // each pass visits every unordered pair (i < j) whose cells are within
      // `range` of each other exactly once: walk i's neighborhood, take j > i,
      // and reject bucket collisions by checking j's real cell coords.
      const densities = densityRef.current;
      const pressures = pressureRef.current;
      const pressureNeighborRange = Math.max(
        1,
        Math.ceil(PRESSURE_RADIUS / CELL_SIZE),
      );
      const pressureRadius2 = PRESSURE_RADIUS * PRESSURE_RADIUS;
      densities.fill(1);
      pressures.fill(0);
      for (let i = 0; i < n; i++) {
        const a = particles[i];
        const cx = cellX[i];
        const cy = cellY[i];
        for (let dxc = -pressureNeighborRange; dxc <= pressureNeighborRange; dxc++) {
          const ncx = cx + dxc;
          for (let dyc = -pressureNeighborRange; dyc <= pressureNeighborRange; dyc++) {
            const ncy = cy + dyc;
            for (let j = head[hashCell(ncx, ncy)]; j !== -1; j = next[j]) {
              if (j <= i || cellX[j] !== ncx || cellY[j] !== ncy) continue;
              const b = particles[j];
              const dxv = b.x - a.x;
              const dyv = b.y - a.y;
              const d2 = dxv * dxv + dyv * dyv;
              if (d2 < pressureRadius2) {
                const d = Math.max(Math.sqrt(d2), 0.0001);
                const w = 1 - d / PRESSURE_RADIUS;
                const density = w * w;
                densities[i] += density;
                densities[j] += density;
              }
            }
          }
        }
      }
      for (let i = 0; i < n; i++) {
        pressures[i] =
          Math.max(0, densities[i] - REST_DENSITY) * PRESSURE_STRENGTH;
      }
      for (let i = 0; i < n; i++) {
        const a = particles[i];
        const cx = cellX[i];
        const cy = cellY[i];
        for (let dxc = -pressureNeighborRange; dxc <= pressureNeighborRange; dxc++) {
          const ncx = cx + dxc;
          for (let dyc = -pressureNeighborRange; dyc <= pressureNeighborRange; dyc++) {
            const ncy = cy + dyc;
            for (let j = head[hashCell(ncx, ncy)]; j !== -1; j = next[j]) {
              if (j <= i || cellX[j] !== ncx || cellY[j] !== ncy) continue;
              const pressure = pressures[i] + pressures[j];
              if (pressure <= 0) continue;
              const b = particles[j];
              const dxv = b.x - a.x;
              const dyv = b.y - a.y;
              const d2 = dxv * dxv + dyv * dyv;
              if (d2 < pressureRadius2) {
                let d = Math.sqrt(d2);
                let nx, ny;
                if (d < 0.0001) {
                  const ang = Math.random() * Math.PI * 2;
                  nx = Math.cos(ang);
                  ny = Math.sin(ang);
                  d = 0.0001;
                } else {
                  nx = dxv / d;
                  ny = dyv / d;
                }
                const w = 1 - d / PRESSURE_RADIUS;
                const push = Math.min(pressure * w * w, MAX_PRESSURE_PUSH);
                const corrX = nx * push;
                const corrY = ny * push;
                a.x -= corrX;
                a.y -= corrY;
                b.x += corrX;
                b.y += corrY;
                const bounce = 0.1;
                a.oldX -= corrX * (1 - bounce);
                a.oldY -= corrY * (1 - bounce);
                b.oldX += corrX * (1 - bounce);
                b.oldY += corrY * (1 - bounce);
              }
            }
          }
        }
      }

      const neighborRange = Math.max(
        1,
        Math.ceil((0.1 + SEPARATION_PADDING) / CELL_SIZE),
      );
      for (let i = 0; i < n; i++) {
        const a = particles[i];
        const cx = cellX[i];
        const cy = cellY[i];
        for (let dxc = -neighborRange; dxc <= neighborRange; dxc++) {
          const ncx = cx + dxc;
          for (let dyc = -neighborRange; dyc <= neighborRange; dyc++) {
            const ncy = cy + dyc;
            for (let j = head[hashCell(ncx, ncy)]; j !== -1; j = next[j]) {
              if (j <= i || cellX[j] !== ncx || cellY[j] !== ncy) continue;
              const b = particles[j];
              const dxv = b.x - a.x;
              const dyv = b.y - a.y;
              const minD = a.r + b.r + SEPARATION_PADDING;
              const d2 = dxv * dxv + dyv * dyv;
              if (d2 < minD * minD) {
                let d = Math.sqrt(d2);
                let nx, ny;
                if (d < 0.0001) {
                  const ang = Math.random() * Math.PI * 2;
                  nx = Math.cos(ang);
                  ny = Math.sin(ang);
                  d = 0.0001;
                } else {
                  nx = dxv / d;
                  ny = dyv / d;
                }
                const overlap = (minD - d) * 0.5;
                const corrX = nx * overlap;
                const corrY = ny * overlap;
                a.x -= corrX;
                a.y -= corrY;
                b.x += corrX;
                b.y += corrY;
                const bounce = 0.1;
                a.oldX -= corrX * (1 - bounce);
                a.oldY -= corrY * (1 - bounce);
                b.oldX += corrX * (1 - bounce);
                b.oldY += corrY * (1 - bounce);
              }
            }
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const r = p.r;
        if (p.x < -halfW + r) p.x = -halfW + r;
        if (p.x > halfW - r) p.x = halfW - r;
        if (p.y < -halfH + r) {
          p.y = -halfH + r;
          p.oldX = THREE.MathUtils.lerp(p.x, p.oldX, FLOOR_FRICTION);
        }
        if (p.y > halfH - r) {
          p.y = halfH - r;
          p.oldY = p.y;
        }
      }

      if (pointerActive > 0.01) {
        const r2 = cursorRadius * cursorRadius;
        const wakeMix = cursorDrag * pointerActive;
        const blastActive = cursorPulse > 0.05;
        // massively increase the radial kick on tap so it scatters the blocks
        const blastForce = cursorPulse * 160.0;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - cursorX;
          const dy = p.y - cursorY;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r2) continue;
          let d = Math.sqrt(d2);
          let nx: number;
          let ny: number;
          if (d < 0.0001) {
            const cspd = Math.hypot(cursorVx, cursorVy);
            if (cspd > 0.01) {
              nx = cursorVx / cspd;
              ny = cursorVy / cspd;
            } else {
              const ang = Math.random() * Math.PI * 2;
              nx = Math.cos(ang);
              ny = Math.sin(ang);
            }
            d = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const origVx = p.x - p.oldX;
          const origVy = p.y - p.oldY;
          const newX = cursorX + nx * cursorRadius;
          const newY = cursorY + ny * cursorRadius;
          const k = 0.6;
          let newVx = origVx * k + cursorVx * subDt * wakeMix;
          let newVy = origVy * k + cursorVy * subDt * wakeMix;

          if (blastActive) {
            newVx += nx * blastForce * subDt;
            newVy += ny * blastForce * subDt;
          }

          p.x = newX;
          p.y = newY;
          p.oldX = newX - newVx;
          p.oldY = newY - newVy;
          const r = p.r;
          if (p.x < -halfW + r) p.x = -halfW + r;
          if (p.x > halfW - r) p.x = halfW - r;
          if (p.y < -halfH + r) p.y = -halfH + r;
          if (p.y > halfH - r) {
            p.y = halfH - r;
            p.oldY = p.y;
          }
        }
      }
    }
  };

  useFrame((state, deltaSec) => {
    const dt = Math.min(deltaSec, 1 / 30);
    const pointer = pointerRef.current;
    // getCurrentViewport: live recompute; state.viewport caches stale on zoom change.
    const v = state.viewport.getCurrentViewport(state.camera);
    const halfW = v.width / 2;
    const halfH = v.height / 2;

    if (
      !Number.isFinite(halfW) ||
      !Number.isFinite(halfH) ||
      halfW <= 0 ||
      halfH <= 0
    ) {
      return;
    }

    if (!Number.isFinite(particles[0].x) || !Number.isFinite(particles[0].y)) {
      initRef.current = false;
      pointer.nx = 0;
      pointer.ny = 0;
      pointer.smoothX = 0;
      pointer.smoothY = 0;
      pointer.vx = 0;
      pointer.vy = 0;
      pointer.radius = 0;
      pointer.target = 0;
      pointer.active = 0;
      pointer.pulse = 0;
      pointer.needsSync = true;
    }

    if (!Number.isFinite(pointer.nx)) pointer.nx = 0;
    if (!Number.isFinite(pointer.ny)) pointer.ny = 0;
    if (!Number.isFinite(pointer.smoothX)) pointer.smoothX = 0;
    if (!Number.isFinite(pointer.smoothY)) pointer.smoothY = 0;
    if (!Number.isFinite(pointer.vx)) pointer.vx = 0;
    if (!Number.isFinite(pointer.vy)) pointer.vy = 0;
    if (!Number.isFinite(pointer.radius) || pointer.radius < 0)
      pointer.radius = 0;
    if (!Number.isFinite(pointer.active)) pointer.active = 0;
    if (!Number.isFinite(pointer.target)) pointer.target = 0;
    if (!Number.isFinite(pointer.pulse) || pointer.pulse < 0) pointer.pulse = 0;

    const wasStuttered = deltaSec > 1 / 15;

    if (!initRef.current && halfW > 0 && halfH > 0) {
      const cols = Math.ceil(
        Math.sqrt(
          particles.length * Math.max(1, halfW / Math.max(halfH * 0.42, 1)),
        ),
      );
      const rows = Math.ceil(particles.length / cols);
      const spanX = halfW * 1.85;
      const spanY = halfH * 0.62;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const jitterX = (Math.random() - 0.5) * (spanX / cols) * 0.35;
        const jitterY = (Math.random() - 0.5) * (spanY / rows) * 0.28;
        p.x = -spanX / 2 + ((col + 0.5) / cols) * spanX + jitterX;
        p.y = -halfH + 0.18 + ((row + 0.5) / rows) * spanY + jitterY;
        p.oldX = p.x;
        p.oldY = p.y;
      }
      initRef.current = true;
    }

    pointer.active = THREE.MathUtils.damp(
      pointer.active,
      pointer.target,
      8,
      dt,
    );

    const targetX = pointer.nx * halfW;
    const targetY = pointer.ny * halfH;

    if (pointer.needsSync || wasStuttered) {
      pointer.smoothX = targetX;
      pointer.smoothY = targetY;
      pointer.vx = 0;
      pointer.vy = 0;
      pointer.needsSync = false;
    } else if (dt > 1e-4) {
      const lastX = pointer.smoothX;
      const lastY = pointer.smoothY;
      pointer.smoothX = THREE.MathUtils.damp(pointer.smoothX, targetX, 15, dt);
      pointer.smoothY = THREE.MathUtils.damp(pointer.smoothY, targetY, 15, dt);
      const rawVx = (pointer.smoothX - lastX) / dt;
      const rawVy = (pointer.smoothY - lastY) / dt;
      const rawSpeed = Math.hypot(rawVx, rawVy);
      if (rawSpeed > MAX_CURSOR_SPEED) {
        pointer.vx = (rawVx / rawSpeed) * MAX_CURSOR_SPEED;
        pointer.vy = (rawVy / rawSpeed) * MAX_CURSOR_SPEED;
      } else {
        pointer.vx = rawVx;
        pointer.vy = rawVy;
      }
    }

    const speed = Math.hypot(pointer.vx, pointer.vy);
    // pulse decays exponentially toward 0; ~250ms half-life feels like a snap.
    pointer.pulse = THREE.MathUtils.damp(pointer.pulse, 0, 5, dt);
    const pulseBoost = pointer.pulse;
    // double the pulse radius boost so it hits a larger area on tap
    const targetRadius =
      (0.45 + Math.min(speed * 0.02, 0.25)) * pointer.active + pulseBoost * 2.8;
    pointer.radius = THREE.MathUtils.damp(pointer.radius, targetRadius, 6, dt);
    const dynStrength = 80 + Math.min(speed * 4.0, 150) + pulseBoost * 400;
    const dynDrag = 1.0 + Math.min(speed * 0.1, 4.0) + pulseBoost * 3;

    advancePhysics(
      dt,
      pointer.smoothX,
      pointer.smoothY,
      pointer.vx,
      pointer.vy,
      pointer.active,
      pointer.radius,
      dynStrength,
      dynDrag,
      pulseBoost,
      halfW,
      halfH,
    );

    const indexers = [0, 0, 0, 0];
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      tempPos.set(p.x, p.y, 0);
      tempEuler.set(0, 0, p.rot);
      tempQuat.setFromEuler(tempEuler);
      tempScale.set(p.scale, p.scale, 1);
      tempMatrix.compose(tempPos, tempQuat, tempScale);
      const mesh = meshRefs.current[p.shape];
      if (mesh) {
        mesh.setMatrixAt(indexers[p.shape]++, tempMatrix);
      }
    }
    for (let s = 0; s < 4; s++) {
      const mesh = meshRefs.current[s];
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {([0, 1, 2, 3] as Shape[]).map((shape) => (
        <instancedMesh
          key={shape}
          ref={(el) => {
            meshRefs.current[shape] = el;
          }}
          args={[geoms[shape], material, Math.max(1, counts[shape])]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

/* ----- public canvas wrapper ----- */

export default function FluidParticleCanvas({
  pointerRef,
  visible,
  tier = "high",
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  visible: boolean;
  tier?: PerformanceTier;
}) {
  const particleCount = tierParticleCount(tier);
  const substeps = tierSubsteps(tier);
  const { particles, counts } = useMemo(() => {
    const arr: Particle[] = [];
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < particleCount; i++) {
      const roll = Math.random();
      const shape: Shape =
        roll < 0.5 ? 0 : roll < 0.78 ? 1 : roll < 0.92 ? 2 : 3;
      counts[shape]++;
      const px = (Math.random() - 0.5) * 9;
      const py = 2 + Math.random() * 9;
      arr.push({
        x: px,
        y: py,
        oldX: px - (Math.random() - 0.5) * 0.02,
        oldY: py - (Math.random() - 0.5) * 0.01,
        rot: Math.random() * Math.PI * 2,
        r: (0.052 + Math.random() * 0.025) * 0.75,
        shape,
        scale: (0.78 + Math.random() * 0.55) * 0.75,
      });
    }
    return { particles: arr, counts };
  }, [particleCount]);

  // dpr cap halves on mobile/low so we paint ~4x fewer fragments per frame.
  const dpr: [number, number] =
    tier === "high" ? [1, 1.5] : tier === "medium" ? [0.9, 1.25] : [0.75, 1];

  return (
    <Canvas
      orthographic
      dpr={dpr}
      frameloop={visible ? "always" : "never"}
      gl={{
        antialias: tier !== "low",
        alpha: true,
        powerPreference: "high-performance",
      }}
      camera={{ zoom: 100, position: [0, 0, 10] }}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <ResponsiveCamera />
      <ParticleField
        pointerRef={pointerRef}
        particles={particles}
        counts={counts}
        substeps={substeps}
      />
    </Canvas>
  );
}
