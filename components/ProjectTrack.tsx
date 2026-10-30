"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLenis } from "@/components/LenisContext";
import { activeTrackIndex, trackPosition } from "@/lib/project-track";

type TrackProject = { id: string; name: string; tagline: string; tintHsl?: { h: number; s: number; l: number } };

export function ProjectTrack({ projects, children }: { projects: TrackProject[]; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const goTo = useRef<(id: string) => void>(() => {});
  const [active, setActive] = useState(0);
  const lenis = useLenis();

  useLayoutEffect(() => {
    const element = root.current, windowElement = viewport.current, strip = track.current;
    if (!element || !windowElement || !strip) return;
    const groups = Array.from(strip.querySelectorAll<HTMLElement>("[data-project]"));
    const preference = matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 660px)");
    const saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    let offsets: number[] = [], extent = 0, distance = 0, position = 0, horizontal = false;
    let frame = 0, measured = false, disposed = false, current = -1;

    const publish = (index: number, addHistory = true) => {
      if (index === current) return;
      current = index;
      setActive(index);
      const project = projects[index];
      const url = `/work/${project.id}/`;
      if (addHistory && location.pathname !== url) history.pushState(history.state, "", url);
      document.title = `${project.name} · Ryan Polasky`;
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", project.tagline);
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonical) canonical.href = new URL(url, canonical.href).href;
    };

    const draw = () => {
      frame = 0;
      if (horizontal) {
        position = trackPosition(window.scrollY, element.getBoundingClientRect().top + window.scrollY, distance);
        strip.style.transform = `translate3d(${-position}px, 0, 0)`;
        if (progress.current) progress.current.style.transform = `scaleX(${position / Math.max(1, distance)})`;
        publish(activeTrackIndex(offsets, position, windowElement.clientWidth));
      } else {
        let index = 0;
        groups.forEach((group, next) => { if (group.getBoundingClientRect().top <= innerHeight * 0.3) index = next; });
        publish(index);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const scrollTo = (top: number) => {
      if (lenis) { lenis.resize(); lenis.scrollTo(top, { immediate: true }); }
      else window.scrollTo({ top, left: 0, behavior: "instant" });
    };
    const jump = (id: string, addHistory = true) => {
      const index = projects.findIndex((project) => project.id === id);
      if (index < 0) return;
      const top = horizontal
        ? element.getBoundingClientRect().top + window.scrollY + Math.min(offsets[index], distance)
        : groups[index].getBoundingClientRect().top + window.scrollY - 90;
      scrollTo(top);
      publish(index, addHistory);
      draw();
    };
    goTo.current = (id) => {
      jump(id);
      groups.find((group) => group.dataset.project === id)?.querySelector<HTMLElement>("h1, h2")?.focus({ preventScroll: true });
    };

    const measure = () => {
      const wasHorizontal = horizontal;
      const oldIndex = activeTrackIndex(offsets, position, 0);
      const oldStart = offsets[oldIndex] ?? 0;
      const fraction = (position - oldStart) / Math.max(1, (offsets[oldIndex + 1] ?? extent) - oldStart);
      horizontal = preference.matches && !saveData;
      element.dataset.horizontal = String(horizontal);
      if (horizontal) {
        extent = strip.scrollWidth;
        distance = Math.max(0, extent - windowElement.clientWidth);
        offsets = groups.map((group) => group.offsetLeft);
        element.style.height = `${distance + windowElement.clientHeight}px`;
        lenis?.resize();
        if (measured && wasHorizontal) {
          const start = offsets[oldIndex];
          const next = offsets[oldIndex + 1] ?? strip.scrollWidth;
          scrollTo(element.getBoundingClientRect().top + window.scrollY + Math.min(distance, start + fraction * (next - start)));
        } else if (measured && current >= 0) jump(projects[current].id, false);
      } else {
        element.style.removeProperty("height");
        strip.style.removeProperty("transform");
        lenis?.resize();
        if (measured && wasHorizontal && current >= 0) jump(projects[current].id, false);
      }
      measured = true;
      draw();
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!horizontal || !(target instanceof HTMLElement)) return;
      const panel = target.closest<HTMLElement>("[data-track-panel]");
      if (!panel) return;
      const left = panel.offsetLeft;
      if (left < position - 2 || left + panel.offsetWidth > position + windowElement.clientWidth + 2) {
        scrollTo(element.getBoundingClientRect().top + window.scrollY + Math.min(left, distance));
        draw();
      }
    };
    const onPop = () => jump(location.pathname.split("/")[2] ?? projects[0].id, false);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(windowElement);
    void document.fonts.ready.then(() => { if (!disposed) measure(); });
    preference.addEventListener("change", measure);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("popstate", onPop);
    strip.addEventListener("focusin", onFocus);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      preference.removeEventListener("change", measure);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("popstate", onPop);
      strip.removeEventListener("focusin", onFocus);
      history.scrollRestoration = previousRestoration;
      goTo.current = () => {};
    };
  }, [lenis, projects]);

  return <main ref={root} id="main" className="case-study">
    <nav className="case-nav" aria-label="project navigation">
      <Link href="/#projects" prefetch={false}>← all work</Link>
      <Link href="/" prefetch={false} className="case-wordmark">ryan polasky.</Link>
      <details className="case-index"><summary>project index <span>{String(projects.length).padStart(2, "0")}</span></summary><ol>{projects.map((project, index) => <li key={project.id}>
        <a href={`/work/${project.id}/`} aria-current={index === active ? "page" : undefined} onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          event.currentTarget.closest("details")?.removeAttribute("open");
          goTo.current(project.id);
        }}><span>{String(index + 1).padStart(2, "0")}</span>{project.name}</a>
      </li>)}</ol></details>
    </nav>
    <div className="case-window" ref={viewport}><div className="case-track" ref={track}>{children}</div></div>
    <div className="case-guide"><span aria-live="polite" aria-atomic="true">{projects[active].name}</span><p><span className="case-guide-horizontal">scroll to explore →</span><span className="case-guide-vertical">scroll to explore ↓</span></p><span>{String(active + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span><span className="case-progress" ref={progress} aria-hidden /></div>
  </main>;
}
