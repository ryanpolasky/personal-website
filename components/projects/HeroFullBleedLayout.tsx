"use client";

// layout D: full-bleed hero. single image fills the spread; no text.
// opt in via section.layout = 'hero' for pure-visual moments.

import { MediaFrame } from "./MediaFrame";
import type { SectionLayoutProps } from "./types";

export function HeroFullBleedLayout({
  primaryMedia,
  onOpen,
}: SectionLayoutProps) {
  return (
    <div className="relative isolate flex min-h-0 flex-1">
      <MediaFrame
        item={primaryMedia}
        className="h-full min-h-0 w-full"
        sizes="100vw"
        onOpen={onOpen}
      />
    </div>
  );
}
