"use client";

import { forwardRef } from "react";
import type { Project } from "@/lib/projects";
import { WIDTH_VW } from "@/lib/projects";

// individual card on the horizontal rail. variable width in vw, parallax-aware
// sub-elements get data attributes that the rail's gsap timeline targets.
//
// invert color tokens because cards sit on the dark stage background.

interface ProjectCardProps {
  project: Project;
  // tint color computed from project.tintHsl, applied to the index numeral.
  tintColor: string;
}

export const ProjectCard = forwardRef<HTMLElement, ProjectCardProps>(
  function ProjectCard({ project, tintColor }, ref) {
    const widthVw = WIDTH_VW[project.width];
    return (
      <article
        ref={ref}
        className="relative shrink-0 px-[3vw] sm:px-[3.5vw]"
        style={{ width: `${widthVw}vw` }}
        data-project-card
        data-width={project.width}
        aria-labelledby={`project-${project.id}-name`}
      >
        <div className="grid h-full grid-rows-[1fr_auto] gap-8">
          {/* upper half: index + title block. */}
          <div className="flex flex-col justify-end">
            {/* oversize numeric index, parallax fastest. */}
            <span
              data-parallax="1.18"
              className="display block leading-none text-[clamp(8rem,18vw,18rem)] tracking-[-0.04em]"
              style={{
                color: tintColor,
                fontStyle: "italic",
                fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
              }}
              aria-hidden
            >
              {project.index}
            </span>

            {/* the actual name, parallax slowest. */}
            <h3
              id={`project-${project.id}-name`}
              data-parallax="0.92"
              className="display mt-2 text-[clamp(2.4rem,5vw,5rem)] text-[var(--color-text-invert)]"
            >
              {project.name}
            </h3>

            <p
              data-parallax="1.0"
              className="mt-3 max-w-[36ch] text-[clamp(1rem,1.25vw,1.35rem)] leading-snug text-[var(--color-text-invert-muted)]"
            >
              {project.tagline}
            </p>
          </div>

          {/* lower half: body + meta + cta. */}
          <div
            data-parallax="1.0"
            className="grid gap-6 sm:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-text-invert-muted)] sm:text-base">
                {project.body}
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {project.stack.map((s) => (
                  <span key={s} className="chip chip-invert">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="flex flex-col justify-between gap-4 text-[var(--color-text-invert-muted)] sm:items-end sm:text-right"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <p className="text-[10.5px] uppercase tracking-[0.28em]">
                {project.role}
              </p>
              {project.href ? (
                <a
                  href={project.href}
                  target={
                    project.href.startsWith("http") ? "_blank" : undefined
                  }
                  rel={
                    project.href.startsWith("http")
                      ? "noreferrer noopener"
                      : undefined
                  }
                  className="group inline-flex items-center gap-2 self-start text-[12px] uppercase tracking-[0.22em] text-[var(--color-text-invert)] transition-colors hover:text-[var(--color-accent-soft)] sm:self-end"
                  data-hoverable
                >
                  <span className="border-b border-[var(--color-line-invert-strong)] pb-1 group-hover:border-[var(--color-accent-soft)]">
                    {project.hrefLabel ?? "view project →"}
                  </span>
                </a>
              ) : (
                <p className="self-start text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-invert-faint)] sm:self-end">
                  {project.hrefLabel ?? "-"}
                </p>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  },
);
