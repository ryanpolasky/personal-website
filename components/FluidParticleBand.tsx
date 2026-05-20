"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useIsVisible, useReducedMotion } from "@/lib/scroll";
import { MagneticButton } from "@/components/MagneticButton";

// fluid particle band, inspired by lusion.co's contact transition. roughly
// 1600 small white geometric shapes (squares, dots, plus signs, x marks)
// fall, pile up, and collide on an accent-colored stage. the cursor pushes
// them outward in a radial force field so it feels like dragging a finger
// through a sandbox of beads.
//
// physics runs on the CPU with a fixed-substep spatial-hash grid so collision
// resolution stays O(n) at ~1600 particles. rendering is GPU-side via four
// InstancedMesh objects (one per shape kind). reduced-motion users get a
// static accent banner with just the headline + cta.

const PARTICLE_COUNT = 1000;
const SUBSTEPS = 6; // higher sub-steps for incompressible liquid feel.
const CELL_SIZE = 0.35; // spatial-hash cell width in world units.
const GRAVITY = 20; // stronger gravity so they settle faster and feel heavy.
const FRICTION = 0.995; // low air drag so waves keep moving.
const FLOOR_FRICTION = 0.9; // slippery floor so the pool levels out horizontally.
const MAX_CURSOR_SPEED = 30.0; // clamp cursor velocity to prevent insane forces.
const MAX_PARTICLE_STEP = 0.15; // clamp verlet velocity so no particle can explode.

const PRESSURE_RADIUS = 0.42;
const REST_DENSITY = 2.15;
const PRESSURE_STRENGTH = 0.018;
const MAX_PRESSURE_PUSH = 0.008;

// increased so particles have a personal space bubble and read as
// individual shapes rather than fusing into a continuous blob.
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

interface PointerState {
  // normalized -1..1 within the section bounding rect. converted to world
  // coords inside the useFrame loop using viewport.width / viewport.height.
  nx: number;
  ny: number;
  // smoothed 0..1 activation envelope so the cursor force fades when the
  // pointer enters / leaves the section.
  active: number;
  target: number;
  smoothX: number;
  smoothY: number;
  vx: number;
  vy: number;
  radius: number; // dynamic interaction radius based on velocity
  needsSync: boolean;
}

interface GridCell {
  cx: number;
  cy: number;
  indices: number[];
}

function cellKey(cx: number, cy: number) {
  return `${cx},${cy}`;
}

/* ----- shape geometries (unit-sized, scaled per-instance) ----- */

function makeSquareGeom(size: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(size, size);
}

function makeCircleGeom(radius: number): THREE.BufferGeometry {
  return new THREE.CircleGeometry(radius, 14);
}

// plus sign built from two overlapping rectangles. w = arm length, t = stroke
// thickness. the two rects share triangles to keep the vertex count tiny.
function makePlusGeom(w: number, t: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    // horizontal bar
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
    // vertical bar
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

// x mark: two rectangles rotated +/- 45deg from the plus sign's bars.
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
  // +45 rotation
  rect.forEach(([px, py]) =>
    verts.push(px * cos - py * sin, px * sin + py * cos, 0),
  );
  // -45 rotation
  rect.forEach(([px, py]) =>
    verts.push(px * cos + py * sin, -px * sin + py * cos, 0),
  );
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return g;
}

/* ----- particle field (canvas-internal scene + physics rAF) ----- */

function ParticleField({
  pointerRef,
  particles,
  counts,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  particles: Particle[];
  counts: number[];
}) {
  const { viewport, gl } = useThree();

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

  // unlit white material shared across every shape. DoubleSide so circles +
  // custom triangles render even if winding is off.
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
  const gridRef = useRef<Map<string, GridCell>>(new Map());
  const densityRef = useRef(new Float32Array(particles.length));
  const pressureRef = useRef(new Float32Array(particles.length));
  // first-frame init flag: we re-distribute particles once we know the
  // actual viewport dimensions so the pool covers the full width on any
  // screen size.
  const initRef = useRef(false);

  // diagnostic accumulators flushed by the useFrame log block every 2s.
  // tracks fps, max dt seen, and stutter count so a single random refresh
  // hang is visible after the fact even if devtools wasn't open at the
  // exact instant. logs are always-on but rate-limited; filter the console
  // by "[FluidParticleBand]" to isolate them.
  const debugRef = useRef({
    frameCount: 0,
    lastLogTime: 0,
    maxDt: 0,
    bigStutterCount: 0,
    contextLostAt: 0,
  });

  // surface WebGL context loss / restore. with multiple R3F canvases on the
  // page (hero, kaleidoscope, ribbon, contact blob, this band) browsers
  // can silently kill the oldest context when GPU resources are tight on
  // a fresh refresh, freezing the canvas while physics keeps running on
  // the cpu. this hook makes that case explicit in the console instead of
  // a mysterious "particles disappeared" symptom.
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      // calling preventDefault on the lost event tells the browser we
      // intend to handle a restore; without it the context cannot be
      // reacquired.
      e.preventDefault();
      debugRef.current.contextLostAt = performance.now();
    };
    const onRestored = () => {
      debugRef.current.contextLostAt = 0;
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, particles.length]);

  // encapsulate the physics step so we can run it multiple times on the
  // first frame to pre-settle the particles without rendering the drops.
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
    halfW: number,
    halfH: number,
  ) => {
    const subDt = dt / SUBSTEPS;
    for (let step = 0; step < SUBSTEPS; step++) {
      /* 1. Integration (apply forces and move) */
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // implicit velocity from previous position
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

        // visually roll based on horizontal displacement
        p.rot += (p.x - p.oldX) * 2.0;
      }

      /* 2. Spatial Hash Rebuild */
      const grid = gridRef.current;
      grid.clear();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cx = Math.floor(p.x / CELL_SIZE);
        const cy = Math.floor(p.y / CELL_SIZE);
        const key = cellKey(cx, cy);
        let cell = grid.get(key);
        if (!cell) {
          cell = { cx, cy, indices: [] };
          grid.set(key, cell);
        }
        cell.indices.push(i);
      }

      /* 3. SPH Density/Pressure Pass */
      const densities = densityRef.current;
      const pressures = pressureRef.current;
      const pressureNeighborRange = Math.max(
        1,
        Math.ceil(PRESSURE_RADIUS / CELL_SIZE),
      );
      const pressureRadius2 = PRESSURE_RADIUS * PRESSURE_RADIUS;
      densities.fill(1);
      pressures.fill(0);
      grid.forEach((cell) => {
        const { cx, cy, indices } = cell;
        for (
          let dxc = -pressureNeighborRange;
          dxc <= pressureNeighborRange;
          dxc++
        ) {
          for (
            let dyc = -pressureNeighborRange;
            dyc <= pressureNeighborRange;
            dyc++
          ) {
            const neighbors = grid.get(cellKey(cx + dxc, cy + dyc));
            if (!neighbors) continue;
            for (let ii = 0; ii < indices.length; ii++) {
              const i = indices[ii];
              for (let jj = 0; jj < neighbors.indices.length; jj++) {
                const j = neighbors.indices[jj];
                if (j <= i) continue; // avoid double collision

                const a = particles[i];
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
      });
      for (let i = 0; i < particles.length; i++) {
        pressures[i] =
          Math.max(0, densities[i] - REST_DENSITY) * PRESSURE_STRENGTH;
      }
      grid.forEach((cell) => {
        const { cx, cy, indices } = cell;
        for (
          let dxc = -pressureNeighborRange;
          dxc <= pressureNeighborRange;
          dxc++
        ) {
          for (
            let dyc = -pressureNeighborRange;
            dyc <= pressureNeighborRange;
            dyc++
          ) {
            const neighbors = grid.get(cellKey(cx + dxc, cy + dyc));
            if (!neighbors) continue;
            for (let ii = 0; ii < indices.length; ii++) {
              const i = indices[ii];
              for (let jj = 0; jj < neighbors.indices.length; jj++) {
                const j = neighbors.indices[jj];
                if (j <= i) continue; // avoid double collision

                const pressure = pressures[i] + pressures[j];
                if (pressure <= 0) continue;
                const a = particles[i];
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

                  // Inelastic pressure transfer so it doesn't cause buzzing.
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
      });

      /* 4. Collisions */
      const neighborRange = Math.max(
        1,
        Math.ceil((0.1 + SEPARATION_PADDING) / CELL_SIZE),
      );
      grid.forEach((cell) => {
        const { cx, cy, indices } = cell;
        for (let dxc = -neighborRange; dxc <= neighborRange; dxc++) {
          for (let dyc = -neighborRange; dyc <= neighborRange; dyc++) {
            const neighbors = grid.get(cellKey(cx + dxc, cy + dyc));
            if (!neighbors) continue;
            for (let ii = 0; ii < indices.length; ii++) {
              const i = indices[ii];
              for (let jj = 0; jj < neighbors.indices.length; jj++) {
                const j = neighbors.indices[jj];
                if (j <= i) continue; // avoid double collision

                const a = particles[i];
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

                  // Repulsion: push overlapping positions apart. 0.5 ratio = equal mass.
                  const overlap = (minD - d) * 0.5;

                  const corrX = nx * overlap;
                  const corrY = ny * overlap;

                  a.x -= corrX;
                  a.y -= corrY;
                  b.x += corrX;
                  b.y += corrY;

                  // Inelastic collision factor.
                  // 1.0 = highly bouncy/wiggly. 0.0 = completely dead/viscous.
                  // 0.1 is extremely stable at rest (no wiggles) but allows slow flow.
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
      });

      /* 4. Boundaries (Walls, Floor, Ceiling) */
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const r = p.r;
        if (p.x < -halfW + r) p.x = -halfW + r;
        if (p.x > halfW - r) p.x = halfW - r;
        if (p.y < -halfH + r) {
          p.y = -halfH + r;
          // simulated floor friction: drag oldX closer to x to reduce implicit vx
          p.oldX = THREE.MathUtils.lerp(p.x, p.oldX, FLOOR_FRICTION);
        }
        // ceiling at the top of the section (where the accent color stops).
        // was previously `halfH + 6` (6 units past the canvas top, effectively
        // no ceiling - particles flew off-screen into the next section). now
        // clamps at halfH - r so the particle's top edge stops exactly at
        // the section boundary. zeroing oldY kills the implicit vertical
        // velocity so the particle drops back down via gravity rather than
        // bouncing - matches the floor's no-rebound behavior.
        if (p.y > halfH - r) {
          p.y = halfH - r;
          p.oldY = p.y;
        }
      }

      // cursor as a hard volume constraint: no particle may be inside the disk.
      // applied after pressure + collision so SPH cannot refill the void.
      // velocity is preserved through the position snap so motion stays natural,
      // plus a small wake impulse along cursor motion.
      if (pointerActive > 0.01) {
        const r2 = cursorRadius * cursorRadius;
        const wakeMix = cursorDrag * pointerActive;
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

          // velocity-preserving teleport to the cursor boundary
          const origVx = p.x - p.oldX;
          const origVy = p.y - p.oldY;
          const newX = cursorX + nx * cursorRadius;
          const newY = cursorY + ny * cursorRadius;

          // inelastic retention plus a wake impulse along cursor motion
          const k = 0.6;
          const newVx = origVx * k + cursorVx * subDt * wakeMix;
          const newVy = origVy * k + cursorVy * subDt * wakeMix;

          p.x = newX;
          p.y = newY;
          p.oldX = newX - newVx;
          p.oldY = newY - newVy;

          const r = p.r;
          if (p.x < -halfW + r) p.x = -halfW + r;
          if (p.x > halfW - r) p.x = halfW - r;
          if (p.y < -halfH + r) p.y = -halfH + r;
          // same ceiling clamp as the main boundary pass - without this,
          // the cursor force could shove particles past the top boundary
          // before the next solver iteration catches them.
          if (p.y > halfH - r) {
            p.y = halfH - r;
            p.oldY = p.y;
          }
        }
      }
    } // end verlet loop
  };

  useFrame((_state, deltaSec) => {
    // clamp dt: huge frame gaps shouldn't break physics
    const dt = Math.min(deltaSec, 1 / 30);
    const pointer = pointerRef.current;
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;

    /* ----- diagnostic accumulation ----- */
    const dbg = debugRef.current;
    dbg.frameCount++;
    if (deltaSec > dbg.maxDt) dbg.maxDt = deltaSec;
    if (deltaSec > 0.5) {
      dbg.bigStutterCount++;
    }
    const now = performance.now();
    if (dbg.lastLogTime === 0) dbg.lastLogTime = now;
    if (now - dbg.lastLogTime > 2000) {
      // reset perf counters every ~2s. log statements that consumed the
      // diagnostic tallies were removed; re-add the loop if debugging.
      dbg.frameCount = 0;
      dbg.maxDt = 0;
      dbg.bigStutterCount = 0;
      dbg.lastLogTime = now;
    }

    /* ----- safety guards ----- */

    // viewport not ready (zero / NaN / negative): skip this frame entirely.
    // running physics with halfW=0 collapses particles toward origin and
    // running with NaN poisons every subsequent calc.
    if (
      !Number.isFinite(halfW) ||
      !Number.isFinite(halfH) ||
      halfW <= 0 ||
      halfH <= 0
    ) {
      return;
    }

    // NaN recovery: if any particle has slipped into NaN territory (almost
    // always because pointer.nx briefly got a non-finite value from a zero-
    // area rect during a layout reflow), force a full re-init by clearing
    // initRef + resetting pointer state. the init block below this will
    // then re-distribute the pile on the next frame. cheap to check - we
    // only sample the first particle, since NaN propagates through the
    // pressure / collision passes so if one is NaN, effectively all are.
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
      pointer.needsSync = true;
    }

    // defensive sanitization: any pointer field that has snuck into NaN
    // territory through some path we haven't traced (frame-loop resume,
    // visibility flip with dt=0, etc) gets reset to a safe zero. cheap
    // (~9 Number.isFinite checks per frame). without this, a NaN in any
    // single pointer field cascades into NaN particle positions within
    // 1-2 frames because every downstream calc multiplies through them.
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

    // detect huge frame stutters (tab out/in, browser stall, initial pause).
    // on resume, a useFrame delta of many seconds would teleport `smoothX`
    // toward its target and compute an insane apparent velocity next frame.
    // when we detect this, we resync smooth coords + zero velocity for one frame.
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
      // resync without generating velocity: snap directly to current target.
      pointer.smoothX = targetX;
      pointer.smoothY = targetY;
      pointer.vx = 0;
      pointer.vy = 0;
      pointer.needsSync = false;
    } else if (dt > 1e-4) {
      // dt > 100µs gate avoids the 0/0 = NaN trap on the frame right after
      // frameloop resumes from 'never' → 'always' (R3F can deliver a
      // sub-µs deltaSec there). damp(x, x, lambda, ~0) returns x unchanged,
      // so (smoothX - lastX) / dt becomes 0 / 0 = NaN. NaN then cascades
      // into pointer.vx → speed → targetRadius → pointer.radius →
      // cursorRadius² in advancePhysics, where the `if (d2 >= NaN)` early-
      // exit fails (any comparison with NaN is false) and the cursor force
      // teleports every particle to cursorX + nx * NaN = NaN. on zero-dt
      // frames we just preserve last-frame's pointer state - next frame
      // will have a normal dt and the damping will resume.
      const lastX = pointer.smoothX;
      const lastY = pointer.smoothY;
      pointer.smoothX = THREE.MathUtils.damp(pointer.smoothX, targetX, 15, dt);
      pointer.smoothY = THREE.MathUtils.damp(pointer.smoothY, targetY, 15, dt);

      const rawVx = (pointer.smoothX - lastX) / dt;
      const rawVy = (pointer.smoothY - lastY) / dt;
      const rawSpeed = Math.hypot(rawVx, rawVy);

      // Hard-cap cursor velocity to prevent "mach 50 explosions" from
      // trackpad spikes or browser frame stutters.
      if (rawSpeed > MAX_CURSOR_SPEED) {
        pointer.vx = (rawVx / rawSpeed) * MAX_CURSOR_SPEED;
        pointer.vy = (rawVy / rawSpeed) * MAX_CURSOR_SPEED;
      } else {
        pointer.vx = rawVx;
        pointer.vy = rawVy;
      }
    }

    const speed = Math.hypot(pointer.vx, pointer.vy);

    // dynamic interaction field: scaled by pointer.active so it grows smoothly
    // from 0 on first cursor entry. small resting footprint, swells when swiped.
    const targetRadius = (0.45 + Math.min(speed * 0.02, 0.25)) * pointer.active;
    pointer.radius = THREE.MathUtils.damp(pointer.radius, targetRadius, 6, dt);

    // strong displacement so it actually clears a path through the heavy fluid.
    const dynStrength = 80 + Math.min(speed * 4.0, 150);
    const dynDrag = 1.0 + Math.min(speed * 0.1, 4.0);

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
      halfW,
      halfH,
    );

    /* 4. write the per-instance matrices for each shape kind. */
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

/* ----- section export ----- */

export function FluidParticleBand() {
  const reduced = useReducedMotion();
  const { ref: sectionRef, visible } = useIsVisible<HTMLElement>("1200px");
  const pointerRef = useRef<PointerState>({
    nx: 0,
    ny: 0,
    active: 0,
    target: 0,
    smoothX: 0,
    smoothY: 0,
    vx: 0,
    vy: 0,
    radius: 0,
    needsSync: false,
  });

  // build the particle array once. shape distribution is roughly 50% square /
  // 25% circle / 15% plus / 10% x so the cluster has visual variety without
  // any one shape dominating.
  const { particles, counts } = useMemo(() => {
    const arr: Particle[] = [];
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const roll = Math.random();
      const shape: Shape =
        roll < 0.5 ? 0 : roll < 0.78 ? 1 : roll < 0.92 ? 2 : 3;
      counts[shape]++;
      // start every particle somewhere in the upper world band so they
      // pour into the lower pool as soon as the canvas renders.
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
  }, []);

  // pointer wiring on window so it tracks even when the cursor is hovering
  // the title overlay (which sits behind the canvas).
  useEffect(() => {
    if (reduced) return;
    const el = sectionRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      // guard against zero-area rects from in-flight layout reflows. without
      // this, dividing pointer x by rect.width=0 yields Infinity/NaN, which
      // then poisons pointer.nx → targetX → smoothX → cursorRadius and
      // ultimately every particle position. observed in the wild on page
      // refresh as "all particles disappear with site lag" (NaN-propagating
      // physics costs ~50x the cpu of valid math).
      if (rect.width <= 0 || rect.height <= 0) {
        pointerRef.current.target = 0;
        return;
      }
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) {
        pointerRef.current.target = 0;
        return;
      }

      const newNx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const newNy = (0.5 - (e.clientY - rect.top) / rect.height) * 2;
      // defense in depth: even if rect dims were epsilon-tiny (sub-pixel)
      // due to a transform mid-animation, the division above can yield a
      // non-finite result. clamp anything non-finite back to (0,0) so the
      // pointer state never enters NaN territory.
      if (!Number.isFinite(newNx) || !Number.isFinite(newNy)) {
        pointerRef.current.target = 0;
        return;
      }

      // if the pointer just entered the section (target was 0), snap the smooth
      // coords directly to the new coords. this prevents the cursor from
      // "streaking" in from off-screen, which calculates a massive artificial
      // velocity and blows up the pile.
      if (pointerRef.current.target === 0) {
        pointerRef.current.nx = newNx;
        pointerRef.current.ny = newNy;
        pointerRef.current.needsSync = true;
      } else {
        pointerRef.current.nx = newNx;
        pointerRef.current.ny = newNy;
      }
      pointerRef.current.target = 1;
    };

    const onLeave = () => {
      pointerRef.current.target = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [reduced, sectionRef]);

  return (
    <section
      ref={sectionRef}
      id="contact"
      data-snap
      className="relative w-full overflow-hidden"
      style={{ background: "var(--color-accent)" }}
      aria-label="contact"
    >
      <div className="relative h-[100dvh] min-h-[680px] w-full">
        {/* CONTACT LOCKUP - section index, headline, CTA, link row. sits at
            z-20 above the particle canvas so the button + links stay crisp
            and clickable; particles still flow visibly in the negative space
            around the column. previously this section's headline was buried
            by piling particles for a lusion-style effect, but with a real CTA
            on it now, function (legibility + conversion) wins over decoration. */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-7 px-6">
          <p
            className="text-[10.5px] uppercase tracking-[0.32em] text-white/85"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            04 - contact
          </p>
          <h2 className="display max-w-[14ch] text-center text-[clamp(3rem,10vw,9rem)] leading-[0.92] text-white">
            let&apos;s build
            <br />
            <span
              style={{
                fontStyle: "italic",
                fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
              }}
            >
              small things.
            </span>
          </h2>
          <MagneticButton
            href="mailto:ryanpolasky@hotmail.com"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-[14px] tracking-tight text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)]"
          >
            let&apos;s talk →
          </MagneticButton>
          {/* outlined glass pills - the bare-text version got chewed up by
              particles flowing behind it. each pill has its own border +
              translucent fill + backdrop blur so the text always reads as a
              distinct surface no matter how busy the simulation gets behind
              it. kept smaller (13px) than the CTA (14px) so the visual
              hierarchy still reads CTA > secondary links. */}
          <div
            className="mt-1 flex flex-wrap items-center justify-center gap-2.5 text-[13px] uppercase tracking-[0.22em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <a
              href="https://www.linkedin.com/in/ryan-polasky/"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white"
              data-hoverable
            >
              linkedin →
            </a>
            <a
              href="https://github.com/ryanpolasky"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white"
              data-hoverable
            >
              github →
            </a>
            <a
              href="/spotify.html"
              className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white"
              data-hoverable
            >
              spotify →
            </a>
            <a
              href="/assets/Ryan_Polasky_Resume.pdf"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white"
              data-hoverable
            >
              resume.pdf →
            </a>
          </div>
        </div>

        {/* PARTICLE CANVAS - z-5 behind the lockup. canvas itself is
            pointer-events-none; cursor interaction with the sim is wired
            through window-level listeners in the effect above, so clicks
            on the CTA and links pass through cleanly. */}
        {!reduced && (
          <Canvas
            orthographic
            dpr={[1, 1.5]}
            frameloop={visible ? "always" : "never"}
            gl={{
              antialias: true,
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
            <ParticleField
              pointerRef={pointerRef}
              particles={particles}
              counts={counts}
            />
          </Canvas>
        )}
      </div>
    </section>
  );
}
