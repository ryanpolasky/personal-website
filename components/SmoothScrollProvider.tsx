"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { resolveSectionScrollTarget } from "@/lib/scroll";

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)");
    let instance: Lenis | null = null;
    const sync = () => {
      instance?.destroy();
      instance = media.matches ? null : new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true, anchors: true });
      setLenis(instance);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      instance?.destroy();
    };
  }, []);

  useEffect(() => {
    const curtain = document.getElementById("__boot-curtain");
    const boot = window as Window & { __bootHash?: string };
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      const hash = boot.__bootHash || window.location.hash;
      if (hash) {
        const target = resolveSectionScrollTarget(hash.slice(1));
        if (target) {
          window.dispatchEvent(new Event("nav:teleport"));
          const margin = parseFloat(getComputedStyle(target.element).scrollMarginTop) || 0;
          window.scrollTo({ top: target.element.getBoundingClientRect().top + window.scrollY + target.offset - margin, behavior: "instant" });
          history.replaceState(null, "", `${pathname}${hash}`);
          delete boot.__bootHash;
        }
      }
      delete boot.__bootHash;
      if (curtain) {
        curtain.style.transform = "translate3d(0,-100%,0)";
        curtain.dataset.ready = "true";
      }
      window.dispatchEvent(new Event("site:ready"));
    };
    const timeout = window.setTimeout(reveal, 1200);
    document.fonts.ready.then(reveal);
    return () => {
      revealed = true;
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
