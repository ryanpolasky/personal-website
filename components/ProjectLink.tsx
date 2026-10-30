"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useLenis } from "@/components/LenisContext";
import { animateProjectNavigation } from "@/lib/project-navigation";

type ProjectDestination = { id: string; name: string; image?: { src: string } };
type NavigationRequest = { project: ProjectDestination; featured: boolean };

export function ProjectLink({ project, children }: { project: ProjectDestination; children: ReactNode }) {
  return <Link href={`/work/${project.id}/`} prefetch={false} onClick={(event) => {
    const saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!animateProjectNavigation(event, matchMedia("(prefers-reduced-motion: reduce)").matches, saveData)) return;
    const request = new CustomEvent<NavigationRequest>("project:explore", {
      cancelable: true, detail: { project, featured: !!event.currentTarget.closest(".work-stage") },
    });
    if (!window.dispatchEvent(request)) event.preventDefault();
  }}>{children}</Link>;
}

export function ProjectNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const lenis = useLenis();
  const pending = useRef<{ href: string; reveal: () => void; cancel: () => void } | null>(null);

  useEffect(() => {
    const navigation = pending.current;
    if (navigation && pathname.replace(/\/+$/, "") === navigation.href.replace(/\/+$/, "")) navigation.reveal();
  }, [pathname]);

  useEffect(() => {
    const onExplore = (event: Event) => {
      if (typeof Element.prototype.animate !== "function") return;
      event.preventDefault();
      if (pending.current) return;
      const { project, featured } = (event as CustomEvent<NavigationRequest>).detail;
      const href = `/work/${project.id}/`;
      const overlay = document.createElement("div");
      overlay.className = "project-navigation";
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("data-lenis-prevent", "");
      const image = new Image();
      image.alt = "";
      image.src = featured ? document.querySelector<HTMLImageElement>(".work-project-image")?.currentSrc || project.image?.src || "" : project.image?.src || "";
      if (project.image) overlay.append(image);
      const sourceCaption = featured ? document.querySelector<HTMLElement>(".work-project-caption") : null;
      const title = sourceCaption ? sourceCaption.cloneNode(true) as HTMLElement : document.createElement("span");
      if (!sourceCaption) title.textContent = project.name;
      title.querySelectorAll("a").forEach((link) => { link.style.visibility = "hidden"; });
      title.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
      overlay.append(title);
      document.body.append(overlay);
      const html = document.documentElement;
      const overflow = html.style.overflow;
      const wasInert = document.body.inert;
      const wasStopped = lenis?.isStopped;
      const controller = new AbortController();
      const animations: Animation[] = [];
      let navigating = false, revealing = false;
      const clean = () => {
        controller.abort();
        clearTimeout(timeout);
        animations.forEach((animation) => animation.cancel());
        overlay.remove();
        document.body.inert = wasInert;
        html.style.overflow = overflow;
        delete html.dataset.projectNavigation;
        if (!wasStopped) lenis?.start();
        pending.current = null;
      };
      const play = (element: HTMLElement, frames: Keyframe[], duration: number) => {
        const animation = element.animate(frames, { duration, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards" });
        animations.push(animation);
        return animation.finished;
      };
      const reveal = async () => {
        if (!navigating || revealing) return;
        revealing = true;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (controller.signal.aborted) return;
        delete html.dataset.projectNavigation;
        try {
          await play(overlay, [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], 650);
          clean();
          document.querySelector<HTMLElement>(".case-opening h1")?.focus({ preventScroll: true });
        } catch {}
      };
      const timeout = window.setTimeout(() => { clean(); window.location.assign(href); }, 9000);
      pending.current = { href, reveal: () => { void reveal(); }, cancel: clean };
      html.dataset.projectNavigation = "covering";
      html.style.overflow = "hidden";
      document.body.inert = true;
      lenis?.stop();
      window.addEventListener("popstate", clean, { once: true, signal: controller.signal });
      window.addEventListener("pagehide", clean, { once: true, signal: controller.signal });
      matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (preference) => {
        if (!preference.matches) return;
        if (!navigating) router.push(href);
        clean();
      }, { signal: controller.signal });
      window.addEventListener("keydown", (key) => {
        if (key.key === "Escape") clean();
      }, { signal: controller.signal });
      void (async () => {
        try {
          void play(image, [{ transform: "scale(1)" }, { transform: "scale(1.08)" }], 1100).catch(() => {});
          await play(overlay, featured ? [{ opacity: 0 }, { opacity: 1 }] : [{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }], featured ? 320 : 500);
          if (controller.signal.aborted) return;
          void play(title, [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-24px)" }], 350).catch(() => {});
          navigating = true;
          router.push(href);
        } catch {
          if (!controller.signal.aborted) { clean(); window.location.assign(href); }
        }
      })();
    };
    window.addEventListener("project:explore", onExplore);
    return () => { window.removeEventListener("project:explore", onExplore); pending.current?.cancel(); };
  }, [router, lenis]);

  return null;
}
