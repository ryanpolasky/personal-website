"use client";

import { useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/scroll";

// InfinityMirrorBoxView is the heaviest scene; dynamic-import keeps it out
// of the initial bundle and skips SSR for a client-only canvas.
const InfinityMirrorBoxView = dynamic(
  () =>
    import("@/components/scenes/InfinityMirrorBoxView").then((m) => ({
      default: m.InfinityMirrorBoxView,
    })),
  { ssr: false },
);

// inset→fullscreen morph driven via clip-path so the R3F canvas's layout
// box stays constant - morphing width/height triggers per-frame WebGL
// renderer reallocation, which stalls during scroll.

export function KaleidoscopeSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    // un-morphed (card) inset values, fed into clip-path inset().
    const insetX = () =>
      window.innerWidth >= 1024 ? 112 : window.innerWidth >= 640 ? 64 : 24;
    const insetTop = () =>
      window.innerWidth >= 1024 ? 128 : window.innerWidth >= 640 ? 80 : 36;
    const insetBottom = () =>
      window.innerWidth >= 1024 ? 128 : window.innerWidth >= 640 ? 80 : 36;

    if (reduced) {
      // freeze at fullscreen: zero inset everywhere, no rounding, no edge.
      stage.style.setProperty("--ks-clip-x", "0px");
      stage.style.setProperty("--ks-clip-top", "0px");
      stage.style.setProperty("--ks-clip-bottom", "0px");
      stage.style.setProperty("--ks-radius", "0px");
      stage.style.setProperty("--ks-edge-opacity", "0");
      return;
    }

    let raf = 0;
    let lastMorph = -1;
    const tick = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // entry: 0→1 as section.top travels vh→0. exit: 1→0 as section.bottom
      // travels vh→0. min() caps both edges so the card shrinks back on exit.
      const entry = Math.max(0, Math.min(1, (vh - rect.top) / vh));
      const exitProg = Math.max(0, Math.min(1, rect.bottom / vh));
      const morph = Math.min(entry, exitProg);
      if (Math.abs(morph - lastMorph) > 1 / 600) {
        lastMorph = morph;
        const ix = insetX();
        const it = insetTop();
        const ib = insetBottom();
        const inv = 1 - morph;
        stage.style.setProperty("--ks-clip-x", `${inv * ix}px`);
        stage.style.setProperty("--ks-clip-top", `${inv * it}px`);
        stage.style.setProperty("--ks-clip-bottom", `${inv * ib}px`);
        stage.style.setProperty("--ks-radius", `${inv * 28}px`);
        stage.style.setProperty("--ks-edge-opacity", `${inv}`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      data-kaleidoscope-tunnel
      data-snap
      className="relative h-[720vh]"
      aria-label="chamber"
    >
      <div
        ref={stageRef}
        data-kaleidoscope-stage
        data-stage="dark"
        className="stage sticky w-full"
        style={{
          // constant layout box; clip-path is the morph (gpu composite only).
          top: 0,
          height: "100svh",
          borderRadius: "var(--ks-radius, 28px)",
          clipPath:
            "inset(var(--ks-clip-top, 128px) var(--ks-clip-x, 112px) var(--ks-clip-bottom, 128px) var(--ks-clip-x, 112px) round var(--ks-radius, 28px))",
          WebkitClipPath:
            "inset(var(--ks-clip-top, 128px) var(--ks-clip-x, 112px) var(--ks-clip-bottom, 128px) var(--ks-clip-x, 112px) round var(--ks-radius, 28px))",
        }}
      >
        <InfinityMirrorBoxView className="pointer-events-auto absolute inset-0" />
        {/* edge tracks the clip-path so the rim hugs the visible card. */}
        <div
          className="stage-edge"
          aria-hidden
          style={{
            inset:
              "var(--ks-clip-top, 128px) var(--ks-clip-x, 112px) var(--ks-clip-bottom, 128px) var(--ks-clip-x, 112px)",
            borderRadius: "var(--ks-radius, 28px)",
            opacity: "var(--ks-edge-opacity, 1)",
          }}
        />
      </div>
    </section>
  );
}
