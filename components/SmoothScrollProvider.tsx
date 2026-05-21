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

    const w = window as Window & { __bootHash?: string };
    const bootHash = w.__bootHash;
    delete w.__bootHash;
    const bootTimers: number[] = [];
    const bootStart = performance.now();
    const MIN_BOOT_MS = 900;
    const liftBootCurtain = () => {
      const curtain = document.getElementById("__boot-curtain");
      if (!curtain) return;
      curtain.style.transform = "translate3d(0, -100%, 0)";
      bootTimers.push(window.setTimeout(() => curtain.remove(), 700));
    };
    const teleportToBootHash = () => {
      if (!bootHash || bootHash === "#") return;
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search + bootHash,
      );
      const target = document.getElementById(bootHash.slice(1));
      if (!target) return;
      window.dispatchEvent(new CustomEvent("nav:teleport"));
      const l = lenisRef.current;
      if (l) l.scrollTo(target, { immediate: true });
      else target.scrollIntoView({ behavior: "auto" });
    };
    const runBootTeleport = () => {
      teleportToBootHash();
      const elapsed = performance.now() - bootStart;
      const remaining = Math.max(0, MIN_BOOT_MS - elapsed);
      const lift = () =>
        bootTimers.push(window.setTimeout(liftBootCurtain, remaining));
      if (document.readyState === "complete") {
        lift();
      } else {
        const onLoad = () => {
          window.removeEventListener("load", onLoad);
          lift();
        };
        window.addEventListener("load", onLoad);
      }
    };

    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (isTouch || reduced) {
      // skip lenis; ScrollTrigger falls back to native scroll.
      ScrollTrigger.refresh();
      bootTimers.push(window.setTimeout(runBootTeleport, 50));
      return () => {
        bootTimers.forEach((id) => window.clearTimeout(id));
      };
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

    bootTimers.push(window.setTimeout(runBootTeleport, 50));

    return () => {
      window.removeEventListener("load", refresh);
      window.removeEventListener("resize", refresh);
      window.clearTimeout(t);
      bootTimers.forEach((id) => window.clearTimeout(id));
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
