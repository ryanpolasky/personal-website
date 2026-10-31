"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import gsap from "gsap";
import { observeProjectLanding } from "@/lib/projectLanding";
import { getEnabledProjects, type Project } from "@/lib/projects";
import { PROJECT_HOLD, PROJECT_REVEAL, PROJECT_ARRIVAL_END, type ProjectArrival } from "@/lib/projectMotion";
import "./projects-desktop.css";

const ProjectObjectScene = dynamic(() => import("./ProjectObjectScene"), { ssr: false });

const projects = getEnabledProjects().filter((project) => project.id !== "gallery");
const letterPositions = [
  [0.03, 0.24, -12, 0.02, 0.10], [0.91, 0.17, 12, 0.98, 0.23],
  [0.48, 0.04, -8, 0.01, 0.36], [0.99, 0.54, 9, 0.99, 0.49],
  [0.01, 0.62, -9, 0.01, 0.62], [0.30, 0.92, 14, 0.99, 0.75],
  [0.62, 0.87, -7, 0.02, 0.87], [0.92, 0.91, -13, 0.98, 0.96],
];

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
  const sectionRef = useRef<HTMLElement>(null);
  const arrival = useRef<ProjectArrival>({ time: PROJECT_ARRIVAL_END });
  const project = projects[selected];
  const palette = project.tintHsl;
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
    if (!section || !window.IntersectionObserver) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const clock = arrival.current;
      const archive = section.querySelector<HTMLElement>(".project-desktop-archive")!;
      let reversing = false;
      const sync = () => {
        const time = clock.time;
        const motion = time === 0 ? "waiting" : reversing ? "reversing" :
          time < PROJECT_REVEAL ? "boot" : time < PROJECT_ARRIVAL_END ? "entered" : "complete";
        const boot = time < PROJECT_HOLD ? "holding" : time < PROJECT_HOLD + 1.25 ? "burst" : "backdrop";
        const inert = time < PROJECT_REVEAL || reversing;
        if (section.dataset.motion !== motion) section.dataset.motion = motion;
        if (section.dataset.boot !== boot) section.dataset.boot = boot;
        if (archive.inert !== inert) archive.inert = inert;
      };
      clock.time = 0;
      sync();
      const timeline = gsap.timeline({ paused: true });
      timeline.to({}, { duration: PROJECT_ARRIVAL_END }, 0);
      const word = section.querySelector<HTMLElement>(".project-boot-word")!;
      const letters = section.querySelectorAll<HTMLElement>(".project-boot-letter");
      letters.forEach((letter, i) => {
        const glyph = word.children[i] as HTMLElement;
        timeline.fromTo(letter, {
          xPercent: -50, yPercent: -50,
          x: () => (section.clientWidth - word.offsetWidth) / 2 + glyph.offsetLeft + glyph.offsetWidth / 2 - letter.offsetLeft,
          y: () => section.clientHeight / 2 - letter.offsetTop,
          scale: () => word.offsetHeight / letter.offsetHeight,
          rotation: 0,
        }, {
          xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 1, rotation: letterPositions[i][2],
          duration: 1.05, ease: "expo.out",
        }, PROJECT_HOLD + i * 0.025);
        timeline.fromTo(letter, { opacity: 1 }, { opacity: 0.13, duration: 0.62, ease: "power2.inOut" }, PROJECT_HOLD + 0.16 + i * 0.025);
      });
      timeline.fromTo(section,
        { "--pd-grid-opacity": 0, "--pd-grid-scale": 1.6, "--pd-grid-turn": "-10deg" },
        { "--pd-grid-opacity": 0.48, "--pd-grid-scale": 1, "--pd-grid-turn": "0deg", duration: 0.85 }, PROJECT_REVEAL);
      const enter = (selector: string, from: gsap.TweenVars, duration: number, delay = 0, stagger = 0, ease = "power3.out") => {
        timeline.fromTo(section.querySelectorAll(selector), { opacity: 0, ...from }, {
          opacity: 1, x: 0, y: 0, rotation: 0, scale: 1, skewY: 0,
          duration, stagger, ease,
        }, PROJECT_REVEAL + delay);
      };
      enter(".project-desktop-topline, .project-desktop-heading", { y: 60, skewY: 7 }, 0.56, 0, 0.06);
      enter(".project-desktop-status, .project-desktop-library-label", { y: 60, skewY: 7 }, 0.49, 0.17);
      enter(".project-desktop-object", { y: 35, rotation: -14, scale: 0.68 }, 0.67, 0.25, 0.065, "back.out(1.2)");
      timeline.fromTo(section.querySelector(".project-desktop-stage"), { opacity: 0 }, { opacity: 1, duration: 0.9 }, PROJECT_REVEAL + 0.24);
      enter(".project-desktop-stage-art", { x: -80, y: 70, rotation: -14, scale: 0.54 }, 1.1, 0.24, 0, "back.out(1.2)");
      enter(".project-desktop-stage-id, .project-desktop-stage-caption, .project-desktop-readme, .project-desktop-bottomline",
        { y: 60, skewY: 7 }, 0.5, 0.6);
      enter(".project-desktop-details", { x: 140, y: 160, rotation: 15, scaleX: 0.1, scaleY: 0.04 }, 0.75, 0.52, 0, "back.out(1.1)");
      let direction = 1;
      const advance = (_time: number, delta: number) => {
        clock.time = gsap.utils.clamp(0, PROJECT_ARRIVAL_END, clock.time + Math.min(delta, 100) / 1000 * direction);
        timeline.time(clock.time, true);
        sync();
        if (clock.time === 0 || clock.time === PROJECT_ARRIVAL_END) gsap.ticker.remove(advance);
      };
      const stopLanding = observeProjectLanding(section, {
        canSnap: () => clock.time === 0,
        onMove: () => {
          if (!reversing) gsap.ticker.remove(advance);
        },
        onLand: () => {
          reversing = false;
          direction = 1;
          gsap.ticker.add(advance);
          sync();
        },
        onLeaveAbove: () => {
          if (clock.time > 0) {
            reversing = true;
            direction = -2.6;
            gsap.ticker.add(advance);
            sync();
          }
        },
      });
      const resize = () => timeline.invalidate().time(clock.time, true);
      const layout = new ResizeObserver(resize);
      layout.observe(section);
      const visible = new IntersectionObserver(([entry]) => {
        section.dataset.visible = String(entry.isIntersecting);
      });
      visible.observe(section);
      let alive = true;
      document.fonts.ready.then(() => { if (alive) resize(); });
      return () => {
        alive = false;
        stopLanding();
        layout.disconnect();
        visible.disconnect();
        gsap.ticker.remove(advance);
        archive.inert = false;
        clock.time = PROJECT_ARRIVAL_END;
        delete section.dataset.motion;
        delete section.dataset.boot;
        delete section.dataset.visible;
      };
    });
    return () => media.revert();
  }, []);

  const inspect = (index: number) => {
    setSelected(index);
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
      <div className="project-boot-poster" aria-hidden="true">
        <div className="project-boot-word">{Array.from("PROJECTS", (letter, i) => <span key={i}>{letter}</span>)}</div>
        {Array.from("PROJECTS", (letter, i) => {
          const [x, y, rotation, phoneX, phoneY] = letterPositions[i];
          return <span key={i} className="project-boot-letter" style={{
            "--letter-x": `${x * 100}%`, "--letter-y": `${y * 100}%`,
            "--letter-phone-x": `${phoneX * 100}%`, "--letter-phone-y": `${phoneY * 100}%`,
            "--letter-rotation": `${rotation}deg`, "--letter-duration": `${13 + i * 1.1}s`,
          } as CSSProperties}><span className="project-boot-glyph">{letter}</span></span>;
        })}
      </div>
      <div className="project-desktop-topline">
        <span>03 / SELECTED WORK</span>
        <span>RYAN POLASKY · PROJECT ARCHIVE</span>
      </div>

      <div className="project-desktop-archive">
        <div className="project-desktop-heading">
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
                  onPointerEnter={(event) => {
                    const motion = sectionRef.current?.dataset.motion;
                    if (event.pointerType !== "touch" && (!motion || motion === "complete")) {
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
              <ProjectObjectScene id={project.id} arrival={arrival} />
              <span className="project-desktop-stage-caption">{project.name.toUpperCase()}</span>
            </div>
            <div className="project-desktop-details">
              <div className="project-desktop-details-content" key={project.id}>
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
        </div>

      </div>
      <div className="project-desktop-bottomline">
        <span>PERSONAL / COLLABORATIVE / PROFESSIONAL</span>
        <span>SCROLL TO CONTINUE ↓</span>
      </div>
    </section>
  );
}
