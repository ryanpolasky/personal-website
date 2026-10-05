"use client";

import { MediaFrame } from "./MediaFrame";
import type { SectionLayoutProps } from "./types";

export function EditorialLayout({
  section,
  primaryMedia,
  onOpen,
}: SectionLayoutProps) {
  return (
    <div className="grid min-h-0 flex-1 items-center gap-8 lg:grid-cols-[minmax(260px,0.65fr)_minmax(0,1.55fr)] xl:gap-12">
      <div className="max-w-[38ch]">
        <h4 className="display text-[clamp(1.9rem,3.4vw,3.7rem)] leading-[0.98] tracking-[-0.04em] text-[var(--color-text-invert)]">
          {section.title}
        </h4>
        <p className="mt-5 text-[clamp(0.9rem,1.05vw,1.1rem)] leading-relaxed text-[var(--color-text-invert-muted)]">
          {section.body}
        </p>
      </div>
      <div className="min-h-0 space-y-3">
        <MediaFrame
          item={primaryMedia}
          className="aspect-[3/2] max-h-[calc(100svh-15rem)]"
          sizes="(min-width: 1024px) 65vw, 100vw"
          onOpen={onOpen}
        />
        {primaryMedia?.label ? (
          <p
            className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-invert-faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {primaryMedia.label}
          </p>
        ) : null}
      </div>
    </div>
  );
}
