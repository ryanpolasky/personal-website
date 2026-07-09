"use client";

import { useEffect, useRef, useState } from "react";

// shared scroll utilities used by multiple sections. all client-only because
// they touch window/dom. progress values are clamped 0..1.

// returns a ref + a progress number for how far an element has traveled through
// the viewport. 0 = element top at vh, 1 = element bottom at 0.
export function useElementProgress<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let running = false;

    const readProgress = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = rect.height + vh;
      const traveled = vh - rect.top;
      const p = Math.max(0, Math.min(1, traveled / total));
      setProgress((prev) => (Math.abs(prev - p) > 0.001 ? p : prev));
    };

    const tick = () => {
      readProgress();
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // pause the per-frame work when the element is far off-screen. the wide
    // rootMargin (one viewport above/below) is intentional: it keeps the
    // rAF running through the snap-scroll danger zone the original
    // "always tick" version was guarding against. on every IO crossing we
    // also do one synchronous read so a snap-jump that skips most of the
    // section can't leave progress stuck at a stale value.
    // track intersection so tab-resume can decide whether to restart the loop.
    let intersecting = false;
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              readProgress();
              intersecting = entry.isIntersecting;
              if (entry.isIntersecting) start();
              else stop();
            },
            { rootMargin: "100% 0px" },
          );

    // also pause when the tab is hidden. backgrounded tabs still receive
    // rAF callbacks at ~1Hz, but setState in a hidden tab is wasted work.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      // resume directly (IO won't re-fire if intersection didn't change).
      readProgress();
      if (!io || intersecting) start();
    };

    if (io) io.observe(el);
    else start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { ref, progress };
}

// progress through a section where the section is taller than the viewport,
// e.g. a sticky/pinned section. 0 when entering, 1 when fully traveled.
export function useSectionTravel<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const activeRef = { current: true };
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              activeRef.current = entry.isIntersecting;
            },
            { rootMargin: "240px" },
          );
    io?.observe(el);
    const tick = () => {
      if (activeRef.current) {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const travel = rect.height - vh;
        if (travel > 1) {
          const p = Math.max(0, Math.min(1, -rect.top / travel));
          setProgress((prev) => (Math.abs(prev - p) > 0.001 ? p : prev));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return { ref, progress };
}

// is the element currently overlapping the viewport? cheap visibility gate for
// pausing webgl frameloops when canvases are off-screen.
export function useIsVisible<T extends HTMLElement = HTMLElement>(
  margin = "120px",
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return { ref, visible };
}

// prefers-reduced-motion as a live boolean. webgl scenes check this before
// running camera dollies / aggressive transitions.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

// touch / coarse-pointer detection for falling back the projects rail from
// pinned horizontal to a vertical stack.
export function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return coarse;
}

// shared nav scroll target resolver. a section can expose a [data-nav-anchor]
// content panel so anchor clicks (and boot-hash teleports) land on the panel
// instead of the bare section top, which can sit behind tall decorative
// padding. NAV_ANCHOR_GAP leaves a little air above the panel so it clears the
// floating nav.
export const NAV_ANCHOR_GAP = 32;

export function resolveSectionScrollTarget(
  id: string,
): { element: HTMLElement; offset: number } | null {
  if (typeof document === "undefined" || !id) return null;
  const anchor = document.querySelector<HTMLElement>(
    `[data-nav-anchor="${id}"]`,
  );
  if (anchor) return { element: anchor, offset: -NAV_ANCHOR_GAP };
  const el = document.getElementById(id);
  return el ? { element: el, offset: 0 } : null;
}
