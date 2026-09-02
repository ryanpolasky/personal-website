"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import Snap from "lenis/snap";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { resolveSectionScrollTarget } from "@/lib/scroll";

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
    // boot 'load' listener, tracked so both cleanup paths can remove it.
    let bootLoad: (() => void) | null = null;
    let heroReadyHandler: (() => void) | null = null;
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
      const resolved = resolveSectionScrollTarget(bootHash.slice(1));
      if (!resolved) return;
      window.dispatchEvent(new CustomEvent("nav:teleport"));
      const l = lenisRef.current;
      if (l)
        l.scrollTo(resolved.element, {
          immediate: true,
          offset: resolved.offset,
        });
      else resolved.element.scrollIntoView({ behavior: "auto" });
    };
    const runBootTeleport = () => {
      teleportToBootHash();
      const gateOnHero =
        (!bootHash || bootHash === "#") &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!gateOnHero) {
        const lift = () =>
          bootTimers.push(
            window.setTimeout(
              liftBootCurtain,
              Math.max(0, MIN_BOOT_MS - (performance.now() - bootStart)),
            ),
          );
        if (document.readyState === "complete") lift();
        else {
          const onLoad = () => {
            window.removeEventListener("load", onLoad);
            bootLoad = null;
            lift();
          };
          bootLoad = onLoad;
          window.addEventListener("load", onLoad);
        }
        return;
      }
      const w2 = window as Window & { __heroReady?: boolean };
      const MAX_BOOT_MS = 4000;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (heroReadyHandler) {
          window.removeEventListener("hero:ready", heroReadyHandler);
          heroReadyHandler = null;
        }
        liftBootCurtain();
      };
      const tryLift = () => {
        if (w2.__heroReady && performance.now() - bootStart >= MIN_BOOT_MS)
          finish();
      };
      heroReadyHandler = tryLift;
      window.addEventListener("hero:ready", heroReadyHandler);
      bootTimers.push(
        window.setTimeout(
          tryLift,
          Math.max(0, MIN_BOOT_MS - (performance.now() - bootStart)),
        ),
      );
      bootTimers.push(window.setTimeout(finish, MAX_BOOT_MS));
      if (w2.__heroReady) tryLift();
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
        if (bootLoad) window.removeEventListener("load", bootLoad);
        if (heroReadyHandler)
          window.removeEventListener("hero:ready", heroReadyHandler);
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
    // ScrollTrigger.refresh forces a full layout pass; a window drag fires
    // resize dozens of times a second, so coalesce to the trailing edge.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refresh, 150);
    };
    window.addEventListener("load", refresh);
    window.addEventListener("resize", onResize);
    const t = window.setTimeout(refresh, 500);

    bootTimers.push(window.setTimeout(runBootTeleport, 50));

    return () => {
      window.removeEventListener("load", refresh);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(t);
      bootTimers.forEach((id) => window.clearTimeout(id));
      if (bootLoad) window.removeEventListener("load", bootLoad);
      if (heroReadyHandler)
        window.removeEventListener("hero:ready", heroReadyHandler);
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
