"use client";

// layout C: specimen sheet. text + numbered list on the left, two
// equal-height media frames on the right. reads like a datasheet.

import { MediaFrame } from "./MediaFrame";
import type { SectionLayoutProps } from "./types";

export function SpecimenLayout({
  project,
  section,
  sectionIndex,
  primaryMedia,
  secondaryMedia,
  points,
  onOpen,
}: SectionLayoutProps) {
  return (
    <div className="grid min-h-0 flex-1 items-stretch gap-5 sm:gap-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] lg:gap-8 xl:gap-12">
      <div className="relative isolate flex min-h-0 flex-col justify-start overflow-hidden">
        <div className="pointer-events-none absolute -left-8 top-0 h-[55%] w-px bg-[linear-gradient(to_bottom,transparent,var(--project-tint),transparent)] opacity-70" />
        <div
          className="mb-3 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.32em] text-[var(--color-text-invert-faint)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>{section.eyebrow}</span>
          <span className="h-px flex-1 bg-[var(--color-line-invert)] opacity-30" />
          <span className="text-[var(--project-tint)] opacity-80">
            {String(sectionIndex + 1).padStart(2, "0")}/
            {project.index.replace(".", "")}
          </span>
        </div>
        <h4 className="display max-w-[15ch] text-[clamp(1.9rem,3.4vw,3.7rem)] leading-[0.95] tracking-[-0.04em] text-[var(--color-text-invert)]">
          {section.title}
        </h4>
        <p className="mt-5 text-[clamp(0.88rem,1vw,1.05rem)] leading-relaxed text-[var(--color-text-invert-muted)]">
          {section.body}
        </p>
        {points.length > 0 ? (
          <ol className="mt-6 space-y-2.5 border-l border-[var(--color-line-invert-strong)] pl-4">
            {points.map((point, i) => (
              <li
                key={point}
                className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-[12.5px] leading-snug text-[var(--color-text-invert-muted)]"
              >
                <span
                  className="text-[9.5px] uppercase tracking-[0.22em] text-[var(--project-tint)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  → {String(i + 1).padStart(2, "0")}
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {/* both tiles share matching tag chrome; text from item.label
          so data declares what each row says. previously hard-coded
          different pill styles, which felt arbitrary and only ever
          rendered usefully on MM's section. */}
      <div className="grid min-h-0 grid-rows-2 gap-3 sm:gap-4">
        <div className="relative isolate min-h-0">
          <MediaFrame
            item={primaryMedia}
            className="h-full min-h-0"
            sizes="(min-width: 1024px) 820px, 100vw"
            onOpen={onOpen}
          />
          {primaryMedia?.label ? (
            <div
              className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/85 backdrop-blur-md"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="h-1 w-1 rounded-full bg-[var(--project-tint)] shadow-[0_0_10px_var(--project-tint)]" />
              <span>{primaryMedia.label}</span>
            </div>
          ) : null}
        </div>
        {secondaryMedia ? (
          <div className="relative isolate min-h-0">
            <MediaFrame
              item={secondaryMedia}
              className="h-full min-h-0"
              sizes="(min-width: 1024px) 820px, 100vw"
              onOpen={onOpen}
            />
            {secondaryMedia.label ? (
              <div
                className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/85 backdrop-blur-md"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className="h-1 w-1 rounded-full bg-[var(--project-tint)] shadow-[0_0_10px_var(--project-tint)]" />
                <span>{secondaryMedia.label}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
