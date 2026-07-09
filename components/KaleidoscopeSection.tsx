"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  // skip the heavy infinity-mirror scene on touch devices. mounting it on a
  // phone gives a long blank load + low fps. we also lose the scroll-driven
  // morph context which only reads well at desktop scale.
  const [hideOnTouch, setHideOnTouch] = useState(false);
  useEffect(() => {
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    setHideOnTouch(coarse);
  }, []);

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
    let running = false;
    let lastMorph = -1;
    // one settle pass (no scheduling) so mount/enter isn't stuck at default.
    const step = () => {
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
    };
    const tick = () => {
      step();
      raf = requestAnimationFrame(tick);
    };
    const startTick = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stopTick = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    // settle once on mount so the clip-path is correct before the IO fires.
    step();
    // io-gate the rAF: 720vh section, off-screen most of the time. wide
    // rootMargin keeps it warm a viewport early so the morph isn't stale.
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([e]) => {
              if (e.isIntersecting) {
                step();
                startTick();
              } else {
                stopTick();
              }
            },
            { rootMargin: "100% 0px" },
          )
        : null;
    if (io) io.observe(section);
    else startTick();
    return () => {
      io?.disconnect();
      stopTick();
    };
  }, [reduced]);

  if (hideOnTouch) return null;

  return (
    <div className="pb-16 sm:pb-24">
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
    </div>
  );
}
