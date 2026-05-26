"use client";

import { useEffect, useRef, useState } from "react";
import { usePerformanceTier } from "@/lib/performance";
import { useAccent } from "@/components/AccentProvider";

// CPU port of PavelDoGreat's WebGL fluid simulation. the full chowder:
// vorticity confinement + INCOMPRESSIBLE FLOW via jacobi-iterated pressure
// projection. that pressure step is what separates "real swirling fluid"
// from "ribbon painted by the cursor" - without it, mass piles up where
// the cursor lands and the velocity field stays divergent forever, which
// is why our earlier dye-field-only version felt like cursor trails.
//
// per-frame pipeline (mirrors the reference's step() in script.js):
//   1. apply vorticity confinement (curl + perpendicular force)
//   2. compute divergence of velocity field
//   3. dissipate carried-over pressure (warm-start the solver)
//   4. jacobi-iterate the pressure poisson equation N times
//   5. subtract pressure gradient from velocity -> divergence-free flow
//   6. semi-lagrangian advect velocity and dye, with shader-style
//      time-correct decay folded in (matches reference's
//      `result / (1 + dissipation * dt)`)
//
// custom additions kept on top of the port:
//   - PREMULTIPLIED ALPHA dye: dR/dG/dB store color*alpha, dA stores alpha.
//     splats are alpha-gated against the current dye cap, so once a cell
//     saturates at hue X it keeps that color and later hue-Y splats can't
//     recolor it - they can only fade. this is our cheap version of the
//     reference's COLOR_UPDATE_SPEED behavior.
//   - SPEED-SCALED dye cap: slow drag -> dim cap, fast flick -> bright cap.
//     prevents slow-cursor stain without per-splat brightness flicker.
//   - PERFORMANCE TIER scaling: grid resolution + pressure iterations drop
//     on medium-tier hardware; low-tier devices skip the effect entirely.
//     desktop-only is already enforced by the (pointer: fine) check.

type TierConfig = {
  gridW: number;
  gridH: number;
  pressureIters: number;
};

// resolution + iteration budget per perf tier. these are the only knobs
// that change with tier; everything else (splat sizes, dissipation rates,
// vorticity strength) is shared so the look stays consistent.
const TIER_CONFIG: Record<"high" | "medium", TierConfig> = {
  high: { gridW: 360, gridH: 225, pressureIters: 20 },
  medium: { gridW: 256, gridH: 160, pressureIters: 12 },
};

// per-SECOND dissipation rates, applied during advection as
// `result /= 1 + dissipation * dt_sec`. matches the reference so velocity
// bleeds slower than dye (currents persist, dye fades).
const VEL_DISSIPATION = 0.2;
const DYE_DISSIPATION = 1.0;
// pressure carry-over scalar. existing pressure is multiplied by this each
// frame before solving - serves as a warm start for jacobi while still
// letting old pressure decay when no new divergence appears.
const PRESSURE_DISSIPATION = 0.8;

const VEL_SPLAT_RADIUS = 45;
const VEL_SPLAT_FORCE = 0.85;
const DYE_SPLAT_RADIUS = 39;
const DYE_SPLAT_INTENSITY = 0.5;
const VEL_FALLOFF_K = 0.0075;
const DYE_FALLOFF_K = 0.0095;
const DYE_MAX = 1.0;
const VORTICITY_STRENGTH = 0.18;
const MAX_INJECT_VEL = 4.0;
const DT_CAP = 1.5;

// thin-film palette is BUILT FROM THE CURRENT ACCENT at runtime. we rotate
// hue around accent.base in HSV space and emit 6 high-saturation stops
// inside a tight ±25° arc, so every splat stays clearly in the accent's
// hue family (e.g. pink accent never strays into red). variation comes
// from S/V instead of wide hue rotation - some stops are darker / lighter
// versions of nearby hues to give iridescent depth without rainbow drift.

// hue offsets (in [0,1] = full circle) + per-stop (S, V) for variation.
// total spread: -25° to +25°. wider than this and plasma (pink) starts
// emitting reds, ember (orange) starts emitting yellows, etc.
const PALETTE_STOPS: Array<[number, number, number]> = [
  [-0.07, 0.95, 0.88], // cool side, slightly dim   (-25°)
  [-0.04, 0.95, 0.96], // near-cool, bright         (-14°)
  [0.0, 0.95, 0.9], // accent itself
  [0.02, 0.92, 0.96], // near-warm, bright         (+7°)
  [0.05, 0.92, 0.88], // warm side, slightly dim   (+18°)
  [0.07, 0.9, 0.93], // warm edge                  (+25°)
];

function hexToHsv(hex: string): [number, number, number] {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const v = mx;
  const s = mx === 0 ? 0 : (mx - mn) / mx;
  let hue = 0;
  if (mx !== mn) {
    const d = mx - mn;
    if (mx === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue /= 6;
  }
  return [hue, s, v];
}

function hsvToRgb(
  hue: number,
  s: number,
  v: number,
): [number, number, number] {
  const i = Math.floor(hue * 6);
  const f = hue * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

function buildPalette(
  accentHex: string,
): Array<[number, number, number]> {
  const [baseHue] = hexToHsv(accentHex);
  return PALETTE_STOPS.map(([dh, s, v]) => {
    const hh = (((baseHue + dh) % 1) + 1) % 1;
    return hsvToRgb(hh, s, v);
  });
}

function sampleColor(
  palette: Array<[number, number, number]>,
  t: number,
): [number, number, number] {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * palette.length;
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = palette[i];
  const b = palette[(i + 1) % palette.length];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function OilFilmRipple() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setFinePointer(
      window.matchMedia("(pointer: fine) and (hover: hover)").matches,
    );
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  // tie into the site-wide perf tier so weaker desktops drop down a grid
  // size + iteration count, and low-tier devices skip the effect entirely.
  const tier = usePerformanceTier(reducedMotion, true);
  const enabled = finePointer && !reducedMotion && tier !== "low";

  // accent-anchored palette. live-update via ref instead of effect deps so
  // cycling the accent (hero click) doesn't tear down + rebuild the sim -
  // new splats pick up the new palette while existing dye fades naturally.
  const accent = useAccent();
  const paletteRef = useRef<Array<[number, number, number]>>(
    buildPalette(accent.base),
  );
  useEffect(() => {
    paletteRef.current = buildPalette(accent.base);
  }, [accent.base]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const cfg = TIER_CONFIG[tier === "high" ? "high" : "medium"];
    const GRID_W = cfg.gridW;
    const GRID_H = cfg.gridH;
    const GRID_SIZE = GRID_W * GRID_H;
    const PRESSURE_ITERS = cfg.pressureIters;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = GRID_W;
    canvas.height = GRID_H;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // velocity field (vec2 per cell) + scratch for advection swap.
    const vx = new Float32Array(GRID_SIZE);
    const vy = new Float32Array(GRID_SIZE);
    const vx2 = new Float32Array(GRID_SIZE);
    const vy2 = new Float32Array(GRID_SIZE);
    // PREMULTIPLIED color storage (see header comment).
    const dR = new Float32Array(GRID_SIZE);
    const dG = new Float32Array(GRID_SIZE);
    const dB = new Float32Array(GRID_SIZE);
    const dA = new Float32Array(GRID_SIZE);
    const dR2 = new Float32Array(GRID_SIZE);
    const dG2 = new Float32Array(GRID_SIZE);
    const dB2 = new Float32Array(GRID_SIZE);
    const dA2 = new Float32Array(GRID_SIZE);
    // helper fields for the navier-stokes step.
    const curl = new Float32Array(GRID_SIZE);
    const divergence = new Float32Array(GRID_SIZE);
    // pressure ping-pong. declared `let` because jacobiPressure swaps
    // the references after each iteration.
    let pressure = new Float32Array(GRID_SIZE);
    let pressure2 = new Float32Array(GRID_SIZE);

    const imageData = ctx.createImageData(GRID_W, GRID_H);
    const imgBuf = imageData.data;

    let raf = 0;
    let running = false;
    // cell sizes derived from the canvas's current CSS rect (hero-local,
    // not viewport). recomputed inside onMove from the rect query so we
    // don't need a separate resize listener.
    let cellW = 16;
    let cellH = 16;
    let lastFrameMs = 0;
    let lastX = -1;
    let lastY = -1;
    let lastMoveMs = 0;
    // tracks whether the canvas is currently observed as in-viewport.
    // when false the pointer listener is detached and the sim is idle.
    let pointerAttached = false;

    const splat = (
      worldX: number,
      worldY: number,
      dvx: number,
      dvy: number,
      dr: number,
      dg: number,
      db: number,
      dyeCap: number,
    ) => {
      const gx = worldX / cellW;
      const gy = worldY / cellH;
      const radius = Math.max(VEL_SPLAT_RADIUS, DYE_SPLAT_RADIUS);
      const i0 = Math.max(0, Math.floor(gx - radius));
      const i1 = Math.min(GRID_W - 1, Math.ceil(gx + radius));
      const j0 = Math.max(0, Math.floor(gy - radius));
      const j1 = Math.min(GRID_H - 1, Math.ceil(gy + radius));
      const vRsq = VEL_SPLAT_RADIUS * VEL_SPLAT_RADIUS;
      const dRsq = DYE_SPLAT_RADIUS * DYE_SPLAT_RADIUS;
      for (let j = j0; j <= j1; j++) {
        const rowBase = j * GRID_W;
        for (let i = i0; i <= i1; i++) {
          const ddx = i - gx;
          const ddy = j - gy;
          const dSq = ddx * ddx + ddy * ddy;
          const idx = rowBase + i;
          if (dSq <= vRsq) {
            const vF = Math.exp(-dSq * VEL_FALLOFF_K);
            vx[idx] += dvx * vF * VEL_SPLAT_FORCE;
            vy[idx] += dvy * vF * VEL_SPLAT_FORCE;
          }
          if (dSq <= dRsq) {
            const oldA = dA[idx];
            // ALPHA-GATED COLOR INJECTION (the no-recolor trick).
            // - if oldA >= dyeCap, this cell is already as saturated as the
            //   current splat's speed-cap allows, so we add NOTHING. existing
            //   color is preserved exactly. this is what stops slow movement
            //   from recoloring previously-painted oil.
            // - if oldA < dyeCap, we add new alpha equal to the falloff-scaled
            //   share of remaining headroom. the new alpha CARRIES the
            //   splat's color into the premultiplied accumulator. fully empty
            //   cells take on the splat's hue; partially-filled cells get a
            //   weighted alpha-mix (correct under premultiplication).
            if (oldA < dyeCap) {
              const dF = Math.exp(-dSq * DYE_FALLOFF_K);
              const addA = (dyeCap - oldA) * dF * DYE_SPLAT_INTENSITY;
              dR[idx] += dr * addA;
              dG[idx] += dg * addA;
              dB[idx] += db * addA;
              dA[idx] = oldA + addA;
            }
          }
        }
      }
    };

    // VORTICITY CONFINEMENT - re-injects rotational energy that bilinear
    // advection would otherwise smooth away. matches the reference's
    // curlShader + vorticityShader.
    const applyVorticity = (dt: number) => {
      // pass 1: compute curl at every interior cell.
      for (let j = 1; j < GRID_H - 1; j++) {
        for (let i = 1; i < GRID_W - 1; i++) {
          const idx = j * GRID_W + i;
          const dvy_dx = (vy[idx + 1] - vy[idx - 1]) * 0.5;
          const dvx_dy = (vx[idx + GRID_W] - vx[idx - GRID_W]) * 0.5;
          curl[idx] = dvy_dx - dvx_dy;
        }
      }
      // pass 2: gradient of |curl| -> normalize -> apply perpendicular
      // force scaled by local curl. this is what makes swirls grow.
      for (let j = 1; j < GRID_H - 1; j++) {
        for (let i = 1; i < GRID_W - 1; i++) {
          const idx = j * GRID_W + i;
          const dwdx =
            (Math.abs(curl[idx + 1]) - Math.abs(curl[idx - 1])) * 0.5;
          const dwdy =
            (Math.abs(curl[idx + GRID_W]) - Math.abs(curl[idx - GRID_W])) * 0.5;
          const len = Math.hypot(dwdx, dwdy) + 1e-5;
          const Nx = dwdx / len;
          const Ny = dwdy / len;
          // force perpendicular to gradient, magnitude proportional to curl
          vx[idx] += VORTICITY_STRENGTH * Ny * curl[idx] * dt;
          vy[idx] += -VORTICITY_STRENGTH * Nx * curl[idx] * dt;
        }
      }
    };

    // DIVERGENCE of velocity field, centered differences on interior cells.
    // matches reference's divergenceShader: div = 0.5 * (R - L + T - B).
    const computeDivergence = () => {
      for (let j = 1; j < GRID_H - 1; j++) {
        const rowBase = j * GRID_W;
        for (let i = 1; i < GRID_W - 1; i++) {
          const idx = rowBase + i;
          const L = vx[idx - 1];
          const R = vx[idx + 1];
          const T = vy[idx + GRID_W];
          const B = vy[idx - GRID_W];
          divergence[idx] = 0.5 * (R - L + T - B);
        }
      }
    };

    // PRESSURE CARRY-OVER DECAY. scales last frame's pressure as a warm
    // start for jacobi (reference's clearProgram with value=PRESSURE).
    const dissipatePressure = () => {
      for (let i = 0; i < GRID_SIZE; i++) {
        pressure[i] *= PRESSURE_DISSIPATION;
      }
    };

    // JACOBI POISSON SOLVE for pressure. each iteration averages the four
    // neighbors and subtracts local divergence. after PRESSURE_ITERS passes,
    // grad(p) approximates the divergent component of v, which we then
    // subtract to enforce mass conservation. ping-pongs between `pressure`
    // and `pressure2`; after the loop `pressure` holds the latest result.
    const jacobiPressure = () => {
      let src = pressure;
      let dst = pressure2;
      for (let iter = 0; iter < PRESSURE_ITERS; iter++) {
        for (let j = 1; j < GRID_H - 1; j++) {
          const rowBase = j * GRID_W;
          for (let i = 1; i < GRID_W - 1; i++) {
            const idx = rowBase + i;
            const L = src[idx - 1];
            const R = src[idx + 1];
            const T = src[idx + GRID_W];
            const B = src[idx - GRID_W];
            dst[idx] = (L + R + T + B - divergence[idx]) * 0.25;
          }
        }
        // Neumann boundary: pressure-normal at the wall is zero, achieved by
        // copying the adjacent interior value out to the edge.
        for (let j = 0; j < GRID_H; j++) {
          const rowBase = j * GRID_W;
          dst[rowBase] = dst[rowBase + 1];
          dst[rowBase + GRID_W - 1] = dst[rowBase + GRID_W - 2];
        }
        for (let i = 0; i < GRID_W; i++) {
          dst[i] = dst[GRID_W + i];
          dst[(GRID_H - 1) * GRID_W + i] = dst[(GRID_H - 2) * GRID_W + i];
        }
        const tmp = src;
        src = dst;
        dst = tmp;
      }
      pressure = src;
      pressure2 = dst;
    };

    // SUBTRACT PRESSURE GRADIENT from velocity. after this pass the
    // velocity field is divergence-free (incompressible). matches the
    // reference's gradientSubtractShader exactly (no 0.5 factor - their
    // calibration absorbs it into the SPLAT_FORCE / texelSize scale).
    const subtractGradient = () => {
      for (let j = 1; j < GRID_H - 1; j++) {
        const rowBase = j * GRID_W;
        for (let i = 1; i < GRID_W - 1; i++) {
          const idx = rowBase + i;
          const L = pressure[idx - 1];
          const R = pressure[idx + 1];
          const T = pressure[idx + GRID_W];
          const B = pressure[idx - GRID_W];
          vx[idx] -= R - L;
          vy[idx] -= T - B;
        }
      }
    };

    // SEMI-LAGRANGIAN ADVECTION + shader-style decay folded in. dissipation
    // is time-correct rather than per-frame: result *= 1/(1 + d * dt_sec).
    const advectAll = (dt: number, dtSec: number) => {
      const velDecay = 1 / (1 + VEL_DISSIPATION * dtSec);
      const dyeDecay = 1 / (1 + DYE_DISSIPATION * dtSec);
      for (let j = 0; j < GRID_H; j++) {
        const rowBase = j * GRID_W;
        for (let i = 0; i < GRID_W; i++) {
          const idx = rowBase + i;
          let sx = i - vx[idx] * dt;
          let sy = j - vy[idx] * dt;
          if (sx < 0) sx = 0;
          else if (sx > GRID_W - 1.001) sx = GRID_W - 1.001;
          if (sy < 0) sy = 0;
          else if (sy > GRID_H - 1.001) sy = GRID_H - 1.001;
          const ii = sx | 0;
          const jj = sy | 0;
          const fx = sx - ii;
          const fy = sy - jj;
          const i00 = jj * GRID_W + ii;
          const i10 = i00 + 1;
          const i01 = i00 + GRID_W;
          const i11 = i01 + 1;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;
          vx2[idx] =
            (vx[i00] * w00 + vx[i10] * w10 + vx[i01] * w01 + vx[i11] * w11) *
            velDecay;
          vy2[idx] =
            (vy[i00] * w00 + vy[i10] * w10 + vy[i01] * w01 + vy[i11] * w11) *
            velDecay;
          // premultiplied color advects correctly under plain bilinear -
          // that's the whole point of premultiplication. dA advects in
          // lockstep so de-premultiplication at render stays valid.
          dR2[idx] =
            (dR[i00] * w00 + dR[i10] * w10 + dR[i01] * w01 + dR[i11] * w11) *
            dyeDecay;
          dG2[idx] =
            (dG[i00] * w00 + dG[i10] * w10 + dG[i01] * w01 + dG[i11] * w11) *
            dyeDecay;
          dB2[idx] =
            (dB[i00] * w00 + dB[i10] * w10 + dB[i01] * w01 + dB[i11] * w11) *
            dyeDecay;
          dA2[idx] =
            (dA[i00] * w00 + dA[i10] * w10 + dA[i01] * w01 + dA[i11] * w11) *
            dyeDecay;
        }
      }
      vx.set(vx2);
      vy.set(vy2);
      dR.set(dR2);
      dG.set(dG2);
      dB.set(dB2);
      dA.set(dA2);
    };

    const renderDye = () => {
      // de-premultiply: stored (R*A, G*A, B*A) -> displayed (R, G, B, A).
      // tiny-alpha cells short-circuit to zero so we don't divide by ~0.
      for (let i = 0; i < GRID_SIZE; i++) {
        const a = dA[i];
        const p = i * 4;
        if (a > 0.001) {
          const inv = 1 / a;
          const r = dR[i] * inv;
          const g = dG[i] * inv;
          const b = dB[i] * inv;
          imgBuf[p] = r > 1 ? 255 : (r * 255) | 0;
          imgBuf[p + 1] = g > 1 ? 255 : (g * 255) | 0;
          imgBuf[p + 2] = b > 1 ? 255 : (b * 255) | 0;
          // render at true alpha - no boost. background mood, not centerpiece.
          imgBuf[p + 3] = a > 1 ? 255 : (a * 255) | 0;
        } else {
          imgBuf[p] = 0;
          imgBuf[p + 1] = 0;
          imgBuf[p + 2] = 0;
          imgBuf[p + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    };

    const ensureRunning = (now: number) => {
      if (running) return;
      running = true;
      lastFrameMs = now;
      raf = window.requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (document.visibilityState === "hidden") return;
      // canvas-local rect: ripple lives inside the hero section, so we
      // translate viewport coords -> hero-local coords and drop anything
      // outside the hero bounds (cursor moved over a different section).
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        // outside hero - reset connect-from anchor so re-entry doesn't
        // streak a splat from the last in-bounds position.
        lastX = -1;
        lastY = -1;
        return;
      }
      // keep cellW/cellH in sync with the live CSS size (cheap; one
      // layout query per pointer event, browser-cached within a frame).
      cellW = rect.width / GRID_W;
      cellH = rect.height / GRID_H;
      const now = performance.now();
      if (lastX < 0) {
        lastX = x;
        lastY = y;
        lastMoveMs = now;
        return;
      }
      const dx = x - lastX;
      const dy = y - lastY;
      const dist = Math.hypot(dx, dy);
      // tiny epsilon only - just enough to skip jitter / zero-motion events.
      // the speed-scaled cap below already handles brightness, so we don't
      // need a coarse threshold here (which was causing pulse cadence on
      // sub-pixel drags).
      if (dist < 0.05) return;
      // do NOT clamp dt upward - that was undersampling speed on high-Hz
      // pointers (240Hz trackpads give dt ~4ms; clamping to 8ms halved the
      // computed speed). MAX_INJECT_VEL still caps runaway flicks.
      const dt = Math.max(1, now - lastMoveMs);
      // pointer velocity -> cells per simulation frame, clamped so a hard
      // flick doesn't blow the sim up.
      let cellsPerFrameX = ((dx / dt) * (1000 / 60)) / cellW;
      let cellsPerFrameY = ((dy / dt) * (1000 / 60)) / cellH;
      cellsPerFrameX = clamp(cellsPerFrameX, -MAX_INJECT_VEL, MAX_INJECT_VEL);
      cellsPerFrameY = clamp(cellsPerFrameY, -MAX_INJECT_VEL, MAX_INJECT_VEL);

      // speed maps to the dye CEILING (not per-splat alpha). slow drags
      // settle at a dim cap, fast flicks at a bright cap. velocity is NOT
      // scaled - the fluid should still swirl on slow movement, just dimly.
      const speed = (dist / dt) * 1000;
      const dyeCap = DYE_MAX * clamp(speed / 900, 0.035, 1);
      const hue = (now * 0.00012) % 1;
      const [r, g, b] = sampleColor(paletteRef.current, hue);

      const steps = Math.min(18, Math.max(1, Math.ceil(dist / 18)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        splat(
          lastX + dx * t,
          lastY + dy * t,
          cellsPerFrameX,
          cellsPerFrameY,
          r,
          g,
          b,
          dyeCap,
        );
      }
      lastX = x;
      lastY = y;
      lastMoveMs = now;
      ensureRunning(now);
    };

    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      vx.fill(0);
      vy.fill(0);
      dR.fill(0);
      dG.fill(0);
      dB.fill(0);
      dA.fill(0);
      curl.fill(0);
      divergence.fill(0);
      pressure.fill(0);
      pressure2.fill(0);
      lastX = -1;
      lastY = -1;
    };

    const loop = (now: number) => {
      const dtMs = Math.min(48, now - lastFrameMs);
      lastFrameMs = now;
      const dt = Math.min(DT_CAP, dtMs / 16.67);
      const dtSec = dtMs / 1000;

      // full incompressible-flow step: vorticity -> divergence -> pressure
      // solve -> gradient subtract -> advect.
      applyVorticity(dt);
      computeDivergence();
      dissipatePressure();
      jacobiPressure();
      subtractGradient();
      advectAll(dt, dtSec);
      renderDye();

      // shutdown check: track MAX alpha. with premultiplied storage, all
      // color components are bounded by alpha, so max(dA) alone tells us
      // when the canvas is visually empty. early-break keeps this cheap
      // during active sim.
      let maxA = 0;
      for (let i = 0; i < GRID_SIZE; i++) {
        const a = dA[i];
        if (a > maxA) maxA = a;
        if (maxA > 0.004) break;
      }
      if (maxA < 0.004) {
        running = false;
        raf = 0;
        return;
      }
      raf = window.requestAnimationFrame(loop);
    };

    // INTERSECTION-GATED LIFECYCLE: pointer listener + RAF only run while
    // the hero is on screen. when scrolled away we cancel everything and
    // clear the fields so we're at zero CPU until the user comes back.
    const attachPointer = () => {
      if (pointerAttached) return;
      pointerAttached = true;
      window.addEventListener("pointermove", onMove, { passive: true });
    };
    const detachPointer = () => {
      if (!pointerAttached) return;
      pointerAttached = false;
      window.removeEventListener("pointermove", onMove);
      vx.fill(0);
      vy.fill(0);
      dR.fill(0);
      dG.fill(0);
      dB.fill(0);
      dA.fill(0);
      curl.fill(0);
      divergence.fill(0);
      pressure.fill(0);
      pressure2.fill(0);
      lastX = -1;
      lastY = -1;
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      running = false;
    };

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting) attachPointer();
              else detachPointer();
            },
            { rootMargin: "0px" },
          )
        : null;
    if (io) io.observe(canvas);
    else attachPointer();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io?.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [enabled, tier]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // absolute-inside-host: the canvas is mounted as a child of the hero
      // section, fills it, and scrolls naturally with it. z-[40] floats it
      // above HeroStage's inner content (z-30) so screen-blend can play
      // over the headline + ctas.
      className="pointer-events-none absolute inset-0 z-[40]"
      style={{
        // intrinsic canvas (GRID_W x GRID_H) css-scaled to fill the hero
        // section. browser bilinear upscale fuses cells into a continuous
        // fluid sheet.
        width: "100%",
        height: "100%",
        // toned-down overlay opacity. screen-blend at full opacity blew the
        // page out; ~55% keeps the iridescence present without competing
        // with content.
        opacity: 0.55,
        mixBlendMode: "screen",
        // pumped saturation + tiny contrast bump to keep the accent-anchored
        // hues feeling iridescent (not muddy) after blur and screen blend.
        filter: "blur(2.5px) saturate(1.55) contrast(1.18)",
        imageRendering: "auto",
      }}
    />
  );
}
