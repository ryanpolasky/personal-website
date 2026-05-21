"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useAccentCycle } from "@/components/AccentProvider";

// hero stage wrapper: bg-click cycles the accent palette (excludes real
// interactive elements + `data-no-cycle`); also drives a transform+opacity
// scroll-exit on the stage itself.

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
        // exit progress: 0 = in view, 1 = scrolled half a vh past the top.
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
      className="stage relative h-full w-full sm:h-[88svh] sm:min-h-[640px]"
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
