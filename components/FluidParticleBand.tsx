"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useIsVisible, useReducedMotion } from "@/lib/scroll";
import { MagneticButton } from "@/components/MagneticButton";
import type { PointerState } from "@/components/scenes/FluidParticleCanvas";

// fluid particle band, inspired by lusion.co's contact transition. roughly
// 1000 small white geometric shapes (squares, dots, plus signs, x marks)
// fall, pile up, and collide on an accent-colored stage. the cursor pushes
// them outward in a radial force field so it feels like dragging a finger
// through a sandbox of beads.
//
// the heavy three.js half (physics + r3f Canvas) lives in
// scenes/FluidParticleCanvas and is dynamic-imported with ssr:false so it
// stays out of the initial js chunk. this wrapper owns the section layout,
// the SEO-critical contact lockup (headline + cta + link row), and the
// window pointer wiring that feeds the canvas's physics loop via a shared
// ref. reduced-motion users get the static accent banner with no canvas.

const FluidParticleCanvas = dynamic(
  () => import("@/components/scenes/FluidParticleCanvas"),
  { ssr: false },
);

export function FluidParticleBand() {
  const reduced = useReducedMotion();
  const { ref: sectionRef, visible } = useIsVisible<HTMLElement>("1200px");
  const pointerRef = useRef<PointerState>({
    nx: 0,
    ny: 0,
    active: 0,
    target: 0,
    smoothX: 0,
    smoothY: 0,
    vx: 0,
    vy: 0,
    radius: 0,
    needsSync: false,
  });

  // pointer wiring on window so it tracks even when the cursor is hovering
  // the title overlay (which sits behind the canvas).
  useEffect(() => {
    if (reduced) return;
    const el = sectionRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      // guard against zero-area rects from in-flight layout reflows. without
      // this, dividing pointer x by rect.width=0 yields Infinity/NaN, which
      // then poisons pointer.nx → targetX → smoothX → cursorRadius and
      // ultimately every particle position. observed in the wild on page
      // refresh as "all particles disappear with site lag" (NaN-propagating
      // physics costs ~50x the cpu of valid math).
      if (rect.width <= 0 || rect.height <= 0) {
        pointerRef.current.target = 0;
        return;
      }
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) {
        pointerRef.current.target = 0;
        return;
      }

      const newNx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const newNy = (0.5 - (e.clientY - rect.top) / rect.height) * 2;
      if (!Number.isFinite(newNx) || !Number.isFinite(newNy)) {
        pointerRef.current.target = 0;
        return;
      }

      // if the pointer just entered the section (target was 0), snap the smooth
      // coords directly to the new coords. this prevents the cursor from
      // "streaking" in from off-screen, which calculates a massive artificial
      // velocity and blows up the pile.
      if (pointerRef.current.target === 0) {
        pointerRef.current.nx = newNx;
        pointerRef.current.ny = newNy;
        pointerRef.current.needsSync = true;
      } else {
        pointerRef.current.nx = newNx;
        pointerRef.current.ny = newNy;
      }
      pointerRef.current.target = 1;
    };

    const onLeave = () => {
      pointerRef.current.target = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [reduced, sectionRef]);

  return (
    <section
      ref={sectionRef}
      id="contact"
      data-snap
      className="relative w-full overflow-hidden"
      style={{ background: "var(--color-accent)" }}
      aria-label="contact"
    >
      <div className="relative h-[100dvh] min-h-[680px] w-full">
        {/* CONTACT LOCKUP - section index, headline, CTA, link row. sits at
            z-20 above the particle canvas so the button + links stay crisp
            and clickable; particles still flow visibly in the negative space
            around the column. previously this section's headline was buried
            by piling particles for a lusion-style effect, but with a real CTA
            on it now, function (legibility + conversion) wins over decoration. */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-7 px-6">
          <p
            className="text-[10.5px] uppercase tracking-[0.32em] text-white/85"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            04 - contact
          </p>
          <h2 className="display max-w-[14ch] text-center text-[clamp(3rem,10vw,9rem)] leading-[0.92] text-white">
            let&apos;s build
            <br />
            <span
              style={{
                fontStyle: "italic",
                fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
              }}
            >
              small things.
            </span>
          </h2>
          <MagneticButton
            href="mailto:ryanpolasky@hotmail.com"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-[14px] tracking-tight text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)]"
          >
            let&apos;s talk →
          </MagneticButton>
          {/* outlined glass pills - the bare-text version got chewed up by
              particles flowing behind it. each pill has its own border +
              translucent fill + backdrop blur so the text always reads as a
              distinct surface no matter how busy the simulation gets behind
              it. kept smaller (13px) than the CTA (14px) so the visual
              hierarchy still reads CTA > secondary links. */}
          <div
            className="mt-1 flex flex-wrap items-center justify-center gap-2.5 text-[13px] uppercase tracking-[0.22em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <a
              href="https://www.linkedin.com/in/ryan-polasky/"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white"
              data-hoverable
            >
              linkedin →
            </a>
            <a
              href="https://github.com/ryanpolasky"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white"
              data-hoverable
            >
              github →
            </a>
            <a
              href="/spotify.html"
              className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white"
              data-hoverable
            >
              spotify →
            </a>
            <a
              href="/assets/Ryan_Polasky_Resume.pdf"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white"
              data-hoverable
            >
              resume.pdf →
            </a>
          </div>
        </div>

        {/* PARTICLE CANVAS - z-5 behind the lockup. canvas itself is
            pointer-events-none; cursor interaction with the sim is wired
            through window-level listeners in the effect above, so clicks
            on the CTA and links pass through cleanly. we only mount the
            canvas once the section has scrolled within 1200px of the
            viewport so the heavy three.js chunk + WebGL context start as
            late as possible without visibly popping in. */}
        {!reduced && visible && (
          <FluidParticleCanvas pointerRef={pointerRef} visible={visible} />
        )}
      </div>
    </section>
  );
}
