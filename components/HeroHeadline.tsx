"use client";

import { useEffect, useRef } from "react";

export function HeroHeadline() {
  const barRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buildRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const wrapper = wrapperRef.current;
    const buildEl = buildRef.current;
    if (!bar || !wrapper || !buildEl) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let startScale = 0.5;
    let raf = 0;
    const update = () => {
      raf = 0;
      const progress = motion.matches
        ? 0
        : Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      bar.style.transform = `scaleX(${startScale + (1 - startScale) * progress})`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const measure = () => {
      startScale = buildEl.offsetWidth / Math.max(1, wrapper.offsetWidth);
      schedule();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    motion.addEventListener("change", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      motion.removeEventListener("change", schedule);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <h1 className="studio-heading hero-headline">
      <span className="studio-line">
        <span className="hero-enter-line">i&apos;m ryan,</span>
      </span>
      <span className="studio-line">
        <span className="hero-enter-line">
          i{" "}
          <span ref={wrapperRef} className="hero-underline-wrap">
            <span ref={barRef} className="hero-underline" aria-hidden />
            <span ref={buildRef}>build</span> stuff.
          </span>
        </span>
      </span>
    </h1>
  );
}
