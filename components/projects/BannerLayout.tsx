"use client";

// layout B: poster banner. primary media top, eyebrow+title overlay, 3-cell strip below.

import { MediaFrame } from "./MediaFrame";
import type { SectionLayoutProps } from "./types";

export function BannerLayout({
  section,
  primaryMedia,
  secondaryMedia,
  points,
  onOpen,
}: SectionLayoutProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4 sm:gap-5">
      <div className="relative isolate min-h-0">
        <MediaFrame
          item={primaryMedia}
          className="h-full min-h-0"
          sizes="(min-width: 1024px) 1500px, 100vw"
          onOpen={onOpen}
          fit="cover"
        />
        <div className="pointer-events-none absolute inset-0 rounded-[1.65rem] bg-[linear-gradient(115deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.45)_38%,transparent_68%),linear-gradient(to_top,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0.18)_32%,transparent_55%)]" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 sm:p-8 lg:p-10">
          <div
            className="flex items-center gap-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="h-px w-12 bg-[var(--project-tint)] shadow-[0_0_10px_var(--project-tint)]" />
            <span className="text-[10px] uppercase tracking-[0.32em] text-white/80">
              {section.eyebrow}
            </span>
          </div>
          <h4 className="display max-w-[22ch] text-[clamp(2rem,3.7vw,3.9rem)] leading-[0.94] tracking-[-0.04em] text-white">
            {section.title}
          </h4>
        </div>
      </div>

      {/* march variant: redistributes body -> march without changing
          total fr-units, so signal width as % of bottom row stays
          fixed at 1.1/3.6. body and march swap (1.5/1.0 -> 1.2/1.3). */}
      <div
        className={
          secondaryMedia?.march
            ? "grid min-h-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)]"
            : "grid min-h-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)]"
        }
      >
        <div className="relative isolate flex min-h-0 flex-col justify-start overflow-hidden pt-1">
          <div
            className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-invert-faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span>body</span>
            <span className="h-px flex-1 bg-[var(--color-line-invert)] opacity-30" />
          </div>
          <p className="text-[clamp(0.9rem,1.05vw,1.1rem)] leading-relaxed text-[var(--color-text-invert-muted)]">
            {section.body}
          </p>
        </div>

        {secondaryMedia ? (
          secondaryMedia.march ? (
            // calc(100% + Xrem) grows the cell's visual width into the
            // grid gap, butting its overflow-hidden edge against signal.
            <div className="relative h-full min-h-0 w-[calc(100%+1rem)] sm:w-[calc(100%+1.25rem)]">
              <MediaFrame
                item={secondaryMedia}
                className="h-full min-h-0"
                sizes="(min-width: 1024px) 480px, 100vw"
                onOpen={onOpen}
              />
            </div>
          ) : (
            <MediaFrame
              item={secondaryMedia}
              className="h-full min-h-0"
              sizes="(min-width: 1024px) 360px, 100vw"
              onOpen={onOpen}
            />
          )
        ) : (
          <div />
        )}

        {points.length > 0 ? (
          <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklab,var(--project-tint)_22%,transparent),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.07))] p-4 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.9)] sm:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,var(--project-tint),transparent)] opacity-60" />
            <div
              className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-invert-faint)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="h-px flex-1 bg-[var(--color-line-invert)] opacity-30" />
              <span>signal</span>
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
