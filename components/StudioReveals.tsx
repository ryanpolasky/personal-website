"use client";

import { useEffect } from "react";
import { gsap } from "gsap";

export function StudioReveals() {
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main || typeof IntersectionObserver === "undefined") return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {}, main);
      const elements = main.querySelectorAll<HTMLElement>("[data-reveal]");
      context.add(() => {
        gsap.set(elements, { opacity: 0, y: 32 });
      });
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          observer.unobserve(target);
          context.add(() => {
            gsap.to(target, {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power3.out",
              clearProps: "transform,opacity",
            });
          });
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
      elements.forEach((element) => observer.observe(element));
      return () => {
        observer.disconnect();
        context.revert();
      };
    });
    return () => media.revert();
  }, []);

  return null;
}
