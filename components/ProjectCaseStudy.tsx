import type { CSSProperties } from "react";
import Link from "next/link";
import mediaDimensions from "@/lib/mediaDimensions.json";
import type { Project, ProjectMediaItem } from "@/lib/projects";
import { getEnabledProjects, projectCover } from "@/lib/projects";
import { projectSequence } from "@/lib/project-track";
import { MediaFrame } from "@/components/projects/MediaFrame";
import { ProjectTrack } from "@/components/ProjectTrack";

function StudyFigure({ item, lead = false }: { item: ProjectMediaItem; lead?: boolean }) {
  const size = (mediaDimensions as Record<string, { w: number; h: number }>)[item.src ?? ""];
  return <figure className={`case-panel case-frame${lead ? " case-lead" : ""}`} data-track-panel style={{ "--media-aspect": size ? `${size.w} / ${size.h}` : "16 / 9" } as CSSProperties}>
    <MediaFrame item={item} className="case-media" sizes="(max-width: 700px) 100vw, 85vw" fit="contain" plain />
    <figcaption>{item.label}</figcaption>
  </figure>;
}

function ProjectFacts({ project }: { project: Project }) {
  const repositories = Array.isArray(project.githubHref) ? project.githubHref : project.githubHref ? [{ href: project.githubHref, label: "source code" }] : [];
  return <>
    <dl className="case-stack"><dt>built with</dt><dd>{project.stack.join(" / ")}</dd></dl>
    <div className="case-links">
      {project.href ? <a href={project.href} target="_blank" rel="noreferrer">{project.hrefLabel ?? "visit project ↗"}</a> : null}
      {repositories.map((repo) => <a key={repo.href} href={repo.href} target="_blank" rel="noreferrer">{repo.label || "github"} ↗</a>)}
      {project.devpostHref ? <a href={project.devpostHref} target="_blank" rel="noreferrer">devpost ↗</a> : null}
    </div>
  </>;
}

export function ProjectCaseStudy({ project }: { project: Project }) {
  const projects = projectSequence(getEnabledProjects(), project.id);
  return <ProjectTrack projects={projects.map(({ id, name, tagline, tintHsl }) => ({ id, name, tagline, tintHsl }))}>
    {projects.map((item, index) => {
      const cover = projectCover(item);
      const tint = item.tintHsl;
      const Heading = index === 0 ? "h1" : "h2";
      return <article className="case-project" data-project={item.id} aria-labelledby={`study-${item.id}`} key={item.id} style={{ "--project-tint": tint ? `hsl(${tint.h} ${tint.s}% ${tint.l}%)` : "#566283" } as CSSProperties}>
        <header className="case-panel case-opening" data-track-panel>
          <p className="case-role">{item.index} / {item.role}</p>
          <Heading id={`study-${item.id}`} tabIndex={-1}>{item.name}</Heading>
          <p className="case-tagline">{item.tagline}</p>
          <p className="case-body">{item.body}</p>
          <div className="case-opening-facts"><ProjectFacts project={item} /></div>
        </header>
        {cover ? <StudyFigure lead item={{ src: cover, label: item.name, alt: item.cover?.alt ?? item.name }} /> : null}
        <div className="case-panel case-compact-details" data-track-panel><p className="case-eyebrow">{item.name} / project details</p><ProjectFacts project={item} /></div>
        {item.sections?.map((section, sectionIndex) => <section className="case-chapter" key={`${item.id}-${sectionIndex}`} aria-labelledby={`${item.id}-chapter-${sectionIndex}`}>
          <div className="case-panel case-copy" data-track-panel>
            <p className="case-eyebrow">{String(sectionIndex + 1).padStart(2, "0")} / {section.eyebrow}</p>
            <h2 id={`${item.id}-chapter-${sectionIndex}`}>{section.title}</h2>
            <p>{section.body}</p>
          </div>
          {section.media?.map((media, mediaIndex) => <StudyFigure key={`${media.label}-${mediaIndex}`} item={media} />)}
          {section.points?.length ? <div className="case-panel case-notes" data-track-panel><p className="case-eyebrow">{section.eyebrow} / details</p><ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul></div> : null}
        </section>)}
        {item.closingMedia ? <StudyFigure item={item.closingMedia} /> : null}
      </article>;
    })}
    <footer className="case-panel case-end" data-track-panel><p>that’s the work.</p><a href="mailto:ryanpolasky@hotmail.com">let’s talk ↗</a><Link href="/#projects" prefetch={false}>back to all projects</Link></footer>
  </ProjectTrack>;
}
