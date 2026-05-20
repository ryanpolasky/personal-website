"use client";

import { useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/scroll";

// InfinityMirrorBoxView is the heaviest scene in the app (MeshReflectorMaterial
// + Bloom + ChromaticAberration + Vignette + postprocessing). dynamic-import
// with ssr:false splits its chunk out of the initial bundle and skips wasted
// SSR work for a client-only canvas.
const InfinityMirrorBoxView = dynamic(
  () =>
    import("@/components/scenes/InfinityMirrorBoxView").then((m) => ({
      default: m.InfinityMirrorBoxView,
    })),
  { ssr: false },
);

// kaleidoscope section: a tall scroll-driven tunnel section whose inner sticky
// stage morphs from inset-rounded card to edge-to-edge fullscreen as it enters,
// mirroring the visual contract used by the projects rail. the WebGL canvas
// inside reads `data-kaleidoscope-tunnel` to derive its own progress for the
// camera dolly + chamber animation.
//
// the morph (inset → fullscreen) is driven by clip-path + a plain rAF loop.
// the stage's layout box stays at a constant 100vw × 100svh; only the
// visible region changes via clip-path. this is critical: previous versions
// morphed the stage's actual width/height/margins, which caused the R3F
// canvas inside to resize every single frame during scroll. resizing the
// WebGL renderer + reallocating the postprocessing render targets every
// frame starved the browser's layout/paint pipeline, so the visible morph
// would stay stuck at the un-morphed size during active scroll and only
// "jump" to fullscreen once scroll stopped. clip-path is gpu compositing
// only, no layout reflow, no resize observer fires, no canvas reallocation.

export function KaleidoscopeSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    // picture-frame inset values for the UN-morphed (card) state. these now
    // feed clip-path inset() rather than margin/width, so they include the
    // section padding the old approach used to delegate to css.
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
      // entry morph: 0 → 1 as section.top travels from vh (just entering)
      // down to 0 (fully pinned at top). caps the rising edge.
      const entry = Math.max(0, Math.min(1, (vh - rect.top) / vh));
      // exit morph: 1 → 0 as section.bottom travels from vh (release) down
      // to 0 (section fully gone). caps the falling edge so the stage
      // shrinks back to its inset card form as the section exits, giving
      // visual separation before the next section morphs in.
      const exitProg = Math.max(0, Math.min(1, rect.bottom / vh));
      const morph = Math.min(entry, exitProg);
      // sub-frame morph changes (< 1/600) produce sub-pixel clip-path
      // changes that the browser can't visually distinguish, so skipping
      // them avoids unnecessary style invalidation when scroll is idle.
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
          // constant layout box: always full viewport, always pinned at
          // top. the clip-path below is what visually morphs between
          // picture-frame card and fullscreen. defaults match the
          // un-morphed picture-frame state so first paint doesn't flash.
          top: 0,
          height: "100svh",
          // .stage's class-level border-radius is overridden inline so
          // the layout box rounding tracks the morph (matters for the
          // stage-edge box-shadow which inherits radius for the soft
          // inner glow).
          borderRadius: "var(--ks-radius, 28px)",
          // the morph itself. inset shrinks all four sides toward zero
          // as the section pins, and the corner radius melts away. gpu
          // compositing only: no layout, no resize observers fire on
          // children, no canvas reallocation.
          clipPath:
            "inset(var(--ks-clip-top, 128px) var(--ks-clip-x, 112px) var(--ks-clip-bottom, 128px) var(--ks-clip-x, 112px) round var(--ks-radius, 28px))",
          WebkitClipPath:
            "inset(var(--ks-clip-top, 128px) var(--ks-clip-x, 112px) var(--ks-clip-bottom, 128px) var(--ks-clip-x, 112px) round var(--ks-radius, 28px))",
        }}
      >
        <InfinityMirrorBoxView className="pointer-events-auto absolute inset-0" />
        {/* stage-edge is repositioned inline to match the clip-path's
            inset, so the soft inner glow + 1px white rim land on the
            edges of the visible card (not on the full stage edges,
            which the clip-path has already hidden). edge opacity fades
            with morph so the rim doesn't sit at the viewport border
            during fullscreen. */}
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
