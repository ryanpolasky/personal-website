"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import Snap from "lenis/snap";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// active Lenis instance; null on touch/reduced-motion (Lenis never mounted).
const LenisContext = createContext<Lenis | null>(null);

export function useLenis(): Lenis | null {
  return useContext(LenisContext);
}

// registered at module load so it's available before child effects mount.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  // state mirror of ref so context consumers re-render on create/destroy.
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (isTouch || reduced) {
      // skip lenis; ScrollTrigger falls back to native scroll.
      ScrollTrigger.refresh();
      return;
    }

    const instance = new Lenis({
      duration: 0.72,
      lerp: 0.16,
      smoothWheel: true,
      wheelMultiplier: 1.02,
      touchMultiplier: 1.0,
      // Nav owns anchor nav so it can mask jumps with the curtain wash.
      anchors: false,
    });
    lenisRef.current = instance;
    setLenis(instance);
    const lenis = instance;

    // gsap.ticker drives lenis so ScrollTrigger stays in sync (ms vs s).
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    // proximity snap: `[data-snap]` sections become landing points without
    // interrupting scrub through tall pinned timelines.
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

    // refresh after fonts/images settle so triggers measure final layout.
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
