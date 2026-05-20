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

  return clampTier(score);
}

export function usePerformanceTier(reducedMotion = false): PerformanceTier {
  const [tier, setTier] = useState<PerformanceTier>("low");

  useEffect(() => {
    setTier(detectTier(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || queryOverride() || typeof document === "undefined")
      return;

    let cancelled = false;
    let raf = 0;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      let frames = 0;
      let start = 0;
      const tick = (time: number) => {
        if (cancelled) return;
        if (start === 0) start = time;
        frames += 1;
        if (frames >= 90) {
          const fps = (frames * 1000) / Math.max(1, time - start);
          setTier((current) => {
            if (fps < 34) return "low";
            if (fps < 48) return downgradeTier(current);
            return current;
          });
          return;
        }
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    }, 2200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

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
