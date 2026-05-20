"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import Snap from "lenis/snap";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// the active Lenis instance, exposed so consumers (e.g. the project modal)
// can pause/resume page scroll without reaching into globals. null on touch
// devices or reduced-motion users where Lenis never mounted.
const LenisContext = createContext<Lenis | null>(null);

export function useLenis(): Lenis | null {
  return useContext(LenisContext);
}

// mounts lenis smooth-scroll site-wide, wires its raf into gsap.ticker, and
// proxies scrollerProxy so ScrollTrigger reads lenis' virtualised scroll
// position. on touch devices lenis is disabled (we let native momentum win).
//
// scrollTrigger is registered at module load so it's available before any
// child component's effects (which mount before this provider's effect).
//
// proximity snap: after the user stops scrolling, lenis nudges the page so
// the nearest section-with-`data-snap` lands at the viewport top. proximity
// (not mandatory) means short scrolls inside a section are not interrupted,
// and only when the user has actually wandered close to the next landing
// does the snap engage. tuned to share lenis' lerp/duration so it reads as
// the same hand of inertia rather than a separate animator. tall pinned
// sections (kaleidoscope, projects) only declare a snap at their top so the
// rail / morph choreography is never interrupted mid-scrub.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  // state mirror of lenisRef so context consumers re-render when lenis
  // is created / destroyed (refs don't trigger re-renders).
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (isTouch || reduced) {
      // skip lenis entirely. ScrollTrigger falls back to native scroll.
      ScrollTrigger.refresh();
      return;
    }

    // tuned for a crisp cinematic settle: smooth enough to feel damped, but
    // direct enough that pinned sections don't read as input lag.
    const instance = new Lenis({
      duration: 0.72,
      lerp: 0.16,
      smoothWheel: true,
      wheelMultiplier: 1.02,
      touchMultiplier: 1.0,
      // Anchor navigation is owned by Nav so it can mask instant section
      // jumps behind the accent curtain wash. Leaving Lenis anchors enabled
      // makes Lenis intercept `href="#..."` clicks globally and start its own
      // smooth scroll before Nav's transition can cover the viewport.
      anchors: false,
    });
    lenisRef.current = instance;
    setLenis(instance);
    const lenis = instance;

    // hand frame timing to gsap's ticker so lenis stays in sync with all
    // ScrollTrigger work. lenis.raf expects ms; gsap ticker emits seconds.
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    // proximity snap addon. every `[data-snap]` section becomes a landing
    // point at its top edge (`align: 'start'`). kept as proximity instead of
    // lock/mandatory so tall pinned timelines can still scrub normally.
    const snap = new Snap(lenis, {
      type: "proximity",
      distanceThreshold: "36%",
      duration: 0.62,
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      lerp: 0.18,
      debounce: 140,
    });
    const snapTargets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-snap]"),
    );
    const removeSnaps = snapTargets.map((el) =>
      snap.addElement(el, { align: ["start"] }),
    );

    // refresh after fonts/images settle so initial start/end positions are
    // measured against the final layout.
    const refresh = () => {
      ScrollTrigger.refresh();
      snap.resize();
    };
    window.addEventListener("load", refresh);
    window.addEventListener("resize", refresh);
    const t = window.setTimeout(refresh, 500);

    return () => {
      window.removeEventListener("load", refresh);
      window.removeEventListener("resize", refresh);
      window.clearTimeout(t);
      removeSnaps.forEach((off) => off());
      snap.destroy();
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
      setLenis(null);
    };
  }, []);

  return (
    <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
  );
}
