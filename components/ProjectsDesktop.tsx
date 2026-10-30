"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { getEnabledProjects, type Project } from "@/lib/projects";
import "./projects-desktop.css";

const ProjectObjectScene = dynamic(() => import("./ProjectObjectScene"), { ssr: false });

const projects = getEnabledProjects().filter((project) => project.id !== "gallery");

const objects: Record<string, { src: string; alt: string }> = {
  marralhinha: {
    src: "/assets/project-objects/board-oak.png",
    alt: "Marralhinha marble board",
  },
  autopsy: {
    src: "/assets/project-objects/autopsy.svg",
    alt: "Autopsy icon",
  },
  "utd-roommates": {
    src: "/assets/project-objects/meteormate.svg",
    alt: "MeteorMate icon",
  },
  rycord: {
    src: "/assets/project-objects/rycord-record.svg",
    alt: "rycord record icon",
  },
  nimby: {
    src: "/assets/project-objects/frog.png",
    alt: "NIMBY frog artwork",
  },
  "readme-ryvamper": {
    src: "/assets/project-objects/ryme.svg",
    alt: "RyMe.md icon",
  },
  "apple-triage": {
    src: "/assets/project-objects/triage.svg",
    alt: "Camera-test logs under a magnifying glass",
  },
  "apple-nlsql": {
    src: "/assets/project-objects/database.svg",
    alt: "Database stack with a query terminal",
  },
};

const descriptions: Record<string, string> = {
  marralhinha:
    "The marble game my family plays, rebuilt as a multiplayer table for the browser.",
  autopsy:
    "Records coding-agent runs and uses failure histories to warn future sessions.",
  "utd-roommates":
    "Matchmaking for UTD roommates by habits and lifestyle, led with ACM UTD.",
  rycord:
    "A 3D record room stocked from my Discogs collection, with cache-first album details.",
  nimby:
    "A hand-drawn roguelike where a shapeshifting druid defends the forest.",
  "apple-triage":
    "Groups and diagnoses 1,000+ camera-test failures and files bug reports for engineers.",
  "apple-nlsql":
    "Plain-English queries for Postgres and NoSQL backends, backed by schema-aware planning.",
  "readme-ryvamper":
    "Build animated GitHub README banners in your browser and export them as SVGs.",
};

function ProjectObject({ project }: { project: Project }) {
  const artwork = objects[project.id];
  if (!artwork) {
    return (
      <span className="project-desktop-document" aria-hidden="true">
        <span className="project-desktop-document-lines" />
        <span>{project.id === "apple-triage" ? "LOG" : "SQL"}</span>
      </span>
    );
  }
  return (
    <Image
      src={artwork.src}
      alt={artwork.alt}
      width={600}
      height={600}
      unoptimized
      className="project-desktop-art"
    />
  );
}

export function ProjectsDesktop() {
  const [selected, setSelected] = useState(0);
  const [themeIndex, setThemeIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const project = projects[selected];
  const palette = themeIndex === null ? null : projects[themeIndex].tintHsl;
  const themeStyle = palette
    ? ({
        "--pd-active": `hsl(${palette.h} ${palette.s}% ${palette.l}%)`,
      } as CSSProperties)
    : undefined;
  const githubRepos = project.githubHref
    ? typeof project.githubHref === "string"
      ? [{ label: "Source", href: project.githubHref }]
      : project.githubHref
    : [];

  useEffect(() => {
    const section = sectionRef.current;
    if (
      !section ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.IntersectionObserver
    ) return;
    section.dataset.motion = "waiting";
    let revealTimer = 0;
    let settleTimer = 0;
    const reveal = () => {
      if (section.dataset.motion !== "boot") return;
      section.dataset.motion = "entered";
      settleTimer = window.setTimeout(() => {
        section.dataset.motion = "complete";
      }, 1500);
    };
    section.addEventListener("project-boot-reveal", reveal);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        section.dataset.motion = "boot";
        revealTimer = window.setTimeout(reveal, 2400);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -68% 0px", threshold: 0.12 },
    );
    observer.observe(section);
    return () => {
      observer.disconnect();
      section.removeEventListener("project-boot-reveal", reveal);
      window.clearTimeout(revealTimer);
      window.clearTimeout(settleTimer);
    };
  }, []);

  const inspect = (index: number) => {
    setSelected(index);
    setThemeIndex(index);
  };

  return (
    <section
      id="projects"
      data-snap
      ref={sectionRef}
      style={themeStyle}
      className="project-desktop"
      aria-labelledby="project-desktop-title"
    >
      <div className="project-boot-poster" aria-hidden="true"><span /></div>
      <div className="project-desktop-topline">
        <span>03 / SELECTED WORK</span>
        <span>RYAN POLASKY · PROJECT ARCHIVE</span>
      </div>

      <div className="project-desktop-archive">
        <div className="project-desktop-heading">
          <span className="project-desktop-mark" aria-hidden="true">R<span>·</span></span>
          <h2 id="project-desktop-title">Projects</h2>
          <span className="project-desktop-path" aria-hidden="true">~/ryan/work/</span>
        </div>
        <div className="project-desktop-status">
          <span>AN INDEX OF THINGS I&apos;VE BUILT</span>
          <span>{String(projects.length).padStart(2, "0")} ITEMS · SELECT TO INSPECT</span>
        </div>

        <div className="project-desktop-workspace">
          <div className="project-desktop-library">
            <div className="project-desktop-library-label">
              <span>OBJECT LIBRARY</span>
              <span>01—{String(projects.length).padStart(2, "0")}</span>
            </div>
            <div className="project-desktop-objects" role="group" aria-label="Select a project">
              {projects.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="project-desktop-object"
                  aria-pressed={selected === index}
                  aria-label={`View ${item.name}`}
                  style={{ "--pd-stagger": `${250 + index * 65}ms` } as CSSProperties}
                  onPointerEnter={(event) => {
                    const motion = sectionRef.current?.dataset.motion;
                    if (event.pointerType !== "touch" && motion !== "waiting" && motion !== "boot" && motion !== "entered") {
                      inspect(index);
                    }
                  }}
                  onFocus={() => inspect(index)}
                  onClick={() => inspect(index)}
                >
                  <span className="project-desktop-object-slot">
                    <ProjectObject project={item} />
                  </span>
                  <span className="project-desktop-object-name">{item.name}</span>
                </button>
              ))}
            </div>
            <div className="project-desktop-readme" aria-hidden="true">
              <span className="project-desktop-crosshair">+</span>
              <span>SELECT AN OBJECT TO VIEW<br />DETAILS AND LINKS</span>
            </div>
          </div>

          <div className="project-desktop-viewer" aria-live="polite" aria-atomic="true">
            <div className="project-desktop-stage">
              <span className="project-desktop-stage-id">OBJECT / {String(selected + 1).padStart(2, "0")}</span>
              <span className="project-desktop-stage-word" aria-hidden="true" key={project.id}>{project.name}</span>
              <span className="project-desktop-stage-art">
                <ProjectObject project={project} />
              </span>
              <ProjectObjectScene id={project.id} />
              <span className="project-desktop-stage-caption">{project.name.toUpperCase()}</span>
            </div>
            <div className="project-desktop-details" key={project.id}>
              <div className="project-desktop-window-title">project.info</div>
              <div className="project-desktop-meta">
                <span>{project.role.toUpperCase()}</span>
                <span>{String(selected + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
              </div>
              <h3>{project.name}</h3>
              <p className="project-desktop-description">{descriptions[project.id] ?? project.body}</p>
              <p className="project-desktop-stack">{project.stack.slice(0, 4).join(" / ")}</p>
              <div className="project-desktop-actions">
                {project.href ? (
                  <a href={project.href} target="_blank" rel="noopener noreferrer">
                    {project.hrefLabel?.replace(/\s*→$/, "") ?? "Visit project"}<span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span className="project-desktop-private">
                    {githubRepos.length ? "No public demo" : "Internal work · no public demo"}
                  </span>
                )}
                {githubRepos.map((repo) => (
                  <a key={repo.href} href={repo.href} target="_blank" rel="noopener noreferrer">
                    {repo.label}<span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="project-desktop-foot">
          <span>DRAG THE OBJECT TO ROTATE</span>
          <span className="project-desktop-foot-hint">ARROW KEYS ROTATE / SPACE RESETS</span>
          <span>{String(selected + 1).padStart(2, "0")} — {String(projects.length).padStart(2, "0")}</span>
        </div>
      </div>
      <div className="project-desktop-bottomline">
        <span>PERSONAL / COLLABORATIVE / PROFESSIONAL</span>
        <span>SCROLL TO CONTINUE ↓</span>
      </div>
    </section>
  );
}
