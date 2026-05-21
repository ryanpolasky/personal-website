"use client";

import { useEffect, useRef } from "react";

// hero headline + accent bar that grows L→R with scroll, anchored to the text rect.

export function HeroHeadline() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buildRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const headline = headlineRef.current;
    const bar = barRef.current;
    const wrapper = wrapperRef.current;
    const buildEl = buildRef.current;
    if (!headline || !bar || !wrapper || !buildEl) return;

    let raf = 0;
    let alive = true;
    // damped progress (0 = fully under "build", 1 = extended through "stuff.")
    let current = 0;
    let lastNow = 0;

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              alive = entry.isIntersecting;
            },
            { rootMargin: "200px" },
          );
    io?.observe(headline);

    const range = document.createRange();
    const wrapperRect = () => wrapper.getBoundingClientRect();

    const tick = (now: number) => {
      if (alive) {
        const dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 1 / 60);
        const vh = window.innerHeight || 1;
        const t = window.scrollY / vh;
        const target = t < 0 ? 0 : t > 1 ? 1 : t;
        const k = 1 - Math.exp(-dt * 9);
        current += (target - current) * k;
        const wrap = wrapperRect();
        range.selectNodeContents(buildEl);
        const buildBox = range.getBoundingClientRect();
        const buildWidth = buildBox.width;
        const buildLeft = buildBox.left - wrap.left;
        range.selectNodeContents(wrapper);
        const totalBox = range.getBoundingClientRect();
        const fullEnd = totalBox.right - wrap.left;
        const startWidth = buildLeft + buildWidth;
        const width = startWidth + (fullEnd - startWidth) * current;
        bar.style.width = `${width.toFixed(2)}px`;
      }
      lastNow = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  return (
    <h1
      ref={headlineRef}
      // mobile: dual-stop text-shadow (soft halo + tight contact shadow)
      // halos the glyphs against the colorful R cluster behind them. cleared
      // at sm+ where the desktop stage has more negative space to spare.
      className="display relative max-w-[16ch] text-[clamp(3rem,13vw,8.5rem)] leading-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55),0_1px_3px_rgba(0,0,0,0.85)] sm:text-[clamp(3.2rem,9vw,8.5rem)] sm:[text-shadow:none]"
    >
      i&apos;m ryan,
      <br />i{" "}
      <span
        ref={wrapperRef}
        className="relative inline-block mt-2"
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
        }}
      >
        <span
          ref={barRef}
          aria-hidden
          className="pointer-events-none absolute left-0 block bg-[var(--color-accent)]"
          style={{
            bottom: "0.04em",
            height: "0.16em",
            width: 0,
            zIndex: -1,
          }}
        />
        <span ref={buildRef}>build</span> stuff.
      </span>
    </h1>
  );
}
