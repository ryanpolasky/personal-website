// CPU port of PavelDoGreat's WebGL fluid simulation, kept free of DOM/React
// so it runs identically in the worker and the main-thread fallback.

export type TierConfig = {
  gridW: number;
  gridH: number;
  pressureIters: number;
};

export type Palette = Array<[number, number, number]>;

// per-second dissipation rates: velocity bleeds slower than dye.
const VEL_DISSIPATION = 0.2;
const DYE_DISSIPATION = 1.0;
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

// hue offset from the accent + (S, V) per stop, spanning a tight ±25° arc.
const PALETTE_STOPS: Array<[number, number, number]> = [
  [-0.07, 0.95, 0.88],
  [-0.04, 0.95, 0.96],
  [0.0, 0.95, 0.9],
  [0.02, 0.92, 0.96],
  [0.05, 0.92, 0.88],
  [0.07, 0.9, 0.93],
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

function hsvToRgb(hue: number, s: number, v: number): [number, number, number] {
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

export function buildPalette(accentHex: string): Palette {
  const [baseHue] = hexToHsv(accentHex);
  return PALETTE_STOPS.map(([dh, s, v]) => {
    const hh = (((baseHue + dh) % 1) + 1) % 1;
    return hsvToRgb(hh, s, v);
  });
}

function sampleColor(palette: Palette, t: number): [number, number, number] {
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

export type FluidSim = {
  pointerMove(
    x: number,
    y: number,
    width: number,
    height: number,
    t: number,
  ): void;
  pointerLeave(): void;
  setPalette(palette: Palette): void;
  clear(): void;
  destroy(): void;
};

type FrameScheduler = (cb: (now: number) => void) => number;

const scheduleFrame: FrameScheduler =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number;
const cancelFrame: (id: number) => void =
  typeof cancelAnimationFrame === "function"
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id);

export function createFluidSim(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cfg: TierConfig,
  initialPalette: Palette,
  onFrame?: () => void,
): FluidSim {
  const GRID_W = cfg.gridW;
  const GRID_H = cfg.gridH;
  const GRID_SIZE = GRID_W * GRID_H;
  const PRESSURE_ITERS = cfg.pressureIters;

  let palette = initialPalette;

  let vx = new Float32Array(GRID_SIZE);
  let vy = new Float32Array(GRID_SIZE);
  let vx2 = new Float32Array(GRID_SIZE);
  let vy2 = new Float32Array(GRID_SIZE);
  // premultiplied dye: dR/dG/dB store color*alpha, dA stores alpha.
  let dR = new Float32Array(GRID_SIZE);
  let dG = new Float32Array(GRID_SIZE);
  let dB = new Float32Array(GRID_SIZE);
  let dA = new Float32Array(GRID_SIZE);
  let dR2 = new Float32Array(GRID_SIZE);
  let dG2 = new Float32Array(GRID_SIZE);
  let dB2 = new Float32Array(GRID_SIZE);
  let dA2 = new Float32Array(GRID_SIZE);
  const curl = new Float32Array(GRID_SIZE);
  const divergence = new Float32Array(GRID_SIZE);
  let pressure = new Float32Array(GRID_SIZE);
  let pressure2 = new Float32Array(GRID_SIZE);

  const imageData = ctx.createImageData(GRID_W, GRID_H);
  const imgBuf = imageData.data;

  let raf = 0;
  let running = false;
  let cellW = 16;
  let cellH = 16;
  let lastFrameMs = 0;
  let lastX = -1;
  let lastY = -1;
  let lastMoveMs = 0;

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
          // alpha-gated injection: saturated cells keep their color.
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

  // vorticity confinement: re-injects rotational energy that bilinear
  // advection smooths away.
  const applyVorticity = (dt: number) => {
    for (let j = 1; j < GRID_H - 1; j++) {
      for (let i = 1; i < GRID_W - 1; i++) {
        const idx = j * GRID_W + i;
        const dvy_dx = (vy[idx + 1] - vy[idx - 1]) * 0.5;
        const dvx_dy = (vx[idx + GRID_W] - vx[idx - GRID_W]) * 0.5;
        curl[idx] = dvy_dx - dvx_dy;
      }
    }
    for (let j = 1; j < GRID_H - 1; j++) {
      for (let i = 1; i < GRID_W - 1; i++) {
        const idx = j * GRID_W + i;
        const dwdx = (Math.abs(curl[idx + 1]) - Math.abs(curl[idx - 1])) * 0.5;
        const dwdy =
          (Math.abs(curl[idx + GRID_W]) - Math.abs(curl[idx - GRID_W])) * 0.5;
        const len = Math.sqrt(dwdx * dwdx + dwdy * dwdy) + 1e-5;
        const Nx = dwdx / len;
        const Ny = dwdy / len;
        vx[idx] += VORTICITY_STRENGTH * Ny * curl[idx] * dt;
        vy[idx] += -VORTICITY_STRENGTH * Nx * curl[idx] * dt;
      }
    }
  };

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

  // decay carried-over pressure; warm start for jacobi.
  const dissipatePressure = () => {
    for (let i = 0; i < GRID_SIZE; i++) {
      pressure[i] *= PRESSURE_DISSIPATION;
    }
  };

  // jacobi poisson solve for pressure, ping-ponging pressure/pressure2.
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
      // Neumann boundary: copy adjacent interior values to the edges.
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

  // subtract the pressure gradient -> divergence-free velocity.
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

  // semi-lagrangian advection with time-correct decay folded in.
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
    let tmp = vx;
    vx = vx2;
    vx2 = tmp;
    tmp = vy;
    vy = vy2;
    vy2 = tmp;
    tmp = dR;
    dR = dR2;
    dR2 = tmp;
    tmp = dG;
    dG = dG2;
    dG2 = tmp;
    tmp = dB;
    dB = dB2;
    dB2 = tmp;
    tmp = dA;
    dA = dA2;
    dA2 = tmp;
  };

  const renderDye = () => {
    // de-premultiply: stored (R*A, G*A, B*A) -> displayed (R, G, B, A).
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
        imgBuf[p + 3] = a > 1 ? 255 : (a * 255) | 0;
      } else {
        imgBuf[p] = 0;
        imgBuf[p + 1] = 0;
        imgBuf[p + 2] = 0;
        imgBuf[p + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    onFrame?.();
  };

  const loop = (now: number) => {
    const dtMs = Math.min(48, now - lastFrameMs);
    lastFrameMs = now;
    const dt = Math.min(DT_CAP, dtMs / 16.67);
    const dtSec = dtMs / 1000;

    applyVorticity(dt);
    computeDivergence();
    dissipatePressure();
    jacobiPressure();
    subtractGradient();
    advectAll(dt, dtSec);
    renderDye();

    // stop the loop once the dye has fully faded.
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
    raf = scheduleFrame(loop);
  };

  const ensureRunning = () => {
    if (running) return;
    running = true;
    lastFrameMs = performance.now();
    raf = scheduleFrame(loop);
  };

  return {
    pointerMove(x, y, width, height, t) {
      cellW = width / GRID_W;
      cellH = height / GRID_H;
      if (lastX < 0) {
        lastX = x;
        lastY = y;
        lastMoveMs = t;
        return;
      }
      const dx = x - lastX;
      const dy = y - lastY;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.05) return;
      const dt = Math.max(1, t - lastMoveMs);
      let cellsPerFrameX = ((dx / dt) * (1000 / 60)) / cellW;
      let cellsPerFrameY = ((dy / dt) * (1000 / 60)) / cellH;
      cellsPerFrameX = clamp(cellsPerFrameX, -MAX_INJECT_VEL, MAX_INJECT_VEL);
      cellsPerFrameY = clamp(cellsPerFrameY, -MAX_INJECT_VEL, MAX_INJECT_VEL);

      // speed maps to the dye ceiling: slow drags dim, fast flicks bright.
      const speed = (dist / dt) * 1000;
      const dyeCap = DYE_MAX * clamp(speed / 900, 0.035, 1);
      const hue = (t * 0.00012) % 1;
      const [r, g, b] = sampleColor(palette, hue);

      const steps = Math.min(18, Math.max(1, Math.ceil(dist / 18)));
      for (let i = 1; i <= steps; i++) {
        const tt = i / steps;
        splat(
          lastX + dx * tt,
          lastY + dy * tt,
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
      lastMoveMs = t;
      ensureRunning();
    },

    pointerLeave() {
      lastX = -1;
      lastY = -1;
    },

    setPalette(p) {
      palette = p;
    },

    clear() {
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
      ctx.clearRect(0, 0, GRID_W, GRID_H);
      onFrame?.();
      lastX = -1;
      lastY = -1;
      if (raf) {
        cancelFrame(raf);
        raf = 0;
      }
      running = false;
    },

    destroy() {
      if (raf) {
        cancelFrame(raf);
        raf = 0;
      }
      running = false;
    },
  };
}
