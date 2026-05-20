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
    // always tick. the previous IO-gated version could freeze `progress`
    // at a stale value when a snap-scroll jumped past the section faster
    // than the IO threshold crossing fired, leaving consumers (ribbon
    // draw-range) stuck at partial reveal.
    const tick = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = rect.height + vh;
      const traveled = vh - rect.top;
      const p = Math.max(0, Math.min(1, traveled / total));
      setProgress((prev) => (Math.abs(prev - p) > 0.001 ? p : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
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
