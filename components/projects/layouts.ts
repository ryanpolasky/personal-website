// section layout registry.
// - MEDIA_LAYOUTS: rotation cycled by section index when no override.
// - LAYOUT_MAP: name -> component for explicit `section.layout` overrides.
//   hero/forms/gallery live here only (not in rotation) since they
//   have specific media-count expectations.

import { MosaicLayout } from "./MosaicLayout";
import { BannerLayout } from "./BannerLayout";
import { SpecimenLayout } from "./SpecimenLayout";
import { HeroFullBleedLayout } from "./HeroFullBleedLayout";
import { FormShowcaseLayout } from "./FormShowcaseLayout";
import { BannerGalleryLayout } from "./BannerGalleryLayout";
import type { SectionLayoutComponent } from "./types";

export const MEDIA_LAYOUTS = [
  MosaicLayout,
  BannerLayout,
  SpecimenLayout,
] as const satisfies readonly SectionLayoutComponent[];

export const LAYOUT_MAP = {
  mosaic: MosaicLayout,
  banner: BannerLayout,
  specimen: SpecimenLayout,
  hero: HeroFullBleedLayout,
  forms: FormShowcaseLayout, // expects 4 media items
  gallery: BannerGalleryLayout, // 2x3 grid, up to 6 items
} as const satisfies Record<string, SectionLayoutComponent>;
