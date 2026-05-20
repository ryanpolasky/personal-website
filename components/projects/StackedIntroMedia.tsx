"use client";

// default intro hero media: 1:1 stack of two contained screenshots,
// or a single full-column tile when secondary is absent.

import { MediaFrame } from "./MediaFrame";
import type { ProjectMediaItem } from "@/lib/projects";

export interface StackedIntroMediaProps {
  primary?: ProjectMediaItem;
  secondary?: ProjectMediaItem;
  onOpen: (item: ProjectMediaItem) => void;
}

export function StackedIntroMedia({
  primary,
  secondary,
  onOpen,
}: StackedIntroMediaProps) {
  // collapse to a single row when secondary is absent so primary fills.
  const hasSecondary = !!secondary?.src;
  return (
    <div
      className={`grid h-full min-h-0 max-h-[68svh] gap-3 sm:gap-4 ${
        hasSecondary ? "grid-rows-2" : "grid-rows-1"
      }`}
    >
      <MediaFrame
        item={primary}
        className="min-h-0"
        sizes="(min-width: 1024px) 560px, 100vw"
        onOpen={onOpen}
      />
      {hasSecondary ? (
        <MediaFrame
          item={secondary}
          className="min-h-0"
          sizes="(min-width: 1024px) 560px, 100vw"
          onOpen={onOpen}
        />
      ) : null}
    </div>
  );
}
