"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useIsVisible, useReducedMotion } from "@/lib/scroll";
import { usePerformanceTier } from "@/lib/performance";
import { MagneticButton } from "@/components/MagneticButton";
import type { PointerState } from "@/components/scenes/FluidParticleCanvas";

// fluid particle band (lusion-style contact). canvas is dynamic-imported;
// this wrapper owns the section layout, SEO lockup, and pointer wiring.
// reduced-motion users get the static accent banner with no canvas.

const FluidParticleCanvas = dynamic(
  () => import("@/components/scenes/FluidParticleCanvas"),
  { ssr: false },
);

export function FluidParticleBand() {
  const reduced = useReducedMotion();
  const tier = usePerformanceTier(reduced);
  const { ref: sectionRef, visible } = useIsVisible<HTMLElement>("1200px");
  // once the canvas has been mounted, keep it mounted and just pause the
  // frameloop via the `visible` prop. avoids a boot-time mount/unmount/mount
  // race on mobile when refreshing onto #contact (IO fires false before the
  // boot teleport scrolls to the section, then true again after; the second
  // mount sometimes never gets a useFrame tick to seed particles).
  const [everMounted, setEverMounted] = useState(false);
  useEffect(() => {
    if (visible && !everMounted) setEverMounted(true);
  }, [visible, everMounted]);
  const shouldMountCanvas = !reduced && (visible || everMounted);
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
    pulse: 0,
  });

  // pointer wiring. on fine pointer (mouse/trackpad) it's hover-driven: any
  // movement inside the section box activates the cursor. on coarse pointer
  // (touch) hover doesn't exist, so it's tap-driven instead: a tap inside the
  // section fires a brief outward "explosion" pulse, position only tracks
  // while the finger is held, and lifting the finger resets the cursor so
  // particles can settle instead of drifting at the last touch point.
  useEffect(() => {
    if (reduced) return;
    const el = sectionRef.current;
    if (!el) return;

    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    const computeNormalized = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const inside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;
      if (!inside) return null;
      const nx = ((clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = (0.5 - (clientY - rect.top) / rect.height) * 2;
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
      return { nx, ny };
    };

    if (coarse) {
      let tracking = false;

      const onDown = (e: PointerEvent) => {
        const n = computeNormalized(e.clientX, e.clientY);
        if (!n) return;
        const p = pointerRef.current;
        p.nx = n.nx;
        p.ny = n.ny;
        p.needsSync = true;
        p.target = 1;
        p.pulse = 1;
        tracking = true;
      };

      const onMove = (e: PointerEvent) => {
        if (!tracking) return;
        const n = computeNormalized(e.clientX, e.clientY);
        if (!n) {
          pointerRef.current.target = 0;
          tracking = false;
          return;
        }
        pointerRef.current.nx = n.nx;
        pointerRef.current.ny = n.ny;
      };

      const onUp = () => {
        pointerRef.current.target = 0;
        tracking = false;
      };

      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });
      window.addEventListener("pointercancel", onUp, { passive: true });
      window.addEventListener("blur", onUp);
      return () => {
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("blur", onUp);
      };
    }

    const onMove = (e: PointerEvent) => {
      const n = computeNormalized(e.clientX, e.clientY);
      if (!n) {
        pointerRef.current.target = 0;
        return;
      }
      if (pointerRef.current.target === 0) {
        pointerRef.current.nx = n.nx;
        pointerRef.current.ny = n.ny;
        pointerRef.current.needsSync = true;
      } else {
        pointerRef.current.nx = n.nx;
        pointerRef.current.ny = n.ny;
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
      <div className="relative h-[calc(100lvh+2px)] min-h-[540px] w-full sm:min-h-[680px]">
        {/* CONTACT LOCKUP - section index, headline, CTA, link row. sits at
            z-20 above the particle canvas so the button + links stay crisp
            and clickable; particles still flow visibly in the negative space
            around the column. previously this section's headline was buried
            by piling particles for a lusion-style effect, but with a real CTA
            on it now, function (legibility + conversion) wins over decoration. */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-5 sm:gap-7 sm:px-6">
          <p
            className="text-[10.5px] uppercase tracking-[0.32em] text-white/85"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            04 - contact
          </p>
          <h2 className="display max-w-[12ch] text-center text-[clamp(2.8rem,14vw,9rem)] leading-[0.92] text-white sm:max-w-[14ch] sm:text-[clamp(3rem,10vw,9rem)]">
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
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] tracking-tight text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)] sm:mt-2 sm:py-4"
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
            className="mt-1 flex max-w-[20rem] flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] sm:max-w-none sm:gap-2.5 sm:text-[13px] sm:tracking-[0.22em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <a
              href="https://www.linkedin.com/in/ryan-polasky/"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-3.5 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white sm:px-4"
              data-hoverable
            >
              linkedin →
            </a>
            <a
              href="https://github.com/ryanpolasky"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-3.5 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white sm:px-4"
              data-hoverable
            >
              github →
            </a>
            <a
              href="/spotify.html"
              className="rounded-full border border-white/40 bg-white/10 px-3.5 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white sm:px-4"
              data-hoverable
            >
              spotify →
            </a>
            <a
              href="/assets/Ryan_Polasky_Resume.pdf"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/40 bg-white/10 px-3.5 py-2 text-white/90 backdrop-blur-sm transition-colors hover:border-white hover:bg-white/20 hover:text-white sm:px-4"
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
        {shouldMountCanvas && (
          <FluidParticleCanvas
            key={tier}
            pointerRef={pointerRef}
            visible={visible}
            tier={tier}
          />
        )}
      </div>
    </section>
  );
}
