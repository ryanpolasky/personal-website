"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ProjectStill } from "@/components/projects/ProjectStill";
import { workMotion } from "@/lib/work-motion";
import type { WorkFieldState } from "@/components/scenes/WorkFieldView";

const Field = dynamic(() => import("@/components/scenes/WorkFieldView").then((module) => module.WorkFieldView), { ssr: false });

type WorkPreview = { id: string; name: string; tagline: string; image?: { src: string; alt: string } };

export function WorkExperience({ projects }: { projects: WorkPreview[] }) {
  const root = useRef<HTMLElement>(null);
  const motion = useRef<WorkFieldState>({ charge: 0, reveal: 0, x: 0, y: 0 });
  const [mountField, setMountField] = useState(false);
  const [fieldReady, setFieldReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const project = projects[0];
  const enhanced = fieldReady && !reduced;

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const update = () => {
      setReduced(preference.matches || !!connection?.saveData);
      if (preference.matches || connection?.saveData) setFieldReady(false);
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
    if (!element) return;
    let frame = 0, wasExpanded = false;
    const tick = () => {
      frame = 0;
      const { charge, reveal } = workMotion(element.getBoundingClientRect().top, innerHeight);
      Object.assign(motion.current, { charge, reveal });
      element.style.setProperty("--work-reveal", String(reveal));
      const nextExpanded = reveal === 1;
      if (nextExpanded !== wasExpanded) { wasExpanded = nextExpanded; setExpanded(nextExpanded); }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const move = (event: PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    motion.current.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    motion.current.y = 1 - (event.clientY - rect.top) / rect.height * 2;
  };

  return <section id="projects" className="selected-work" aria-label="selected work">
    <section ref={root} className="work-experience" data-snap data-enhanced={enhanced} aria-labelledby="work-title">
      <div className="work-stage" onPointerMove={move} onPointerLeave={() => { motion.current.x = 0; motion.current.y = 0; }}>
        {mountField && !reduced && (!expanded || fieldReady) ? <Field state={motion} onReady={setFieldReady} awake={!expanded} /> : null}
        <div className="work-project-media">
          {project.image ? <ProjectStill src={project.image.src} alt={project.image.alt} fill viewportCover sizes="100vw" className="work-project-image" /> : null}
        </div>
        <div className="work-project-caption">
          <span>selected work / featured project</span>
          <h2 id="work-title">{project.name}</h2>
          <div><p>{project.tagline}</p><Link href={`/work/${project.id}/`} prefetch={false}>explore the project ↗</Link></div>
        </div>
      </div>
    </section>
    <div className="work-index"><p>all projects</p><ol>{projects.map((item, index) => <li key={item.id}>
      <Link href={`/work/${item.id}/`} prefetch={false}><span>{String(index + 1).padStart(2, "0")}</span><span>{item.name}</span><span>explore ↗</span></Link>
    </li>)}</ol></div>
  </section>;
}
