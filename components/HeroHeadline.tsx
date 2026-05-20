"use client";

import { useEffect, useRef } from "react";

// hero headline + accent bar that grows L→R with scroll, anchored to the text rect.

export function HeroHeadline() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const headline = headlineRef.current;
    const bar = barRef.current;
    if (!headline || !bar) return;

    let raf = 0;
    let alive = true;
    // damped progress + last-frame timestamp. raw scroll-derived `target` jumps
    // instantly with the viewport; `current` chases it with a per-frame lerp
    // so the bar's growth never feels mechanically locked to scroll.
    let current = 0;
    let lastNow = 0;

    // visibility gate so we don't keep ticking when the hero is way offscreen.
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

    const tick = (now: number) => {
      if (alive) {
        const dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 1 / 60);
        const rect = headline.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // map the headline's top position to a 0..1 fill. when the headline's
        // top is ~60% down the viewport (resting position on page load) the
        // bar is empty; when the headline's top reaches the viewport top the
        // bar is full. the 0.6 reference gives the bar a comfortable scroll
        // distance to grow over without snapping.
        const t = (vh * 0.6 - rect.top) / (vh * 0.6);
        const target = t < 0 ? 0 : t > 1 ? 1 : t;
        // damp current toward target. k tuned so the bar settles ~120ms behind
        // the cursor wheel, which feels like an inertial fill rather than a
        // direct read of scroll position.
        const k = 1 - Math.exp(-dt * 9);
        current += (target - current) * k;
        bar.style.transform = `scaleX(${current.toFixed(4)})`;
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
      <span className="relative inline-block mt-2">
        <span
          ref={barRef}
          aria-hidden
          className="pointer-events-none absolute left-0 block w-full origin-left bg-[var(--color-accent)]"
          style={{
            // sit the bar low against the text baseline like a thick underline
            // that's partially obscured by the descenders. em-based so it scales
            // with the clamp() font size.
            bottom: "0.04em",
            height: "0.16em",
            // start collapsed so the first paint matches the page-load progress.
            transform: "scaleX(0)",
            zIndex: -1,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
          }}
        >
          build
        </span>{" "}
        stuff.
      </span>
    </h1>
  );
}
