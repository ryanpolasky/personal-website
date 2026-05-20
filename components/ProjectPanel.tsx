"use client";

// orchestrator for a project's horizontal sequence:
//   intro spread -> N media-section spreads -> optional editorial spread
// each spread is one viewport. ProjectsRail's getProjectSpreadCount
// must match what we render here.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Project, ProjectMediaItem, ProjectSection } from "@/lib/projects";
import {
  CaseFileIntro,
  CombinedEditorialSpread,
  LAYOUT_MAP,
  Lightbox,
  MEDIA_LAYOUTS,
  StackedIntroMedia,
  type CaseFileVital,
} from "@/components/projects";

interface ProjectPanelProps {
  project: Project;
  tintColor: string;
  index: number;
  total: number;
}

// per-project intro overrides; fallback is StackedIntroMedia.
const INTRO_VARIANTS: Record<
  string,
  {
    fileNumber: string;
    vitals: CaseFileVital[];
  }
> = {
  autopsy: {
    fileNumber: "aut-2026-05",
    vitals: [
      { label: "verdict", value: "3rd overall" },
      { label: "docket", value: "la hacks 26" },
      { label: "honors", value: "cognition h.m." },
    ],
  },
};

export function ProjectPanel({
  project,
  tintColor,
  index,
  total,
}: ProjectPanelProps) {
  const projectStyle = { "--project-tint": tintColor } as CSSProperties;
  const linkIsExternal = project.href?.startsWith("http") ?? false;
  const hrefLabel = project.hrefLabel?.replace(/\s*→$/, "") ?? "view project";
  // public if there's a live href, otherwise show hrefLabel (wip/private/etc).
  const accessLabel = project.href
    ? "public"
    : (project.hrefLabel ?? "internal");
  // normalize githubHref to repo[]. lone string + no other actions ->
  // 'github' label (so the bare icon reads as an explicit destination).
  const hasOtherAction = !!project.href || !!project.devpostHref;
  const githubRepos = Array.isArray(project.githubHref)
    ? project.githubHref
    : project.githubHref
      ? [{ label: hasOtherAction ? "" : "github", href: project.githubHref }]
      : [];
  const sections = project.sections ?? [];

  // lightbox state; gated on mount so SSR doesn't read document.body.
  const [lightboxItem, setLightboxItem] = useState<ProjectMediaItem | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // intro hero media. presence flips the intro from 2-col to 3-col.
  const introHeroPrimary =
    project.media.kind === "image" ? project.media.items?.[0] : undefined;
  const introHeroSecondary =
    project.media.kind === "image" ? project.media.items?.[1] : undefined;
  const hasIntroHero = !!introHeroPrimary?.src;
  const introVariant = INTRO_VARIANTS[project.id];

  // media sections render individually; editorial sections collapse into
  // a single CombinedEditorialSpread. matches projectSpreadCount math.
  const mediaSections: Array<{
    section: ProjectSection;
    sectionIndex: number;
  }> = [];
  const editorialSections: ProjectSection[] = [];
  sections.forEach((section, sectionIndex) => {
    if ((section.media?.length ?? 0) > 0) {
      mediaSections.push({ section, sectionIndex });
    } else {
      editorialSections.push(section);
    }
  });

  // intro sub-elements extracted as JSX vars so layouts can compose
  // them without duplicating markup.
  const heroElement = hasIntroHero ? (
    introVariant ? (
      <CaseFileIntro
        primary={introHeroPrimary}
        fileNumber={introVariant.fileNumber}
        vitals={introVariant.vitals}
        onOpen={setLightboxItem}
      />
    ) : (
      <StackedIntroMedia
        primary={introHeroPrimary}
        secondary={introHeroSecondary}
        onOpen={setLightboxItem}
      />
    )
  ) : null;

  // unified title column for all projects. compact-with-hero variant was
  // dropped so content-rich projects don't look like a lower tier.
  const titleColumn = (
    <div className="relative isolate max-w-5xl">
      <span
        className="display pointer-events-none absolute -left-[0.08em] top-1/2 z-0 -translate-y-1/2 select-none text-[clamp(13rem,31vw,32rem)] leading-none tracking-tighter opacity-[0.115]"
        style={{
          color: tintColor,
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
        }}
        aria-hidden
      >
        {project.index}
      </span>
      <p
        className="relative z-10 mb-5 text-[10.5px] uppercase tracking-[0.32em] text-[var(--color-text-invert-faint)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        selected system
      </p>
      {project.logoSrc ? (
        // logotype variant. sr-only project name keeps a11y / hash anchors
        // intact. animate-subtle-float adds the in-game idle bob.
        <h3
          id={`project-${project.id}-name`}
          className="relative z-10 inline-block"
        >
          <span className="sr-only">{project.name}</span>
          <Image
            src={project.logoSrc}
            alt={project.name}
            width={1014}
            height={313}
            priority
            // unoptimized + pixelated rendering keeps pixel-art crisp.
            // -mb-4 trims the PNG's transparent bottom padding.
            unoptimized
            className="animate-subtle-float -mb-4 h-auto w-full max-w-[clamp(20rem,52vw,46rem)] [image-rendering:pixelated]"
          />
        </h3>
      ) : (
        // 3-col intro (title | stacked media | aside) compresses the title
        // column to ~53% of grid width; at the wider clamp's 11rem cap, the
        // project name overflows that column on wide monitors and ends up
        // visually underneath the media column. drop the cap + vw scale
        // when we're in that layout so the text always fits the cell it
        // was given. 2-col projects get the full dramatic typography.
        <h3
          id={`project-${project.id}-name`}
          className={`display relative z-10 max-w-[11ch] leading-[0.82] tracking-[-0.055em] text-[var(--color-text-invert)] ${
            hasIntroHero
              ? "text-[clamp(3rem,7vw,8rem)]"
              : "text-[clamp(3.4rem,9.8vw,11rem)]"
          }`}
        >
          {project.name}
        </h3>
      )}
      <p className="relative z-10 mt-6 max-w-[44ch] text-[clamp(1.15rem,1.65vw,2rem)] leading-tight text-[var(--color-text-invert-muted)]">
        {project.tagline}
      </p>
      <div className="relative z-10 mt-6 flex max-w-[42ch] flex-wrap gap-1.5">
        {project.stack.map((s) => (
          <span key={s} className="chip chip-invert">
            {s}
          </span>
        ))}
      </div>
    </div>
  );

  const asideElement = (
    <aside className="relative isolate flex max-h-[68svh] flex-col self-stretch overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_14%_0%,color-mix(in_oklab,var(--project-tint)_18%,transparent),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.045)_44%,rgba(255,255,255,0.075))] p-5 shadow-[0_24px_90px_-48px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,var(--project-tint),transparent)] opacity-70" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <p className="text-[15px] leading-relaxed text-[var(--color-text-invert-muted)] sm:text-base">
          {project.body}
        </p>
        <div className="mt-7 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">
          <div style={{ fontFamily: "var(--font-mono)" }}>
            <p className="text-[10.5px] uppercase tracking-[0.3em] text-[var(--color-text-invert-faint)]">
              role
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-text-invert)]">
              {project.role}
            </p>
          </div>
          <div style={{ fontFamily: "var(--font-mono)" }}>
            <p className="text-[10.5px] uppercase tracking-[0.3em] text-[var(--color-text-invert-faint)]">
              access
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-text-invert-muted)]">
              {accessLabel}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {project.href ? (
          <Link
            href={project.href}
            target={linkIsExternal ? "_blank" : undefined}
            rel={linkIsExternal ? "noreferrer noopener" : undefined}
            className="group inline-flex h-[42px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-[12px] uppercase tracking-[0.24em] text-[var(--color-text-invert)] transition-colors hover:border-[var(--project-tint)] hover:bg-white/[0.1]"
            style={{ fontFamily: "var(--font-mono)" }}
            data-hoverable
          >
            <span>{hrefLabel}</span>
            <span aria-hidden>↗</span>
          </Link>
        ) : null}
        {githubRepos.map((repo) => (
          <Link
            key={repo.href}
            href={repo.href}
            target="_blank"
            rel="noreferrer noopener"
            className={
              repo.label
                ? "group inline-flex h-[42px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-[12px] uppercase tracking-[0.24em] text-[var(--color-text-invert)] transition-colors hover:border-[var(--project-tint)] hover:bg-white/[0.1]"
                : "group inline-flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[var(--color-text-invert)] transition-colors hover:border-[var(--project-tint)] hover:bg-white/[0.1]"
            }
            style={{ fontFamily: "var(--font-mono)" }}
            aria-label={
              repo.label
                ? `${project.name} ${repo.label} on github`
                : `${project.name} on github`
            }
            title={
              repo.label
                ? `view ${repo.label} on github`
                : "view source on github"
            }
            data-hoverable
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.9-.39.99 0 1.98.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.77 1.06.77 2.15 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.79.55 4.57-1.53 7.86-5.85 7.86-10.95C23.5 5.65 18.35.5 12 .5z" />
            </svg>
            {repo.label ? <span>{repo.label}</span> : null}
          </Link>
        ))}
        {project.devpostHref ? (
          <Link
            href={project.devpostHref}
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[var(--color-text-invert)] transition-colors hover:border-[var(--project-tint)] hover:bg-white/[0.1]"
            aria-label={`${project.name} on devpost`}
            title="view on devpost"
            data-hoverable
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.002 1.61L0 12.004 6.002 22.39h11.996L24 12.004 17.998 1.61H6.002zm1.84 4.05h6.297c5.494 0 7.864 2.715 7.864 6.291v.121c0 3.574-2.37 6.288-7.864 6.288H7.842V5.66zm2.91 2.328v7.927h2.875c3.222 0 4.6-1.444 4.6-3.93v-.067c0-2.486-1.378-3.93-4.6-3.93h-2.875z" />
            </svg>
          </Link>
        ) : null}
      </div>
    </aside>
  );

  return (
    <article
      className="relative isolate h-full w-full overflow-hidden"
      style={projectStyle}
      aria-labelledby={`project-${project.id}-name`}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_22%,color-mix(in_oklab,var(--project-tint)_34%,transparent),transparent_28%),radial-gradient(circle_at_82%_68%,color-mix(in_oklab,var(--project-tint)_18%,transparent),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%,rgba(255,255,255,0.04))]" />
      <div className="pointer-events-none absolute inset-y-0 left-[100svw] -z-10 w-px bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.16),transparent)] opacity-70" />
      <div className="flex h-full">
        {/* INTRO SPREAD */}
        <section className="flex h-full w-[100svw] shrink-0 px-5 pb-24 pt-14 sm:px-8 sm:pb-28 sm:pt-20 md:px-12 lg:px-10 xl:px-14">
          <div className="mx-auto grid h-full w-full max-w-[min(90svw,1900px)] grid-rows-[auto_1fr] gap-5 sm:gap-8">
            <div
              className="flex items-baseline justify-between gap-6 text-[var(--color-text-invert-faint)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-text-invert)]">
                {String(index + 1).padStart(2, "0")}
                <span className="mx-2 text-[var(--color-text-invert-faint)]">
                  /
                </span>
                {String(total).padStart(2, "0")}
              </span>
              <span className="hidden text-[11px] uppercase tracking-[0.28em] sm:inline">
                {project.role}
              </span>
            </div>

            {/* 3-col (title | hero | aside) when hero present; else 2-col. */}
            <div
              className={
                hasIntroHero
                  ? "grid min-h-0 items-center gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.8fr)_minmax(290px,0.55fr)] lg:gap-7 xl:gap-10"
                  : "grid min-h-0 items-center gap-8 lg:grid-cols-[minmax(0,1.18fr)_minmax(330px,0.62fr)] lg:gap-12 xl:gap-20"
              }
            >
              {titleColumn}
              {heroElement}
              {asideElement}
            </div>
          </div>
        </section>

        {/* MEDIA SECTION SPREADS: one viewport each, layout per section.layout or rotation. */}
        {mediaSections.map(({ section, sectionIndex }) => {
          const sectionMedia = section.media?.slice(0, 2) ?? [];
          const primaryMedia = sectionMedia[0];
          const secondaryMedia = sectionMedia[1];
          const points = section.points ?? [];
          const Layout = section.layout
            ? LAYOUT_MAP[section.layout]
            : MEDIA_LAYOUTS[sectionIndex % MEDIA_LAYOUTS.length];
          // hero layout suppresses the section header so the image goes full-bleed.
          const isHero = section.layout === "hero";
          return (
            <section
              key={section.eyebrow}
              className="flex h-full w-[100svw] shrink-0 px-5 pb-24 pt-14 sm:px-8 sm:pb-28 sm:pt-20 md:px-12 lg:px-10 xl:px-14"
            >
              <div className="mx-auto flex h-full w-full max-w-[min(90svw,1900px)] flex-col gap-4 sm:gap-6">
                {isHero ? null : (
                  <div
                    className="flex items-baseline justify-between gap-6 text-[var(--color-text-invert-faint)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <span className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-text-invert)]">
                      {project.index}{" "}
                      {String(sectionIndex + 1).padStart(2, "0")}
                    </span>
                    <span className="hidden text-[11px] uppercase tracking-[0.28em] sm:inline">
                      {section.eyebrow}
                    </span>
                  </div>
                )}

                <Layout
                  project={project}
                  section={section}
                  sectionIndex={sectionIndex}
                  primaryMedia={primaryMedia}
                  secondaryMedia={secondaryMedia}
                  points={points}
                  onOpen={setLightboxItem}
                />
              </div>
            </section>
          );
        })}

        {/* COMBINED EDITORIAL SPREAD: all text-only sections, one viewport. */}
        {editorialSections.length > 0 || project.closingMedia ? (
          <CombinedEditorialSpread
            project={project}
            sections={editorialSections}
            closingMedia={project.closingMedia}
            onOpen={setLightboxItem}
          />
        ) : null}
      </div>
      {mounted && lightboxItem
        ? createPortal(
            <Lightbox
              item={lightboxItem}
              onClose={() => setLightboxItem(null)}
            />,
            document.body,
          )
        : null}
    </article>
  );
}
