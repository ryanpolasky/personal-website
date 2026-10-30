"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ProjectStill } from "@/components/projects/ProjectStill";
import { useLenis } from "@/components/LenisContext";
import { HOLD_DURATION, REVEAL_DURATION, workMotion } from "@/lib/work-motion";
import type { WorkFieldState } from "@/components/scenes/WorkFieldView";

const Field = dynamic(() => import("@/components/scenes/WorkFieldView").then((module) => module.WorkFieldView), { ssr: false });

type WorkPreview = { id: string; name: string; tagline: string; image?: { src: string; alt: string } };

export function WorkExperience({ projects }: { projects: WorkPreview[] }) {
  const root = useRef<HTMLElement>(null);
  const motion = useRef<WorkFieldState>({ charge: 0, reveal: 0, x: 0, y: 0 });
  const heldAt = useRef<number | null>(null);
  const committedAt = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const redraw = useRef<() => void>(() => {});
  const focusTarget = useRef<"project" | "hold" | null>(null);
  const [mountField, setMountField] = useState(false);
  const [fieldReady, setFieldReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);
  const lenis = useLenis();
  const project = projects[active];
  const enhanced = fieldReady && !reduced;

  useEffect(() => {
    const target = focusTarget.current;
    const selector = target === "project" && expanded ? ".work-project-caption a" : target === "hold" && enhanced && !expanded ? ".work-hold" : null;
    if (selector) { root.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }); focusTarget.current = null; }
  }, [enhanced, expanded]);

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const update = () => {
      setReduced(preference.matches || !!connection?.saveData);
      if (preference.matches || connection?.saveData) { heldAt.current = null; setFieldReady(false); }
    };
    update();
    preference.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setMountField(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); preference.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element || !enhanced) return;
    let frame = 0, wasExpanded = false;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const cancel = () => { heldAt.current = null; schedule(); };
    const tick = (now: number) => {
      frame = 0;
      if (document.hidden) return;
      const rect = element.getBoundingClientRect();
      if (rect.top > innerHeight || rect.bottom < 0) { heldAt.current = null; return; }
      const heldFor = heldAt.current === null ? 0 : now - heldAt.current;
      if (heldFor >= HOLD_DURATION && committedAt.current === null) committedAt.current = now;
      const { charge, reveal } = workMotion(-rect.top / Math.max(1, rect.height - innerHeight), heldFor, committedAt.current === null ? null : now - committedAt.current);
      Object.assign(motion.current, { charge, reveal });
      element.style.setProperty("--work-reveal", String(reveal));
      element.style.setProperty("--work-charge", String(charge));
      const nextExpanded = reveal > 0.98;
      if (nextExpanded !== wasExpanded) { wasExpanded = nextExpanded; setExpanded(nextExpanded); }
      if (heldAt.current !== null || (committedAt.current !== null && now - committedAt.current < REVEAL_DURATION)) schedule();
    };
    redraw.current = schedule;
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
      heldAt.current = null;
      redraw.current = () => {};
    };
  }, [enhanced]);

  const move = (event: PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    motion.current.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    motion.current.y = 1 - (event.clientY - rect.top) / rect.height * 2;
    if (heldAt.current !== null && Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 16) { heldAt.current = null; redraw.current(); }
  };
  const open = () => { committedAt.current ??= performance.now(); heldAt.current = null; redraw.current(); };
  const jump = () => {
    if (!root.current) return;
    if (lenis) lenis.scrollTo(root.current, { immediate: true });
    else root.current.scrollIntoView({ behavior: "instant" });
  };
  const replay = () => { heldAt.current = null; committedAt.current = null; focusTarget.current = "hold"; jump(); redraw.current(); };
  const select = (index: number) => { setActive((index + projects.length) % projects.length); committedAt.current = performance.now() - REVEAL_DURATION; redraw.current(); };
  const controlsVisible = !enhanced || expanded;

  return <section id="projects" className="selected-work" aria-label="selected work">
    <section ref={root} className="work-experience" data-enhanced={enhanced} aria-labelledby="work-title">
      <div className="work-stage" onPointerMove={move}>
        {mountField && !reduced ? <Field state={motion} onReady={setFieldReady} /> : null}
        <div className="work-intro" aria-hidden={controlsVisible}><span>01 / selected work</span><h2 id="work-title">selected work</h2><p>hold to reveal <span>or scroll into the work ↓</span></p></div>
        <article className="work-project" aria-hidden={!controlsVisible} inert={!controlsVisible}>
          <div className="work-project-media" key={project.id}>
            {project.image ? <ProjectStill src={project.image.src} alt={project.image.alt} fill viewportCover sizes="100vw" className="work-project-image" /> : <div className="work-project-diagram" aria-hidden><span>apple / developer tooling</span><strong>{"</>"}</strong></div>}
          </div>
          <div className="work-project-caption"><span>{String(active + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span><h3>{project.name}</h3><div><p>{project.tagline}</p><Link href={`/work/${project.id}/`} prefetch={false}>explore the project ↗</Link></div></div>
        </article>
        <button className="work-hold" aria-label="Hold to reveal the project, or press Enter" tabIndex={enhanced && !expanded ? 0 : -1} aria-hidden={!enhanced || expanded}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            origin.current = { x: event.clientX, y: event.clientY };
            heldAt.current = performance.now();
            redraw.current();
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={() => { if (heldAt.current !== null && performance.now() - heldAt.current >= HOLD_DURATION) open(); heldAt.current = null; redraw.current(); }}
          onPointerCancel={() => { heldAt.current = null; redraw.current(); }} onLostPointerCapture={() => { heldAt.current = null; redraw.current(); }}
          onContextMenu={(event) => event.preventDefault()} onClick={(event) => { if (event.detail === 0) { focusTarget.current = "project"; open(); } }}
        ><span className="work-hold-progress" aria-hidden /></button>
        <nav className="work-controls" aria-label="project previews" hidden={!controlsVisible}>
          <button onClick={() => select(active - 1)} aria-label="Previous project">←</button><span aria-live="polite">{project.name}</span><button onClick={() => select(active + 1)} aria-label="Next project">→</button>
          {enhanced ? <button className="work-replay" onClick={replay}>replay reveal ↺</button> : null}
        </nav>
      </div>
    </section>
    <div className="work-index"><p>all projects</p><ol>{projects.map((item, index) => <li key={item.id}>
      <button onClick={() => { select(index); jump(); }} aria-label={`Preview ${item.name}`}><span>{String(index + 1).padStart(2, "0")}</span><span>{item.name}</span></button>
      <Link href={`/work/${item.id}/`} prefetch={false}>case study ↗</Link>
    </li>)}</ol></div>
  </section>;
}
