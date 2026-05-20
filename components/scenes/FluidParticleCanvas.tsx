"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// fluid particle canvas - the heavy three.js half of FluidParticleBand,
// extracted into its own module so the parent section (text + cta + pointer
// wiring) can dynamic-import this with ssr:false. keeping three + r3f out of
// the main chunk shaves ~200kb off first-load js. the particle physics and
// rendering code is unchanged from when it lived inline; only the module
// boundary moved.

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

// PointerState is the contract between the parent section (which wires
// window pointer events) and the canvas (which reads the latest pointer
// state inside useFrame). exported so the parent can `import type` it
// without dragging in three.
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

function makePlusGeom(w: number, t: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    -w / 2, -t / 2, 0,
     w / 2, -t / 2, 0,
     w / 2,  t / 2, 0,
    -w / 2, -t / 2, 0,
     w / 2,  t / 2, 0,
    -w / 2,  t / 2, 0,
    -t / 2, -w / 2, 0,
     t / 2, -w / 2, 0,
     t / 2,  w / 2, 0,
    -t / 2, -w / 2, 0,
     t / 2,  w / 2, 0,
    -t / 2,  w / 2, 0,
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
  const initRef = useRef(false);

  const debugRef = useRef({
    frameCount: 0,
    lastLogTime: 0,
    maxDt: 0,
    bigStutterCount: 0,
    contextLostAt: 0,
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
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
        for (let dxc = -pressureNeighborRange; dxc <= pressureNeighborRange; dxc++) {
          for (let dyc = -pressureNeighborRange; dyc <= pressureNeighborRange; dyc++) {
            const neighbors = grid.get(cellKey(cx + dxc, cy + dyc));
            if (!neighbors) continue;
            for (let ii = 0; ii < indices.length; ii++) {
              const i = indices[ii];
              for (let jj = 0; jj < neighbors.indices.length; jj++) {
                const j = neighbors.indices[jj];
                if (j <= i) continue;
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
        for (let dxc = -pressureNeighborRange; dxc <= pressureNeighborRange; dxc++) {
          for (let dyc = -pressureNeighborRange; dyc <= pressureNeighborRange; dyc++) {
            const neighbors = grid.get(cellKey(cx + dxc, cy + dyc));
            if (!neighbors) continue;
            for (let ii = 0; ii < indices.length; ii++) {
              const i = indices[ii];
              for (let jj = 0; jj < neighbors.indices.length; jj++) {
                const j = neighbors.indices[jj];
                if (j <= i) continue;
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
                if (j <= i) continue;
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
      });

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
          if (p.y > halfH - r) {
            p.y = halfH - r;
            p.oldY = p.y;
          }
        }
      }
    }
  };

  useFrame((_state, deltaSec) => {
    const dt = Math.min(deltaSec, 1 / 30);
    const pointer = pointerRef.current;
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;

    const dbg = debugRef.current;
    dbg.frameCount++;
    if (deltaSec > dbg.maxDt) dbg.maxDt = deltaSec;
    if (deltaSec > 0.5) dbg.bigStutterCount++;
    const now = performance.now();
    if (dbg.lastLogTime === 0) dbg.lastLogTime = now;
    if (now - dbg.lastLogTime > 2000) {
      dbg.frameCount = 0;
      dbg.maxDt = 0;
      dbg.bigStutterCount = 0;
      dbg.lastLogTime = now;
    }

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
    const targetRadius = (0.45 + Math.min(speed * 0.02, 0.25)) * pointer.active;
    pointer.radius = THREE.MathUtils.damp(pointer.radius, targetRadius, 6, dt);
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
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  visible: boolean;
}) {
  // build the particle array once, lazily inside this client-only module so
  // the heavy Particle[] allocation also stays out of the main chunk.
  const { particles, counts } = useMemo(() => {
    const arr: Particle[] = [];
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
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
  }, []);

  return (
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
  );
}
