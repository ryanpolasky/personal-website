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

    // Range gives the actual rendered text bounds (offsetWidth on inline
    // spans is unreliable for italic display fonts with overhanging glyphs).
    const range = document.createRange();
    const wrapperRect = () => wrapper.getBoundingClientRect();

    const tick = (now: number) => {
      if (alive) {
        const dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 1 / 60);
        const vh = window.innerHeight || 1;
        // 0 at page top (bar under "build"), 1 once scrolled a viewport down
        // (bar extended through "stuff."). decoupled from the headline's own
        // rect so initial paint always starts at exactly "build".
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
      className="display relative max-w-[16ch] text-[clamp(2.8rem,9vw,8.5rem)] text-white leading-tight"
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
