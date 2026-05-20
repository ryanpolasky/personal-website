"use client";

// layout A: 3-column editorial mosaic. text left, dominant primary media
// center as the visual anchor, sidecar on the right (secondary media
// stacked over a numbered signal card). good for sections whose narrative
// leans on a single hero asset with supporting bullets.

import { MediaFrame } from "./MediaFrame";
import type { SectionLayoutProps } from "./types";

export function MosaicLayout({
  section,
  primaryMedia,
  secondaryMedia,
  points,
  onOpen,
}: SectionLayoutProps) {
  return (
    <div className="grid min-h-0 flex-1 items-stretch gap-5 sm:gap-7 lg:grid-cols-[minmax(260px,0.62fr)_minmax(0,1.2fr)_minmax(220px,0.7fr)] lg:gap-7 xl:gap-9">
      <div className="relative isolate flex min-h-0 flex-col justify-start overflow-hidden">
        <div className="pointer-events-none absolute -left-8 top-0 h-[72%] w-px bg-[linear-gradient(to_bottom,transparent,var(--project-tint),transparent)] opacity-70" />
        <p
          className="mb-3 text-[10.5px] uppercase tracking-[0.32em] text-[var(--color-text-invert-faint)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {section.eyebrow}
        </p>
        <h4 className="display max-w-[16ch] text-[clamp(1.9rem,3.5vw,3.6rem)] leading-[0.96] tracking-[-0.04em] text-[var(--color-text-invert)]">
          {section.title}
        </h4>
        <div
          className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-invert-faint)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="h-px flex-1 bg-[linear-gradient(to_right,var(--project-tint),transparent)] opacity-60" />
          <span>note</span>
        </div>
        <p className="mt-4 text-[clamp(0.9rem,1.05vw,1.1rem)] leading-relaxed text-[var(--color-text-invert-muted)]">
          {section.body}
        </p>
      </div>

      <div className="relative isolate min-h-0">
        <MediaFrame
          item={primaryMedia}
          className="h-full min-h-0"
          sizes="(min-width: 1024px) 720px, 100vw"
          onOpen={onOpen}
        />
      </div>

      <div className="grid min-h-0 grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3 sm:gap-4">
        {secondaryMedia ? (
          <MediaFrame
            item={secondaryMedia}
            className="min-h-0"
            sizes="(min-width: 1024px) 320px, 100vw"
            onOpen={onOpen}
          />
        ) : (
          <div />
        )}
        {points.length > 0 ? (
          <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklab,var(--project-tint)_22%,transparent),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.07))] p-4 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.9)] sm:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,var(--project-tint),transparent)] opacity-60" />
            <div
              className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-invert-faint)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span>signal</span>
              <span className="h-px flex-1 bg-[var(--color-line-invert)] opacity-30" />
            </div>
            <ul className="space-y-2.5">
              {points.map((point, i) => (
                <li
                  key={point}
                  className="grid grid-cols-[auto_1fr] gap-3 text-[12px] leading-snug text-[var(--color-text-invert-muted)]"
                >
                  <span
                    className="mt-[3px] text-[9.5px] uppercase tracking-[0.18em] text-[var(--project-tint)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
