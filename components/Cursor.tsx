"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Minimal custom cursor - a small dot + a larger lagging ring that scales
 * up when hovering interactive elements. Hidden on touch devices. This is
 * deliberately understated so it can be re-skinned during the art-direction
 * pass without ripping out the primitive.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(hover: none)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (isTouch || reduced) return;
    setEnabled(true);

    let dotX = window.innerWidth / 2;
    let dotY = window.innerHeight / 2;
    let ringX = dotX;
    let ringY = dotY;
    let targetX = dotX;
    let targetY = dotY;
    let hovering = false;
    // hover envelope 0..1. damped toward 1 on hover, 0 otherwise, so the ring
    // size + opacity sweep instead of snapping. replaces the previous css
    // `transition-[width,height,opacity]` which felt mechanical against the
    // smooth scroll + scene motion.
    let hoverProgress = 0;
    let lastTarget: EventTarget | null = null;
    let frame = 0;
    let running = false;
    let lastNow = 0;

    // ring size envelope. idle = 32px, hover = 48px. opacity idle 0.6, hover 1.
    const RING_IDLE = 32;
    const RING_HOVER = 48;
    const OPACITY_IDLE = 0.6;
    const OPACITY_HOVER = 1.0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 1 / 60);
      lastNow = now;
      dotX += (targetX - dotX) * 0.6;
      dotY += (targetY - dotY) * 0.6;
      ringX += (targetX - ringX) * 0.15;
      ringY += (targetY - ringY) * 0.15;

      const hoverTarget = hovering ? 1 : 0;
      // damp factor tuned so hover swells in ~140ms and relaxes in ~180ms.
      const k = 1 - Math.exp(-dt * 11);
      hoverProgress += (hoverTarget - hoverProgress) * k;

      const ringSize = RING_IDLE + (RING_HOVER - RING_IDLE) * hoverProgress;
      const ringOpacity =
        OPACITY_IDLE + (OPACITY_HOVER - OPACITY_IDLE) * hoverProgress;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        const r = ringRef.current;
        r.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
        r.style.width = `${ringSize}px`;
        r.style.height = `${ringSize}px`;
        r.style.opacity = ringOpacity.toFixed(3);
      }

      const settled =
        Math.abs(targetX - dotX) < 0.1 &&
        Math.abs(targetY - dotY) < 0.1 &&
        Math.abs(targetX - ringX) < 0.1 &&
        Math.abs(targetY - ringY) < 0.1 &&
        Math.abs(hoverTarget - hoverProgress) < 0.001;

      if (settled) {
        running = false;
        frame = 0;
        lastNow = 0;
        return;
      }

      frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (e.target !== lastTarget) {
        lastTarget = e.target;
        const el = e.target as HTMLElement | null;
        const next = !!el?.closest(
          "a, button, [data-hoverable], input, textarea, select, label",
        );
        if (next !== hovering) {
          hovering = next;
          if (ringRef.current) {
            ringRef.current.dataset.hover = String(hovering);
          }
        }
        // surface the nearest data-stage so the ring color can flip when the
        // pointer is over a dark stage section. ascend the dom looking for the
        // attribute; fall back to "light".
        const stageEl = el?.closest("[data-stage]") as HTMLElement | null;
        const stage = stageEl?.dataset.stage === "dark" ? "dark" : "light";
        if (ringRef.current && ringRef.current.dataset.stage !== stage) {
          ringRef.current.dataset.stage = stage;
        }
        if (dotRef.current && dotRef.current.dataset.stage !== stage) {
          dotRef.current.dataset.stage = stage;
        }
      }

      if (!running) {
        running = true;
        frame = requestAnimationFrame(loop);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        data-stage="light"
        className="pointer-events-none fixed left-0 top-0 z-[10000] h-1.5 w-1.5 rounded-full data-[stage=light]:bg-[var(--color-accent)] data-[stage=light]:mix-blend-difference data-[stage=dark]:bg-white"
      />
      <div
        ref={ringRef}
        aria-hidden
        data-hover="false"
        data-stage="light"
        className="pointer-events-none fixed left-0 top-0 z-[9999] rounded-full border border-[var(--color-line-strong)] transition-[border-color] duration-200 ease-out data-[stage=dark]:border-[var(--color-line-invert-strong)]"
        style={{ width: "32px", height: "32px", opacity: 0.6 }}
      />
    </>
  );
}
