// barrel export for the project-panel design system. consumers (mainly
// ProjectPanel.tsx) can pull everything from '@/components/projects'
// instead of remembering individual file paths. layouts and intros are
// grouped so it's clear which slot in the panel each component fills.

export { MediaFrame } from "./MediaFrame";
export type { MediaFrameProps } from "./MediaFrame";

export { Lightbox } from "./Lightbox";
export type { LightboxProps } from "./Lightbox";

// section layouts (one full viewport spread per section)
export { MosaicLayout } from "./MosaicLayout";
export { BannerLayout } from "./BannerLayout";
export { SpecimenLayout } from "./SpecimenLayout";
export { HeroFullBleedLayout } from "./HeroFullBleedLayout";
export { FormShowcaseLayout } from "./FormShowcaseLayout";
export { BannerGalleryLayout } from "./BannerGalleryLayout";
export { CombinedEditorialSpread } from "./CombinedEditorialSpread";
export type { CombinedEditorialSpreadProps } from "./CombinedEditorialSpread";

// intro hero media variants
export { StackedIntroMedia } from "./StackedIntroMedia";
export type { StackedIntroMediaProps } from "./StackedIntroMedia";
export { CaseFileIntro } from "./CaseFileIntro";
export type { CaseFileIntroProps, CaseFileVital } from "./CaseFileIntro";

// nimby loading-screen parade (4 forms walking left to right)
export { LoadingMarch } from "./LoadingMarch";

// layout registries
export { MEDIA_LAYOUTS, LAYOUT_MAP } from "./layouts";

// shared types
export type { SectionLayoutProps, SectionLayoutComponent } from "./types";
