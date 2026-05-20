"use client";

// layout F: banner-gallery. 2x3 grid of media tiles, full-spread, no
// in-layout typography (so vertical space goes to the grid). designed
// for RyMe.md's SVG output showcase; generalizes to any ~6-tile gallery.

import { MediaFrame } from "./MediaFrame";
import type { SectionLayoutProps } from "./types";

const MAX_TILES = 6;

export function BannerGalleryLayout({ section, onOpen }: SectionLayoutProps) {
  const tiles = (section.media ?? []).slice(0, MAX_TILES);
  return (
    // ProjectPanel renders the section header bar above us, so the
    // eyebrow context is preserved without eating grid height.
    <div className="grid min-h-0 grid-cols-2 grid-rows-3 gap-3 flex-1 sm:gap-4">
      {tiles.map((item, i) => (
        <MediaFrame
          key={item.src ?? `${item.label}-${i}`}
          item={item}
          className="h-full min-h-0"
          sizes="(min-width: 1024px) 720px, 100vw"
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
