"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useAccentCycle } from "@/components/AccentProvider";

// thin client wrapper around the hero's dark stage that turns the whole
// background into a click toy: clicking anywhere on the canvas (or on the
// empty space around the headline) advances the site-wide accent color to
// the next one in the palette. clicks that land on real interactive elements
// (buttons, links, magnetic ctas, anything tagged `data-no-cycle`) are
// ignored so navigation still works.
//
// also drives a subtle exit-transform on the stage itself: as the hero
// scrolls past the viewport top the stage scales down + lifts + fades,
// reading as if the card is being pushed back into z-depth while the next
// section rises underneath. transform + opacity only (gpu-cheap, no layout).

export function HeroStage({ children }: { children: ReactNode }) {
  const cycle = useAccentCycle();
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let raf = 0;
    let alive = true;
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              alive = entry.isIntersecting;
            },
            { rootMargin: "120px" },
          );
    io?.observe(el);

    const tick = () => {
      if (alive) {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // exit progress: hero stage top scrolling past viewport top.
        // 0 = hero still fully (or mostly) in view, 1 = hero has scrolled
        // half a viewport past the top edge. tapers naturally beyond that.
        const past = -rect.top;
        const exitDistance = vh * 0.5;
        const t = past / exitDistance;
        const p = t < 0 ? 0 : t > 1 ? 1 : t;
        const eased = 1 - Math.pow(1 - p, 2);
        const scale = 1 - eased * 0.04;
        const translateY = -eased * 24;
        const opacity = 1 - eased * 0.18;
        el.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className="stage relative h-[88svh] min-h-[640px] w-full"
      data-stage="dark"
      style={{ transformOrigin: "center", willChange: "transform, opacity" }}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (
          target.closest(
            'a, button, input, textarea, select, [role="button"], [data-no-cycle]',
          )
        ) {
          return;
        }
        cycle();
      }}
    >
      {children}
    </div>
  );
}
