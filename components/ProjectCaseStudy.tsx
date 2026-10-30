import { ProjectStill } from "@/components/projects/ProjectStill";
import Link from "next/link";
import type { Project } from "@/lib/projects";
import { getEnabledProjects } from "@/lib/projects";
import { MediaFrame } from "@/components/projects/MediaFrame";
import { projectCover } from "@/lib/projects";

export function ProjectCaseStudy({ project }: { project: Project }) {
  const cover = projectCover(project);
  const projects = getEnabledProjects();
  const next = projects[(projects.findIndex((item) => item.id === project.id) + 1) % projects.length];
  const repositories = Array.isArray(project.githubHref) ? project.githubHref : project.githubHref ? [{ href: project.githubHref, label: "source code" }] : [];
  return (
    <main className="case-study" id="main">
      <nav className="case-study-nav" aria-label="project navigation"><Link href="/#projects" prefetch={false}>← all work</Link><Link href="/" prefetch={false}>ryan polasky.</Link>{project.href ? <a href={project.href} target="_blank" rel="noreferrer">visit project ↗</a> : <span>{project.hrefLabel ?? "case study"}</span>}</nav>
      <header className="case-study-header"><p>{project.index} / {project.role}</p><h1>{project.name}</h1><p className="case-study-tagline">{project.tagline}</p></header>
      {cover ? <div className="case-study-cover"><ProjectStill src={cover} alt={project.cover?.alt ?? project.media.items?.[0]?.alt ?? project.name} fill sizes="100vw" className="object-contain" /></div> : null}
      <div className="case-study-overview"><p>{project.body}</p><aside><h2>built with</h2><p>{project.stack.join(" / ")}</p><div className="case-study-links">{project.href ? <a href={project.href} target="_blank" rel="noreferrer">{project.hrefLabel ?? "visit project ↗"}</a> : null}{repositories.map((repo) => <a key={repo.href} href={repo.href} target="_blank" rel="noreferrer">{repo.label || "github"} ↗</a>)}{project.devpostHref ? <a href={project.devpostHref} target="_blank" rel="noreferrer">devpost ↗</a> : null}</div></aside></div>
      {project.sections?.map((section, index) => <section className="case-study-section" key={`${section.eyebrow}-${index}`}><div className="case-study-copy"><p className="section-label">{String(index + 1).padStart(2, "0")} / {section.eyebrow}</p><h2>{section.title}</h2><p>{section.body}</p>{section.points ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}</div>{section.media?.length ? <div className={`case-study-media ${section.media.length > 1 ? "has-multiple" : ""}`}>{section.media.map((item) => <figure key={item.label}><MediaFrame item={item} className="case-study-media-frame" sizes="(max-width: 767px) 95vw, 85vw" fit="contain" /><figcaption>{item.label}</figcaption></figure>)}</div> : null}</section>)}
      {project.closingMedia?.src ? <div className="case-study-closing"><MediaFrame item={project.closingMedia} className="case-study-media-frame" sizes="90vw" fit="contain" /></div> : null}
      <Link href={`/work/${next.id}/`} prefetch={false} className="case-study-next"><span>next project</span><span>{next.name} ↗</span></Link>
      <div className="case-study-footer"><Link href="/#projects" prefetch={false}>← back to the work</Link><a href="mailto:ryanpolasky@hotmail.com">let’s talk ↗</a></div>
    </main>
  );
}
