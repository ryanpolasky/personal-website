"use client";

// combined editorial spread. all text-only sections render as columns
// in a single viewport, so the rail allocates 1 spread instead of N
// for content with no media. matches projectSpreadCount math.

import type { Project, ProjectMediaItem, ProjectSection } from "@/lib/projects";
import { MediaFrame } from "./MediaFrame";

export interface CombinedEditorialSpreadProps {
  project: Project;
  sections: ProjectSection[];
  // optional accent image rendered as a leading card next to the
  // editorial columns (closing capsule).
  closingMedia?: ProjectMediaItem;
  onOpen?: (item: ProjectMediaItem) => void;
}

export function CombinedEditorialSpread({
  project,
  sections,
  closingMedia,
  onOpen,
}: CombinedEditorialSpreadProps) {
  if (sections.length === 0 && !closingMedia) return null;
  // closingMedia becomes a leading column at 1.15fr; text columns are 1fr.
  const gridCols = closingMedia
    ? `minmax(0, 1.15fr) ${"minmax(0, 1fr) ".repeat(sections.length).trim()}`
    : `repeat(${sections.length}, minmax(0, 1fr))`;
  return (
    <section className="flex h-full w-[100svw] shrink-0 px-5 pb-24 pt-14 sm:px-8 sm:pb-28 sm:pt-20 md:px-12 lg:px-10 xl:px-14">
      <div className="mx-auto flex h-full w-full max-w-[min(90svw,1900px)] flex-col gap-4 sm:gap-6">
        <div
          className="flex items-baseline justify-between gap-6 text-[var(--color-text-invert-faint)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-text-invert)]">
            {project.index}
          </span>
          <span className="hidden text-[11px] uppercase tracking-[0.28em] sm:inline">
            {sections.length} sections · overview
          </span>
        </div>

        <div
          className="grid min-h-0 flex-1 items-stretch gap-6 sm:gap-8 lg:gap-10"
          style={{
            gridTemplateColumns: gridCols,
          }}
        >
          {/* closing accent card (leading column when present). */}
          {closingMedia ? (
            <div className="relative isolate flex min-h-0 flex-col gap-3">
              <div
                className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-invert-faint)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className="h-1 w-1 rounded-full bg-[var(--project-tint)] shadow-[0_0_10px_var(--project-tint)]" />
                <span>{closingMedia.label}</span>
              </div>
              <MediaFrame
                item={closingMedia}
                className="min-h-0 flex-1"
                sizes="(min-width: 1024px) 540px, 100vw"
                onOpen={onOpen}
              />
            </div>
          ) : null}
          {sections.map((section, idx) => (
            <div
              key={section.eyebrow}
              className="relative isolate flex min-h-0 flex-col justify-center overflow-hidden"
            >
              <div className="pointer-events-none absolute -left-4 top-0 h-[55%] w-px bg-[linear-gradient(to_bottom,transparent,var(--project-tint),transparent)] opacity-60" />
              <div
                className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-invert-faint)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className="text-[var(--project-tint)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="h-px w-6 bg-[var(--project-tint)] opacity-50" />
                <span>{section.eyebrow}</span>
              </div>
              <h4 className="display max-w-[16ch] text-[clamp(1.4rem,2.1vw,2.3rem)] leading-[0.98] tracking-[-0.035em] text-[var(--color-text-invert)]">
                {section.title}
              </h4>
              <p className="mt-4 text-[clamp(0.85rem,0.95vw,0.98rem)] leading-relaxed text-[var(--color-text-invert-muted)]">
                {section.body}
              </p>
              {(section.points?.length ?? 0) > 0 ? (
                <ol className="mt-5 space-y-2 border-l border-[var(--color-line-invert-strong)] pl-3">
                  {section.points!.map((point, i) => (
                    <li
                      key={point}
                      className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-[11.5px] leading-snug text-[var(--color-text-invert-muted)]"
                    >
                      <span
                        className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--project-tint)]"
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
          ))}
        </div>
      </div>
    </section>
  );
}
