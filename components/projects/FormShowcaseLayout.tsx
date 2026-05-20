"use client";

// layout E: form-showcase. one big primary tile + up to three smaller
// tiles stacked on the right. text + points live in the left column.
// pulls media from section.media[] directly so it can access tiles 2+.

import { MediaFrame } from "./MediaFrame";
import type { SectionLayoutProps } from "./types";

const MAX_SMALL_TILES = 3;

export function FormShowcaseLayout({
  project,
  section,
  sectionIndex,
  points,
  onOpen,
}: SectionLayoutProps) {
  const allMedia = section.media ?? [];
  const primary = allMedia[0];
  const smallMedia = allMedia.slice(1, 1 + MAX_SMALL_TILES);
  return (
    <div className="grid min-h-0 flex-1 items-stretch gap-5 sm:gap-7 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)_minmax(180px,0.55fr)] lg:gap-7 xl:gap-9">
      {/* narrative column. eyebrow/title/body sit at the top of the
          column; the form-ability points list lives directly underneath
          since the visual roster on the right is literally those forms
          in motion. */}
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
        <h4 className="display max-w-[16ch] text-[clamp(1.9rem,3.4vw,3.7rem)] leading-[0.95] tracking-[-0.04em] text-[var(--color-text-invert)]">
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

      {/* primary media: hero tile (e.g. druid walksheet). */}
      <div className="relative isolate min-h-0">
        <MediaFrame
          item={primary}
          className="h-full min-h-0"
          sizes="(min-width: 1024px) 660px, 100vw"
          onOpen={onOpen}
        />
      </div>

      {/* small-tile column. row count == smallMedia length. */}
      {smallMedia.length > 0 ? (
        <div
          className="grid min-h-0 gap-3 sm:gap-4"
          style={{
            gridTemplateRows: `repeat(${smallMedia.length}, minmax(0, 1fr))`,
          }}
        >
          {smallMedia.map((item) => (
            <MediaFrame
              key={item.src ?? item.label}
              item={item}
              className="min-h-0"
              sizes="(min-width: 1024px) 240px, 100vw"
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
