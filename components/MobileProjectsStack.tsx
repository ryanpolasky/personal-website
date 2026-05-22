"use client";

import Image from "next/image";
import Link from "next/link";
import { getEnabledProjects } from "@/lib/projects";

const projects = getEnabledProjects();
const MONO = { fontFamily: "var(--font-mono)" } as const;

function tintFor(project: (typeof projects)[number]): string {
  const hsl = project.tintHsl;
  if (!hsl) return "rgba(244,242,238,0.32)";
  return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;
}

// Per-project media overrides for the mobile stack only. Use this when the
// desktop hero shot doesn't read well at phone width and a different
// screenshot is a better single-frame summary of the project.
const MOBILE_MEDIA_OVERRIDES: Record<
  string,
  { label: string; src: string; alt: string }
> = {
  autopsy: {
    label: "run details",
    src: "/assets/projects/autopsy/aut_details.png",
    alt: "Autopsy per-run details view",
  },
};

function firstMedia(project: (typeof projects)[number]) {
  const override = MOBILE_MEDIA_OVERRIDES[project.id];
  if (override) return override;
  if (project.media.kind !== "image") return undefined;
  return project.media.items?.find((item) => item.src);
}

export function MobileProjectsStack() {
  return (
    <section
      className="relative overflow-hidden bg-[#050507] px-3 pb-5 pt-6 sm:px-6 sm:pb-8 sm:pt-10 md:px-8 xl:hidden"
      aria-label="projects"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_4%,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%,rgba(255,255,255,0.03)_100%)]" />

      <header className="relative z-10 mx-auto mb-6 flex max-w-[58rem] items-end justify-between gap-4 px-1 sm:mb-8">
        <div>
          <p
            className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.32em] text-white/45"
            style={MONO}
          >
            <span className="h-px w-6 bg-white/30" />
            03 / projects
          </p>
          <h2 className="display mt-2 text-[clamp(3rem,16vw,5.5rem)] leading-[0.82] tracking-[-0.06em] text-white sm:text-[clamp(4.5rem,11vw,7.5rem)]">
            selected
            <br />
            systems
          </h2>
        </div>
        <p
          className="mb-1 text-right text-[9px] uppercase tracking-[0.26em] text-white/38 sm:text-[10px]"
          style={MONO}
        >
          {String(projects.length).padStart(2, "0")}
          <br />
          projects
        </p>
      </header>

      <div className="relative z-10 mx-auto flex max-w-[58rem] flex-col gap-5 sm:gap-7">
        {projects.map((project, i) => {
          const tint = tintFor(project);
          const media = firstMedia(project);
          const hrefIsExternal = project.href?.startsWith("http") ?? false;
          const githubHref = Array.isArray(project.githubHref)
            ? project.githubHref[0]?.href
            : project.githubHref;
          const topSections = (project.sections ?? []).slice(0, 2);
          const primaryHref = project.href;
          const primaryLabel = (project.hrefLabel ?? "visit").replace(/\s*→$/, "");

          return (
            <article
              key={project.id}
              className="relative isolate overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(150deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03)_44%,rgba(255,255,255,0.06))] pb-5 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.12)] sm:rounded-[2rem] sm:pb-7"
              style={{ ["--project-tint" as string]: tint }}
            >
              {/* atmospheric tint wash */}
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_-4%,color-mix(in_oklab,var(--project-tint)_52%,transparent),transparent_36%),radial-gradient(circle_at_92%_104%,color-mix(in_oklab,var(--project-tint)_30%,transparent),transparent_38%)]" />

              {/* top accent strip */}
              <div
                className="absolute inset-x-0 top-0 h-[2px] opacity-90"
                style={{
                  background:
                    "linear-gradient(to right, transparent, var(--project-tint), transparent)",
                }}
                aria-hidden
              />

              {/* huge index watermark */}
              <div className="pointer-events-none absolute -right-6 top-2 -z-10 select-none text-[9rem] leading-none tracking-[-0.09em] opacity-[0.08] sm:-right-8 sm:text-[14rem]">
                <span
                  className="display italic"
                  style={{
                    color: tint,
                    fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
                  }}
                >
                  {project.index}
                </span>
              </div>

              {/* HEADER ROW: index + role */}
              <div
                className="flex items-center justify-between gap-3 px-5 pt-5 text-[10px] uppercase tracking-[0.28em] text-white/55 sm:px-7 sm:pt-7 sm:text-[10.5px]"
                style={MONO}
              >
                <span className="flex items-center gap-2 text-white/80">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: tint, boxShadow: `0 0 8px ${tint}` }}
                    aria-hidden
                  />
                  {String(i + 1).padStart(2, "0")}
                  <span className="text-white/30">/</span>
                  <span className="text-white/45">
                    {String(projects.length).padStart(2, "0")}
                  </span>
                </span>
                <span className="text-white/45">{project.role}</span>
              </div>

              <div className="sm:grid sm:grid-cols-[minmax(0,1.16fr)_minmax(17rem,0.84fr)] sm:items-start sm:gap-6 sm:px-7 sm:pt-5">
                {/* MEDIA HERO (when available) — natural aspect, no cover crop */}
                {media?.src ? (
                  <div className="relative mx-5 mt-4 overflow-hidden rounded-[1.05rem] border border-white/10 bg-black/40 shadow-[0_22px_60px_-38px_rgba(0,0,0,0.95)] sm:mx-0 sm:mt-0 sm:rounded-[1.25rem]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={media.src}
                      alt={media.alt ?? `${project.name} preview`}
                      loading="lazy"
                      decoding="async"
                      className="block h-auto w-full"
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
                      style={{
                        background:
                          "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))",
                      }}
                    />
                    <p
                      className="absolute bottom-3 left-3 flex items-center gap-2 text-[9px] uppercase tracking-[0.28em] text-white/85"
                      style={MONO}
                    >
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{ background: tint }}
                        aria-hidden
                      />
                      {media.label}
                    </p>
                  </div>
                ) : null}

                {/* TITLE BLOCK */}
                <div className="mt-5 px-5 sm:mt-1 sm:px-0">
                  {project.logoSrc ? (
                    <Image
                      src={project.logoSrc}
                      alt={project.name}
                      width={1014}
                      height={313}
                      unoptimized
                      className="h-auto w-full max-w-[18rem] [image-rendering:pixelated] sm:max-w-[20rem]"
                    />
                  ) : (
                    <h3 className="display max-w-[9ch] text-[clamp(2.85rem,13.5vw,4.8rem)] leading-[0.82] tracking-[-0.06em] text-white sm:text-[clamp(3.8rem,7vw,5.5rem)]">
                      {project.name}
                    </h3>
                  )}
                  <div
                    className="mt-4 h-px w-12 opacity-80 sm:w-16"
                    style={{ background: tint }}
                    aria-hidden
                  />
                  <p className="mt-4 max-w-[34ch] text-[1.05rem] leading-[1.18] text-white/82 sm:text-[1.22rem] sm:leading-[1.12]">
                    {project.tagline}
                  </p>
                </div>
              </div>

              {/* BRIEF + SECTION HIGHLIGHTS */}
              <div className="mx-5 mt-5 rounded-[1.1rem] border border-white/10 bg-black/25 p-4 backdrop-blur-sm sm:mx-7 sm:mt-6 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)] sm:gap-5 sm:p-5">
                <p className="text-[13px] leading-[1.55] text-white/72 sm:text-[14px] sm:leading-[1.65]">
                  {project.body}
                </p>
                {topSections.length > 0 ? (
                  <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                    {topSections.map((section) => (
                      <div key={section.eyebrow}>
                        <p
                          className="text-[9.5px] uppercase tracking-[0.26em] text-[color-mix(in_oklab,var(--project-tint)_78%,white)]"
                          style={MONO}
                        >
                          {section.eyebrow}
                        </p>
                        <p className="mt-1 text-[13px] leading-[1.3] text-white/85 sm:text-[14px]">
                          {section.title}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* STACK */}
              <div className="mt-5 px-5 sm:mt-6 sm:px-7">
                <div className="flex flex-wrap gap-1.5">
                  {project.stack.map((item) => (
                    <span key={item} className="chip chip-invert">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* ACTIONS */}
              <div className="mt-5 flex flex-wrap items-center gap-2 px-5 sm:mt-6 sm:px-7">
                {primaryHref ? (
                  <Link
                    href={primaryHref}
                    target={hrefIsExternal ? "_blank" : undefined}
                    rel={hrefIsExternal ? "noreferrer noopener" : undefined}
                    className="group relative inline-flex h-12 flex-1 min-w-[160px] items-center justify-between gap-2 overflow-hidden rounded-full border px-5 text-[11.5px] uppercase tracking-[0.24em] text-white transition-colors sm:h-[3.25rem] sm:min-w-[220px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      borderColor:
                        "color-mix(in oklab, var(--project-tint) 55%, rgba(255,255,255,0.18))",
                      background:
                        "linear-gradient(120deg, color-mix(in oklab, var(--project-tint) 28%, transparent), rgba(255,255,255,0.06))",
                    }}
                  >
                    <span>{primaryLabel}</span>
                    <span className="text-base leading-none">↗</span>
                  </Link>
                ) : (
                  <span
                    className="inline-flex h-12 flex-1 min-w-[160px] items-center justify-between gap-2 rounded-full border border-dashed border-white/15 px-5 text-[11.5px] uppercase tracking-[0.24em] text-white/55 sm:h-[3.25rem] sm:min-w-[220px]"
                    style={MONO}
                  >
                    <span>{project.hrefLabel ?? "internal"}</span>
                    <span aria-hidden>·</span>
                  </span>
                )}

                {githubHref ? (
                  <Link
                    href={githubHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${project.name} on github`}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition-colors active:bg-white/[0.14] sm:h-[3.25rem] sm:w-[3.25rem]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.9-.39.99 0 1.98.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.77 1.06.77 2.15 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.79.55 4.57-1.53 7.86-5.85 7.86-10.95C23.5 5.65 18.35.5 12 .5z" />
                    </svg>
                  </Link>
                ) : null}

                {project.devpostHref ? (
                  <Link
                    href={project.devpostHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${project.name} on devpost`}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition-colors active:bg-white/[0.14] sm:h-[3.25rem] sm:w-[3.25rem]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M6.002 1.61L0 12.004 6.002 22.39h11.996L24 12.004 17.998 1.61H6.002zm1.84 4.05h6.297c5.494 0 7.864 2.715 7.864 6.291v.121c0 3.574-2.37 6.288-7.864 6.288H7.842V5.66zm2.91 2.328v7.927h2.875c3.222 0 4.6-1.444 4.6-3.93v-.067c0-2.486-1.378-3.93-4.6-3.93h-2.875z" />
                    </svg>
                  </Link>
                ) : null}
              </div>

            </article>
          );
        })}
      </div>

    </section>
  );
}
