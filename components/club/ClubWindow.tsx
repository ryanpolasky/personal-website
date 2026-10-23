"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { ROLES, SKILL_GROUPS } from "@/components/AboutSection";
import { PROJECTS } from "@/lib/projects";
import { RESUME_PDF_HREF } from "@/lib/site";
import { playClubSfx } from "./sfx";
import styles from "./club.module.css";

export type ClubSection = "about" | "work" | "projects" | "contact";

const TITLES: Record<ClubSection, string> = {
  about: "ryan@cupertino:~/about",
  work: "ryan@cupertino:~/work",
  projects: "ryan@cupertino:~/projects",
  contact: "ryan@cupertino:~/contact",
};

const SOCIAL_LINKS = [
  { label: "github", href: "https://github.com/ryanpolasky" },
  { label: "linkedin", href: "https://www.linkedin.com/in/ryan-polasky/" },
  { label: "spotify", href: "/spotify.html" },
  { label: "gallery", href: "/gallery" },
];

function AboutContent() {
  return (
    <div className={styles.aboutContent}>
      <div className={styles.aboutIntro}>
        <div>
          <p className={styles.windowEyebrow}>about / 01</p>
          <h2 className={styles.windowHeading}>small, useful things, on purpose.</h2>
          <p className={styles.windowBody}>
            ut dallas cs grad, now a software engineer on apple&apos;s camera &amp;
            edits team. most recently built marralhinha — a traditional marble
            game, rebuilt for the browser.
          </p>
        </div>
      </div>
      <div className={styles.aboutCopy}>
        <p>
          i&apos;m a computer science graduate from ut dallas (&apos;26), now a
          software engineer on apple&apos;s camera &amp; edits team. before
          going full-time i spent two summers there as an intern, building ai
          tooling for the wireless tech (WTE) &amp; camera &amp; edits orgs.
        </p>
        <p>
          i enjoy backend, devops, and making llms actually do what you want
          them to do. i also have a bad habit of rebuilding this website. this
          is version eleven, but the older ones{" "}
          <a href="/gallery">are still around</a> if you want to see them.
        </p>
      </div>
      <div className={styles.skillGroups}>
        {SKILL_GROUPS.map((group) => (
          <section key={group.label}>
            <p className={styles.windowEyebrow}>{group.label}</p>
            <div className={styles.chips}>
              {group.items.map((item) => (
                <span className={styles.chip} key={item}>
                  {item}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function WorkContent() {
  return (
    <div className={styles.roleList}>
      {ROLES.map((role, index) => (
        <article className={styles.role} key={`${role.company}-${role.title}`}>
          <div className={styles.roleMain}>
            <p className={styles.windowEyebrow}>0{index + 1} / {role.type}</p>
            <h2 className={styles.roleTitle}>
              {role.company} <span>· {role.title}</span>
            </h2>
            <p className={styles.roleMeta}>
              {role.when} · {role.location}
            </p>
            <p className={styles.windowBody}>{role.body}</p>
          </div>
          <div className={styles.metric}>
            <strong>{role.metric.value}</strong>
            <span>{role.metric.label}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function getProjectImage(project: (typeof PROJECTS)[number]) {
  return (
    project.media.poster ??
    project.media.src ??
    project.media.items?.find((item) => item.src)?.src ??
    project.sections
      ?.flatMap((section) => section.media ?? [])
      .find((item) => item.src)?.src ??
    project.closingMedia?.src
  );
}

function ProjectsContent() {
  return (
    <div className={styles.projectGrid}>
      {PROJECTS.filter((project) => project.enabled).map((project, index, all) => {
        const image = getProjectImage(project);
        return (
          <article
            className={`${styles.projectCard} ${all.length % 2 === 1 && index === all.length - 1 ? styles.projectCardWide : ""}`}
            key={project.id}
          >
            <a className={styles.projectMainLink} href={`/work/${project.id}`}>
              <div className={styles.projectImage}>
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 88vw, 40vw"
                  />
                ) : (
                  <div className={styles.projectImageFallback}>
                    <span>{project.index}</span>
                  </div>
                )}
              </div>
              <div className={styles.projectCopy}>
                <p className={styles.windowEyebrow}>{project.index} / project</p>
                <h2>{project.name}</h2>
                <p>{project.tagline}</p>
                <div className={styles.chips}>
                  {project.stack.map((item) => (
                    <span className={styles.chip} key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </a>
            {project.href && (
              <a
                className={styles.projectExternal}
                href={project.href}
                target={project.href.startsWith("/") ? undefined : "_blank"}
                rel={project.href.startsWith("/") ? undefined : "noreferrer"}
                aria-label={`${project.name}: ${project.hrefLabel ?? "visit"}`}
              >
                {project.hrefLabel ?? "visit →"}
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ContactContent() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const email = "ryanpolasky@hotmail.com";

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      playClubSfx("click");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.contactContent}>
      <p className={styles.windowEyebrow}>contact / say hello</p>
      <a className={styles.emailLink} href={`mailto:${email}`}>
        {email}
      </a>
      <button className={styles.copyButton} onClick={() => void copyEmail()}>
        copy address <span aria-hidden>↗</span>
      </button>
      <p className={styles.copiedToast} aria-live="polite">
        {copied ? "copied to clipboard" : ""}
      </p>
      <a className={styles.resumeLink} href={RESUME_PDF_HREF}>
        download résumé <span aria-hidden>↗</span>
      </a>
      <div className={styles.contactSocials}>
        {SOCIAL_LINKS.map((link) => (
          <a href={link.href} key={link.label}>
            {link.label} <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Content({ section }: { section: ClubSection }) {
  if (section === "about") return <AboutContent />;
  if (section === "work") return <WorkContent />;
  if (section === "projects") return <ProjectsContent />;
  return <ContactContent />;
}

export function ClubWindow({
  section,
  offset,
  onClose,
  onDragStart,
}: {
  section: ClubSection;
  offset: { x: number; y: number };
  onClose: () => void;
  onDragStart: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  const title = TITLES[section];
  const children: ReactNode = <Content section={section} />;

  return (
    <div
      className={styles.window}
      style={{
        "--window-x": `${offset.x}px`,
        "--window-y": `${offset.y}px`,
      } as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label={`${section} window`}
    >
      <div
        className={styles.titleBar}
        onPointerDown={onDragStart}
        onDoubleClick={onClose}
      >
        <span>{title}</span>
        <button
          className={styles.windowClose}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="Close window"
        >
          [x]
        </button>
      </div>
      <div className={styles.windowScroll} data-lenis-prevent>
        {children}
      </div>
    </div>
  );
}
