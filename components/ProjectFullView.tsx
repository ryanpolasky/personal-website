import Link from "next/link";
import Image from "next/image";
import type { Project } from "@/lib/projects";

// shared content for the expanded project view. used both by the standalone
// /work/[id] page (server-rendered, accessible via direct URL) and by the
// intercepted modal route (mounted over the home page when clicking a card
// from the projects rail). the wrappers around this content differ (the
// modal adds a backdrop + close button + scroll lock), but the content
// itself stays identical so we never drift the two.
//
// when the rail card morphs into the modal via framer-motion layoutId, the
// outer container of THIS view becomes the morph target. that's why every
// element below sits inside the single root div: padding + grid live on
// children, not on a wrapper that would shift mid-morph.

interface ProjectFullViewProps {
  project: Project;
  tintColor: string;
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 100 - l)) / 100 / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function projectTint(project: Project): string {
  if (project.tintHsl)
    return hslToHex(project.tintHsl.h, project.tintHsl.s, project.tintHsl.l);
  return "rgba(244,242,238,0.18)";
}

export function ProjectFullView({ project, tintColor }: ProjectFullViewProps) {
  const mediaItems = project.media.items?.slice(0, 2) ?? [];

  return (
    <article
      className="relative flex h-full w-full flex-col overflow-y-auto px-6 pb-12 pt-14 sm:px-12 sm:pb-16 sm:pt-20 md:px-20 md:pt-24 lg:px-32"
      data-lenis-prevent
      aria-labelledby={`project-${project.id}-name`}
    >
      {/* decorative giant index pushed behind content */}
      <span
        className="display pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(14rem,46vw,42rem)] leading-none tracking-tighter opacity-[0.06]"
        style={{
          color: tintColor,
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
          zIndex: 0,
        }}
        aria-hidden
      >
        {project.index}
      </span>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 lg:gap-16">
        {/* top meta strip */}
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="text-[12px] uppercase tracking-[0.32em] text-[var(--color-text-invert)]">
            {project.index} {project.name.toLowerCase()}
          </span>
          <span className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-text-invert-faint)]">
            {project.role}
          </span>
        </div>

        {/* identity: huge name + tagline */}
        <header className="flex flex-col gap-5">
          <h1
            id={`project-${project.id}-name`}
            className="display text-[clamp(3rem,7vw,8rem)] leading-[0.95] text-[var(--color-text-invert)]"
          >
            {project.name}
          </h1>
          <p className="max-w-[44ch] text-[clamp(1.1rem,1.6vw,1.8rem)] leading-snug text-[var(--color-text-invert-muted)]">
            {project.tagline}
          </p>
        </header>

        {/* body grid: long-form copy + stack/meta column */}
        <div className="grid gap-12 sm:grid-cols-[1.5fr_1fr] sm:items-start sm:gap-16">
          <div className="space-y-6">
            <p className="text-[15px] leading-relaxed text-[var(--color-text-invert-muted)] sm:text-base">
              {project.body}
            </p>
            {mediaItems.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {mediaItems.map((item) => (
                  <div
                    key={item.label}
                    className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-[0_24px_70px_-48px_rgba(0,0,0,0.9)]"
                    style={{
                      backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035)), radial-gradient(circle at 24% 18%, ${tintColor}55, transparent 42%)`,
                    }}
                  >
                    {item.src ? (
                      <Image
                        src={item.src}
                        alt={item.alt ?? item.label}
                        fill
                        sizes="(min-width: 640px) 360px, 100vw"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col justify-between p-5">
                        <div className="flex gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                          <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-2 w-3/5 rounded-full bg-white/20" />
                          <div className="h-2 w-4/5 rounded-full bg-white/12" />
                          <div className="h-2 w-2/5 rounded-full bg-white/10" />
                        </div>
                        <div
                          className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-invert-faint)]"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {item.label}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            {/* room for additional copy / images per project later; the
                modal/standalone page will grow naturally as the data model
                expands. for now, body is the substantive content. */}
          </div>

          <aside
            className="space-y-8"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <div className="space-y-3">
              <p className="text-[10.5px] uppercase tracking-[0.32em] text-[var(--color-text-invert-faint)]">
                stack
              </p>
              <div className="flex flex-wrap gap-1.5">
                {project.stack.map((s) => (
                  <span key={s} className="chip chip-invert">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10.5px] uppercase tracking-[0.32em] text-[var(--color-text-invert-faint)]">
                role
              </p>
              <p className="text-[13px] text-[var(--color-text-invert)]">
                {project.role}
              </p>
            </div>

            {project.href ? (
              <div className="space-y-3">
                <p className="text-[10.5px] uppercase tracking-[0.32em] text-[var(--color-text-invert-faint)]">
                  link
                </p>
                <Link
                  href={project.href}
                  target={
                    project.href.startsWith("http") ? "_blank" : undefined
                  }
                  rel={
                    project.href.startsWith("http")
                      ? "noreferrer noopener"
                      : undefined
                  }
                  className="group inline-flex items-center text-[13px] uppercase tracking-[0.22em] text-[var(--color-text-invert)] transition-colors hover:text-[var(--color-accent-soft)]"
                  data-hoverable
                >
                  <span className="border-b border-[var(--color-line-invert-strong)] pb-1 transition-colors group-hover:border-[var(--color-accent-soft)]">
                    {project.hrefLabel ?? "view project →"}
                  </span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10.5px] uppercase tracking-[0.32em] text-[var(--color-text-invert-faint)]">
                  status
                </p>
                <p className="text-[13px] text-[var(--color-text-invert-muted)]">
                  {project.hrefLabel ?? "in development"}
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </article>
  );
}
