"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { useAccentCycle } from "@/components/AccentProvider";

// hero stage wrapper: bg-click cycles the accent palette (excludes real
// interactive elements + `data-no-cycle`); also drives a transform+opacity
// scroll-exit on the stage itself.

export function HeroStage({ children }: { children: ReactNode }) {
  const cycle = useAccentCycle();
  const stageRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const lines = el.querySelectorAll(".hero-enter-line");
      const details = el.querySelectorAll("[data-hero-enter]");
      const timeline = gsap.timeline({ paused: true });
      timeline
        .fromTo(lines, { yPercent: 115, rotate: 3 }, {
          yPercent: 0,
          rotate: 0,
          duration: 1.05,
          stagger: 0.12,
          ease: "power4.out",
          clearProps: "transform",
        })
        .fromTo(details, { opacity: 0, y: 16 }, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.07,
          ease: "power3.out",
          clearProps: "transform,opacity",
        }, 0.25);
      const play = () => timeline.play();
      const curtain = document.getElementById("__boot-curtain");
      if (curtain && curtain.dataset.ready !== "true") {
        window.addEventListener("site:ready", play, { once: true });
      } else {
        play();
      }
      return () => window.removeEventListener("site:ready", play);
    });
    return () => media.revert();
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(min-width: 640px)").matches
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
      className="stage hero-stage relative h-full w-full"
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
        // delay so the recolor lands mid-spin instead of hitching its launch.
        window.setTimeout(cycle, 180);
      }}
    >
      {children}
    </div>
  );
}
