"use client";

import { useEffect, useRef, useState } from "react";
import { isAppleGPU, usePerformanceTier } from "@/lib/performance";
import { useAccent } from "@/components/AccentProvider";
import {
  buildPalette,
  createFluidSim,
  type FluidSim,
  type Palette,
  type TierConfig,
} from "./oil-film/fluidSim";
import type { WorkerInMessage, WorkerOutMessage } from "./oil-film/fluid.worker";

// Owns the gates (fine pointer / reduced motion / perf tier) and pointer
// plumbing; the sim itself (./oil-film/fluidSim.ts) runs in a worker when
// OffscreenCanvas is available, inline on the main thread otherwise.

type TierConfigMap = Record<"high" | "medium", TierConfig>;

// resolution + iteration budget per perf tier.
const TIER_CONFIG: TierConfigMap = {
  high: { gridW: 360, gridH: 225, pressureIters: 20 },
  medium: { gridW: 256, gridH: 160, pressureIters: 12 },
};

// lighter grid on apple GPUs.
const APPLE_HIGH_CONFIG: TierConfig = {
  gridW: 288,
  gridH: 180,
  pressureIters: 14,
};

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

  const tier = usePerformanceTier(reducedMotion, false);
  const enabled = finePointer && !reducedMotion && tier !== "low";

  // palette updates go through a ref so accent changes don't rebuild the sim.
  const accent = useAccent();
  const paletteRef = useRef<Palette>(buildPalette(accent.base));
  const pushPaletteRef = useRef<((palette: Palette) => void) | null>(null);
  useEffect(() => {
    paletteRef.current = buildPalette(accent.base);
    pushPaletteRef.current?.(paletteRef.current);
  }, [accent.base]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const cfg =
      tier === "high"
        ? isAppleGPU()
          ? APPLE_HIGH_CONFIG
          : TIER_CONFIG.high
        : TIER_CONFIG.medium;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = cfg.gridW;
    canvas.height = cfg.gridH;

    let worker: Worker | null = null;
    let sim: FluidSim | null = null;

    const bitmapCtx =
      typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"
        ? canvas.getContext("bitmaprenderer")
        : null;

    let pendingBitmap: ImageBitmap | null = null;
    let paintRaf = 0;

    if (bitmapCtx) {
      // paint the latest frame on the page's rAF so presentation stays
      // vsync-aligned regardless of the worker's frame cadence.
      const paint = () => {
        paintRaf = 0;
        if (pendingBitmap) {
          bitmapCtx.transferFromImageBitmap(pendingBitmap);
          pendingBitmap = null;
        }
      };
      worker = new Worker(new URL("./oil-film/fluid.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        if (e.data.type === "frame") {
          pendingBitmap?.close();
          pendingBitmap = e.data.bitmap;
          if (!paintRaf) paintRaf = requestAnimationFrame(paint);
        }
      };
      post({ type: "init", config: cfg, palette: paletteRef.current });
    } else {
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) return;
      sim = createFluidSim(ctx, cfg, paletteRef.current);
    }

    function post(msg: WorkerInMessage) {
      worker?.postMessage(msg);
    }

    pushPaletteRef.current = (palette) => {
      if (worker) post({ type: "palette", palette });
      else sim?.setPalette(palette);
    };

    let pointerAttached = false;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (document.visibilityState === "hidden") return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        if (worker) post({ type: "leave" });
        else sim?.pointerLeave();
        return;
      }
      const t = performance.now();
      if (worker) {
        post({ type: "move", x, y, width: rect.width, height: rect.height, t });
      } else {
        sim?.pointerMove(x, y, rect.width, rect.height, t);
      }
    };

    const clearSim = () => {
      if (worker) post({ type: "clear" });
      else sim?.clear();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      clearSim();
    };

    // pointer listener + sim only run while the hero is on screen.
    const attachPointer = () => {
      if (pointerAttached) return;
      pointerAttached = true;
      window.addEventListener("pointermove", onMove, { passive: true });
    };
    const detachPointer = () => {
      if (!pointerAttached) return;
      pointerAttached = false;
      window.removeEventListener("pointermove", onMove);
      clearSim();
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
      pushPaletteRef.current = null;
      if (paintRaf) cancelAnimationFrame(paintRaf);
      pendingBitmap?.close();
      worker?.terminate();
      sim?.destroy();
    };
  }, [enabled, tier]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // z-[40] floats above HeroStage's inner content (z-30) so screen-blend
      // can play over the headline + ctas.
      className="pointer-events-none absolute inset-0 z-[40]"
      style={{
        width: "100%",
        height: "100%",
        opacity: 0.55,
        mixBlendMode: "screen",
        filter: "blur(2.5px) saturate(1.55) contrast(1.18)",
        imageRendering: "auto",
      }}
    />
  );
}
