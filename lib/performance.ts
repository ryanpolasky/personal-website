"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type PerformanceTier = "low" | "medium" | "high";

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

function clampTier(score: number): PerformanceTier {
  if (score >= 3) return "high";
  if (score >= 1) return "medium";
  return "low";
}

function downgradeTier(tier: PerformanceTier): PerformanceTier {
  if (tier === "high") return "medium";
  return "low";
}

function queryOverride(): PerformanceTier | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("perf");
  if (value === "low" || value === "medium" || value === "high") return value;
  return null;
}

// software / no-GPU rasterizers (SwiftShader, llvmpipe, WARP a.k.a. "Microsoft
// Basic Render Driver") run WebGL on the CPU. scoreRenderer penalizes these
// hard so detectTier drops them to the lowest tier up front.
const SOFTWARE_RENDERER_RE =
  /swiftshader|software|llvmpipe|basic render|microsoft basic|warp/;

let cachedRenderer: string | null = null;

function readRenderer(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "";
    const webgl = gl as WebGLRenderingContext;
    const debugInfo = webgl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "";
    return String(
      webgl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "",
    ).toLowerCase();
  } catch {
    return "";
  }
}

// the GL probe returns the same string every call, so create the throwaway
// context once and reuse it across detection passes.
function getRenderer(): string {
  if (cachedRenderer === null) cachedRenderer = readRenderer();
  return cachedRenderer;
}

// apple silicon (TBDR, unified memory) is disproportionately slow at MSAA
// resolves, refraction/reflector FBOs, and high-dpr fill vs a discrete GPU.
// scenes gate a lighter high-tier config on this; non-apple stays identical.
export function isAppleGPU(): boolean {
  if (typeof window === "undefined") return false;
  return getRenderer().includes("apple");
}

function scoreRenderer(renderer: string): number {
  if (!renderer) return 0;
  if (SOFTWARE_RENDERER_RE.test(renderer)) return -3;
  if (
    /rtx|geforce|quadro|radeon rx|radeon pro|apple m[1-9]|apple gpu/.test(
      renderer,
    )
  )
    return 1;
  if (/intel|uhd|iris|hd graphics|vega|mesa|adreno|mali/.test(renderer))
    return -1;
  return 0;
}

function detectTier(reducedMotion: boolean): PerformanceTier {
  const override = queryOverride();
  if (override) return override;
  if (reducedMotion) return "low";

  // coarse pointer = touch device. unconditionally low-tier, no matter what
  // the cpu/gpu hints say. this catches real phones AND chrome dev tools
  // mobile emulation (which exposes the laptop's hardware specs but flips
  // pointer to coarse). the per-scene visuals already have coarse-only paths
  // (kaleido off, ribbon css fallback, fewer R's) so forcing tier=low here
  // also brings the particle count down to where it should be.
  const coarse =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  if (coarse) return "low";

  const nav = navigator as NavigatorHints;
  const ua = navigator.userAgent.toLowerCase();
  const cores = navigator.hardwareConcurrency || 4;
  const memory = nav.deviceMemory;
  const renderer = getRenderer();

  let score = 2;

  if (nav.connection?.saveData) score -= 2;
  if (cores <= 2) score -= 2;
  else if (cores <= 4) score -= 1;
  else if (cores >= 8) score += 1;

  // deviceMemory is chrome-only. unknown is neutral: the old `|| 4` default
  // scored it as a 4gb box, which put m-series macs on medium in safari but
  // high in chrome for the same hardware.
  if (memory !== undefined) {
    if (memory <= 2) score -= 2;
    else if (memory <= 4) score -= 1;
    else if (memory >= 8) score += 1;
  }

  if (window.devicePixelRatio >= 2) score -= 1;
  if (ua.includes("windows") && cores <= 4) score -= 1;
  score += scoreRenderer(renderer);

  // narrow viewport (small laptop screens, split windows) still gets nudged
  // down even without coarse pointer.
  const vw = window.innerWidth || 1024;
  if (vw < 640) score -= 2;
  else if (vw < 1024) score -= 1;

  return clampTier(score);
}

// ssr / no-window default. the client detects synchronously in the state
// initializer below, so the first client render already carries the real
// tier and the canvas it mounts is created once, at the right quality. the
// old "start low, detect in an effect" flow built every scene twice: a
// low-tier webgl context + shaders + geometry, immediately torn down and
// rebuilt at the detected tier.
const DEFAULT_TIER: PerformanceTier = "high";

// ---------------------------------------------------------------------------
// shared runtime fps sampler. one rAF measurement for the page, not one per
// scene: every usePerformanceTier caller used to run its own copy of this
// loop, so with four canvases on screen the same frame timings were being
// measured four times, and each scene demoted itself independently. now the
// first active subscriber starts the sampler, the last one leaving stops it,
// and a demotion is a page-wide step (the machine is slow, not the scene).
// ---------------------------------------------------------------------------

type Listener = () => void;
// 0 = as detected, 1 = one step down, 2 = floor.
let sharedDowngrades = 0;
const downgradeListeners = new Set<Listener>();
let samplerSubscribers = 0;
let stopSampler: (() => void) | null = null;

function applyDowngrades(tier: PerformanceTier, steps: number): PerformanceTier {
  let t = tier;
  for (let i = 0; i < steps && t !== "low"; i++) t = downgradeTier(t);
  return t;
}

function setDowngrades(next: number) {
  const clamped = Math.min(2, Math.max(sharedDowngrades, next));
  if (clamped === sharedDowngrades) return;
  sharedDowngrades = clamped;
  downgradeListeners.forEach((l) => l());
}

function subscribeDowngrades(listener: Listener) {
  downgradeListeners.add(listener);
  return () => downgradeListeners.delete(listener);
}
const getDowngrades = () => sharedDowngrades;
const getServerDowngrades = () => 0;

function startSampler(): () => void {
  const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
  let cancelled = false;
  let raf = 0;
  let timer = 0;
  const warmupMs = 5600;
  const sampleMs = 5200;
  // why a slow box never used to get demoted: the old code reset the whole
  // sample on any frame >120ms AND required >=120 frames to evaluate. a
  // GPU-less PC throws constant >120ms frames (endless resets) and can't hit
  // 120 frames in 5.2s anyway (that needs ~23fps), so the downgrade branch
  // was literally unreachable for the machines it existed to catch. now slow
  // frames are kept, and 48 frames over >=5.2s is enough to judge fps.
  const minFrames = 48;

  const finish = () => {
    stopSampler = null;
  };

  const startSampling = () => {
    timer = window.setTimeout(() => {
      if (cancelled || document.visibilityState === "hidden" || !desktop.matches) {
        finish();
        return;
      }

      let frames = 0;
      let start = 0;
      let last = 0;
      let slowFrames = 0;
      let verySlowFrames = 0;
      let slowStreak = 0;

      const tick = (time: number) => {
        if (cancelled) return;

        if (document.visibilityState === "hidden") {
          frames = 0;
          start = 0;
          last = 0;
          slowFrames = 0;
          verySlowFrames = 0;
          slowStreak = 0;
          raf = window.requestAnimationFrame(tick);
          return;
        }

        if (start === 0) {
          start = time;
          last = time;
          raf = window.requestAnimationFrame(tick);
          return;
        }

        const rawDelta = time - last;
        last = time;

        // fast path to the floor: a run of sub-~8fps frames is a box that
        // genuinely can't render the scene. counted before the stall-skip
        // below so even huge frames feed it; a one-off hitch is a single
        // spike that resets well before the streak threshold.
        if (rawDelta > 120) {
          slowStreak += 1;
          if (slowStreak >= 6) {
            finish();
            setDowngrades(2);
            return;
          }
        } else {
          slowStreak = 0;
        }

        // drop a genuine multi-second stall (tab restore, alert) out of the
        // averaged window so it can't skew the fps math.
        if (rawDelta > 650) {
          start += rawDelta;
          raf = window.requestAnimationFrame(tick);
          return;
        }

        frames += 1;
        if (rawDelta > 25) slowFrames += 1;
        if (rawDelta > 38) verySlowFrames += 1;

        const elapsed = time - start;
        if (elapsed >= sampleMs && frames >= minFrames) {
          const fps = (frames * 1000) / Math.max(1, elapsed);
          const slowRatio = slowFrames / Math.max(1, frames);
          const verySlowRatio = verySlowFrames / Math.max(1, frames);
          finish();
          if (
            (fps < 44 && slowRatio > 0.28) ||
            (fps < 52 && verySlowRatio > 0.16)
          ) {
            setDowngrades(sharedDowngrades + 1);
          }
          return;
        }
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    }, warmupMs);
  };

  if (document.readyState === "complete") startSampling();
  else window.addEventListener("load", startSampling, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", startSampling);
    window.clearTimeout(timer);
    window.cancelAnimationFrame(raf);
    finish();
  };
}

// refcounted: the sampler runs while at least one eligible scene is
// subscribed. a completed sample (with or without a demotion) stops it; the
// next subscription change starts a fresh one, which is how a second step
// down can still happen after the first (subscribers re-run on tier change).
function acquireSampler(): () => void {
  samplerSubscribers += 1;
  if (!stopSampler) stopSampler = startSampler();
  return () => {
    samplerSubscribers -= 1;
    if (samplerSubscribers === 0 && stopSampler) {
      stopSampler();
      stopSampler = null;
    }
  };
}

export function usePerformanceTier(
  reducedMotion = false,
  active = true,
): PerformanceTier {
  const [detected, setDetected] = useState<PerformanceTier>(() =>
    typeof window === "undefined" ? DEFAULT_TIER : detectTier(reducedMotion),
  );

  // re-detect when reduced-motion resolves/flips after mount (useReducedMotion
  // reads matchMedia in an effect). on mount this is a no-op: same value as
  // the initializer, so react bails out without a re-render.
  useEffect(() => {
    setDetected(detectTier(reducedMotion));
  }, [reducedMotion]);

  const downgrades = useSyncExternalStore(
    subscribeDowngrades,
    getDowngrades,
    getServerDowngrades,
  );
  // overrides and hard gates (reduced motion, coarse pointer) are absolute;
  // the runtime sampler only ever lowers a heuristically detected tier.
  const tier =
    queryOverride() || detected === "low"
      ? detected
      : applyDowngrades(detected, downgrades);

  useEffect(() => {
    if (
      reducedMotion ||
      !active ||
      tier === "low" ||
      queryOverride() ||
      typeof document === "undefined" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches
    )
      return;
    return acquireSampler();
  }, [active, reducedMotion, tier]);

  return tier;
}

export function tierDpr(
  tier: PerformanceTier,
  highMax = 1.5,
  mediumMax = 1.15,
  lowMax = 1,
): [number, number] {
  if (tier === "high") return [1, highMax];
  if (tier === "medium") return [0.9, mediumMax];
  return [0.75, lowMax];
}

export function isLowTier(tier: PerformanceTier): boolean {
  return tier === "low";
}
