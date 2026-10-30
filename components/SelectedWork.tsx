import { ProjectStill } from "@/components/projects/ProjectStill";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getEnabledProjects, type Project } from "@/lib/projects";

const projects = getEnabledProjects();

export function projectCover(project: Project) {
  if (project.cover) return project.cover.src;
  return project.media.items?.find((item) => item.src)?.src
    ?? project.sections?.flatMap((section) => section.media ?? []).find((item) => item.src)?.src;
}

export function SelectedWork() {
  return (
    <section id="projects" className="selected-work" aria-labelledby="work-title">
      <header className="work-heading">
        <div className="section-label"><span>01 / selected work</span><span>{String(projects.length).padStart(2, "0")} projects</span></div>
        <h2 id="work-title" className="oversize-heading">a few things<br /><span>i’ve built.</span></h2>
        <p>from a family board game to tools that make<br className="desktop-break" /> the next person’s job a little easier.</p>
      </header>
      <div className="work-list">
        {projects.map((project, index) => {
          const cover = projectCover(project);
          const color = project.tintHsl
            ? `hsl(${project.tintHsl.h} ${project.tintHsl.s}% ${project.tintHsl.l}%)`
            : "var(--color-accent)";
          return (
            <article key={project.id} className={`work-case work-case-${project.id}`} style={{ "--case-accent": color } as CSSProperties}>
              <Link className="case-visual" href={`/work/${project.id}/`} prefetch={false} aria-label={`Explore ${project.name}`} data-cursor="explore">
                {cover ? (
                  <div className="case-picture">
                    <ProjectStill src={cover} alt={project.cover?.alt ?? project.media.items?.[0]?.alt ?? `${project.name} project artwork`} fill sizes="(max-width: 767px) 100vw, 90vw" className="case-image" />
                  </div>
                ) : (
                  <div className="case-diagram" aria-hidden>
                    <span className="diagram-caption">apple / developer tooling</span>
                    <span className="diagram-input">{project.id === "apple-triage" ? "test failure" : "ask a question"}</span>
                    <span className="diagram-flow">↓</span>
                    <span className="diagram-engine">{project.id === "apple-triage" ? "test triage" : "query planner"}</span>
                    <span className="diagram-flow">↓</span>
                    <span className="diagram-output">{project.id === "apple-triage" ? "root cause → resolution" : "natural language → database query"}</span>
                  </div>
                )}
                <span className="case-number">{String(index + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
                <span className="case-open" aria-hidden>↗</span>
              </Link>
              <div className="case-caption">
                <div><h3><Link href={`/work/${project.id}/`} prefetch={false}>{project.name}</Link></h3><p>{project.tagline}</p></div>
                <div className="case-caption-meta"><span>{project.role}</span><span>{project.stack.slice(0, 3).join(" / ")}</span></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
