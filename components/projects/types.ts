// shared types for project-panel building blocks. lives next to the
// layouts so every layout can pull SectionLayoutProps without round-
// tripping through ProjectPanel.

import type { Project, ProjectMediaItem, ProjectSection } from "@/lib/projects";

// uniform prop shape every section layout receives. layouts may ignore
// any of these (e.g. HeroFullBleedLayout drops everything but the
// primary media), but they all accept the same superset so they're
// drop-in interchangeable in the layout rotation / override map.
export interface SectionLayoutProps {
  project: Project;
  section: ProjectSection;
  sectionIndex: number;
  primaryMedia?: ProjectMediaItem;
  secondaryMedia?: ProjectMediaItem;
  points: string[];
  onOpen?: (item: ProjectMediaItem) => void;
}

// react component type for any section layout. lets us key into a map
// of layouts (LAYOUT_MAP) and pass them around as first-class values.
export type SectionLayoutComponent = (
  props: SectionLayoutProps,
) => React.ReactNode;
