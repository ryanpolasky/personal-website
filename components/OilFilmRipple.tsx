"use client";

import { useEffect, useRef, useState } from "react";

// real-deal fluid sim with vorticity confinement.
//
// the previous dye-field attempt felt offset because it used one
// `cellSize` for both axes but the canvas css-scales independently on x/y
// (a 1.78 aspect viewport with a 1.6 aspect grid does NOT scale uniformly).
// fix: separate cellW and cellH.
//
// it also didn't actually swirl because plain semi-lagrangian advection
// is dissipative - small rotations diffuse out before they grow. the fix
// is VORTICITY CONFINEMENT: compute the curl field, take the gradient of
// |curl|, and apply a force perpendicular to that gradient scaled by the
// local curl. this re-injects energy into rotational motion so eddies
// persist and grow instead of dying. it's the trick every webgl fluid
// sim uses to look fluid.

const GRID_W = 224;
const GRID_H = 140;
const GRID_SIZE = GRID_W * GRID_H;

const VEL_DECAY = 0.994; // slower decay so currents keep flowing
const DYE_DECAY = 0.9965; // dye lingers ~6 seconds
// splat radii in grid cells. these define both the cutoff window and
// (together with the falloff coefficients below) the visible size of
// each disturbance. roughly 2x larger than before for a bigger overall
// effect footprint.
const VEL_SPLAT_RADIUS = 28;
const VEL_SPLAT_FORCE = 0.85;
const DYE_SPLAT_RADIUS = 24;
// per-splat intensity stays low because the saturating accumulator
// below makes a stationary cursor approach 1.0 asymptotically.
const DYE_SPLAT_INTENSITY = 0.5;
// gaussian falloff coefficients. lower = wider, softer splat. tuned so
// the painted radius matches the cutoff above (was 0.35 = narrow blob,
// now ~0.08 = wide soft cloud).
const VEL_FALLOFF_K = 0.02;
const DYE_FALLOFF_K = 0.025;
// hard ceiling on dye accumulation per channel. with saturating add we
// can never paint brighter than this no matter how long you hover.
const DYE_MAX = 1.0;
const VORTICITY_STRENGTH = 0.28; // scaled down for higher-res curl
const MAX_INJECT_VEL = 4.0; // clamp to avoid blow-up on flicks
const DT_CAP = 1.5;

// thin-film palette stops. cursor splats a color sampled at a slowly
// drifting hue, so trails laid down at different times mix and curl
// through each other.
const FILM_COLORS: Array<[number, number, number]> = [
  [60, 130, 230], // petrol blue
  [70, 200, 230], // cyan
  [140, 240, 180], // jade
  [240, 220, 110], // amber
  [240, 130, 180], // rose
  [180, 110, 240], // violet
];

function sampleColor(t: number): [number, number, number] {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * FILM_COLORS.length;
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = FILM_COLORS[i];
  const b = FILM_COLORS[(i + 1) % FILM_COLORS.length];
  return [
    (a[0] + (b[0] - a[0]) * f) / 255,
    (a[1] + (b[1] - a[1]) * f) / 255,
    (a[2] + (b[2] - a[2]) * f) / 255,
  ];
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function OilFilmRipple() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const finePointer = window.matchMedia("(pointer: fine) and (hover: hover)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (finePointer.matches && !reducedMotion.matches) setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // tiny intrinsic resolution; css upscales bilinearly to viewport.
    canvas.width = GRID_W;
    canvas.height = GRID_H;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const vx = new Float32Array(GRID_SIZE);
    const vy = new Float32Array(GRID_SIZE);
    const vx2 = new Float32Array(GRID_SIZE);
    const vy2 = new Float32Array(GRID_SIZE);
    const dR = new Float32Array(GRID_SIZE);
    const dG = new Float32Array(GRID_SIZE);
    const dB = new Float32Array(GRID_SIZE);
    const dR2 = new Float32Array(GRID_SIZE);
    const dG2 = new Float32Array(GRID_SIZE);
    const dB2 = new Float32Array(GRID_SIZE);
    const curl = new Float32Array(GRID_SIZE);

    const imageData = ctx.createImageData(GRID_W, GRID_H);
    const imgBuf = imageData.data;

    let raf = 0;
    let running = false;
    // separate cell sizes per axis - this is the offset fix.
    let cellW = 16;
    let cellH = 16;
    let lastFrameMs = 0;
    let lastX = -1;
    let lastY = -1;
    let lastMoveMs = 0;

    const resize = () => {
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      cellW = viewW / GRID_W;
      cellH = viewH / GRID_H;
    };

    const splat = (
      worldX: number,
      worldY: number,
      dvx: number,
      dvy: number,
      dr: number,
      dg: number,
      db: number,
    ) => {
      const gx = worldX / cellW;
      const gy = worldY / cellH;
      const r = Math.max(VEL_SPLAT_RADIUS, DYE_SPLAT_RADIUS);
      const i0 = Math.max(0, Math.floor(gx - r));
      const i1 = Math.min(GRID_W - 1, Math.ceil(gx + r));
      const j0 = Math.max(0, Math.floor(gy - r));
      const j1 = Math.min(GRID_H - 1, Math.ceil(gy + r));
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
            const dF = Math.exp(-dSq * DYE_FALLOFF_K);
            // SATURATING ADD - this is what kills the slow-drag stacking.
            // formula: new = old + delta * (1 - old/MAX). asymptotically
            // approaches MAX but never exceeds it, so a stationary cursor
            // settles at a stable brightness instead of going nuclear.
            const ar = dr * dF * DYE_SPLAT_INTENSITY;
            const ag = dg * dF * DYE_SPLAT_INTENSITY;
            const ab = db * dF * DYE_SPLAT_INTENSITY;
            dR[idx] = dR[idx] + ar * (1 - dR[idx] / DYE_MAX);
            dG[idx] = dG[idx] + ag * (1 - dG[idx] / DYE_MAX);
            dB[idx] = dB[idx] + ab * (1 - dB[idx] / DYE_MAX);
          }
        }
      }
    };

    // VORTICITY CONFINEMENT - the secret sauce. without this, advection
    // alone smooths all rotation away. with it, small whirls get
    // amplified into persistent visible eddies.
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

    // semi-lagrangian advection of velocity AND dye in one pass.
    const advectAll = (dt: number) => {
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
            vx[i00] * w00 + vx[i10] * w10 + vx[i01] * w01 + vx[i11] * w11;
          vy2[idx] =
            vy[i00] * w00 + vy[i10] * w10 + vy[i01] * w01 + vy[i11] * w11;
          dR2[idx] =
            dR[i00] * w00 + dR[i10] * w10 + dR[i01] * w01 + dR[i11] * w11;
          dG2[idx] =
            dG[i00] * w00 + dG[i10] * w10 + dG[i01] * w01 + dG[i11] * w11;
          dB2[idx] =
            dB[i00] * w00 + dB[i10] * w10 + dB[i01] * w01 + dB[i11] * w11;
        }
      }
      vx.set(vx2);
      vy.set(vy2);
      dR.set(dR2);
      dG.set(dG2);
      dB.set(dB2);
    };

    const decayFields = () => {
      for (let i = 0; i < GRID_SIZE; i++) {
        vx[i] *= VEL_DECAY;
        vy[i] *= VEL_DECAY;
        dR[i] *= DYE_DECAY;
        dG[i] *= DYE_DECAY;
        dB[i] *= DYE_DECAY;
      }
    };

    const renderDye = () => {
      for (let i = 0; i < GRID_SIZE; i++) {
        const r = dR[i];
        const g = dG[i];
        const b = dB[i];
        const mag = r > g ? (r > b ? r : b) : g > b ? g : b;
        const p = i * 4;
        imgBuf[p] = r > 1 ? 255 : (r * 255) | 0;
        imgBuf[p + 1] = g > 1 ? 255 : (g * 255) | 0;
        imgBuf[p + 2] = b > 1 ? 255 : (b * 255) | 0;
        const a = mag * 1.25;
        imgBuf[p + 3] = a > 1 ? 255 : (a * 255) | 0;
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
      const now = performance.now();
      const x = e.clientX;
      const y = e.clientY;
      if (lastX < 0) {
        lastX = x;
        lastY = y;
        lastMoveMs = now;
        return;
      }
      const dx = x - lastX;
      const dy = y - lastY;
      const dist = Math.hypot(dx, dy);
      if (dist < 1.5) return;
      const dt = Math.max(8, now - lastMoveMs);
      // pointer velocity -> cells per simulation frame, clamped so a hard
      // flick doesn't blow the sim up.
      let cellsPerFrameX = ((dx / dt) * (1000 / 60)) / cellW;
      let cellsPerFrameY = ((dy / dt) * (1000 / 60)) / cellH;
      cellsPerFrameX = clamp(cellsPerFrameX, -MAX_INJECT_VEL, MAX_INJECT_VEL);
      cellsPerFrameY = clamp(cellsPerFrameY, -MAX_INJECT_VEL, MAX_INJECT_VEL);

      const hue = (now * 0.00012) % 1;
      const [r, g, b] = sampleColor(hue);

      // splat along path so fast moves don't leave gaps.
      const steps = Math.min(6, Math.max(1, Math.ceil(dist / 16)));
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
      curl.fill(0);
      lastX = -1;
      lastY = -1;
    };

    const loop = (now: number) => {
      const dtMs = Math.min(48, now - lastFrameMs);
      lastFrameMs = now;
      const dt = Math.min(DT_CAP, dtMs / 16.67);

      applyVorticity(dt);
      advectAll(dt);
      decayFields();
      renderDye();

      let energy = 0;
      for (let i = 0; i < GRID_SIZE; i++) {
        energy += dR[i] + dG[i] + dB[i];
        if (energy > 0.3) break;
      }
      if (energy < 0.3) {
        ctx.clearRect(0, 0, GRID_W, GRID_H);
        running = false;
        raf = 0;
        return;
      }
      raf = window.requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70]"
      style={{
        // intrinsic canvas (128x80) css-scaled independently on each axis
        // to fill the viewport. browser bilinear upscale fuses the cells
        // into a continuous fluid sheet for free.
        width: "100vw",
        height: "100vh",
        opacity: 0.95,
        mixBlendMode: "screen",
        // less blur than before; let the swirls have actual detail.
        filter: "blur(3px) saturate(1.6) contrast(1.15)",
        imageRendering: "auto",
      }}
    />
  );
}
