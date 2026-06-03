"use client";

import { useEffect, useState } from "react";

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

function scoreRenderer(renderer: string): number {
  if (!renderer) return 0;
  if (/swiftshader|software|llvmpipe|basic render|warp/.test(renderer))
    return -3;
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
  const memory = nav.deviceMemory || 4;
  const renderer = readRenderer();

  let score = 2;

  if (nav.connection?.saveData) score -= 2;
  if (cores <= 2) score -= 2;
  else if (cores <= 4) score -= 1;
  else if (cores >= 8) score += 1;

  if (memory <= 2) score -= 2;
  else if (memory <= 4) score -= 1;
  else if (memory >= 8) score += 1;

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

export function usePerformanceTier(
  reducedMotion = false,
  active = true,
): PerformanceTier {
  const [tier, setTier] = useState<PerformanceTier>("low");

  useEffect(() => {
    setTier(detectTier(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    if (
      reducedMotion ||
      !active ||
      tier === "low" ||
      queryOverride() ||
      typeof document === "undefined" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;

    const desktop = window.matchMedia(
      "(min-width: 1024px) and (pointer: fine)",
    );
    if (!desktop.matches) return;

    let cancelled = false;
    let raf = 0;
    let timer = 0;
    const warmupMs = 5600;
    const sampleMs = 5200;

    const startSampling = () => {
      timer = window.setTimeout(() => {
        if (
          cancelled ||
          document.visibilityState === "hidden" ||
          !desktop.matches
        )
          return;

        let frames = 0;
        let start = 0;
        let last = 0;
        let slowFrames = 0;
        let verySlowFrames = 0;

        const tick = (time: number) => {
          if (cancelled) return;

          if (document.visibilityState === "hidden") {
            frames = 0;
            start = 0;
            last = 0;
            slowFrames = 0;
            verySlowFrames = 0;
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
          if (rawDelta > 120) {
            frames = 0;
            start = time;
            slowFrames = 0;
            verySlowFrames = 0;
            raf = window.requestAnimationFrame(tick);
            return;
          }

          frames += 1;
          if (rawDelta > 25) slowFrames += 1;
          if (rawDelta > 38) verySlowFrames += 1;

          const elapsed = time - start;
          if (elapsed >= sampleMs && frames >= 120) {
            const fps = (frames * 1000) / Math.max(1, elapsed);
            const slowRatio = slowFrames / Math.max(1, frames);
            const verySlowRatio = verySlowFrames / Math.max(1, frames);

            setTier((current) => {
              if (current === "low") return current;
              if (fps < 44 && slowRatio > 0.28) return downgradeTier(current);
              if (fps < 52 && verySlowRatio > 0.16)
                return downgradeTier(current);
              return current;
            });
            return;
          }
          raf = window.requestAnimationFrame(tick);
        };
        raf = window.requestAnimationFrame(tick);
      }, warmupMs);
    };

    if (document.readyState === "complete") {
      startSampling();
    } else {
      window.addEventListener("load", startSampling, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", startSampling);
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
    };
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
