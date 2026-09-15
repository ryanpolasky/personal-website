import type { AsciiScene } from "@/lib/ascii/types";

export const ASCII_SCENES: AsciiScene[] = [
  {
    id: "moonriver",
    category: "landscape",
    title: "moonriver",
    subtitle: "the last cabin before the wild",
    description:
      "A moonlit alpine lake, a warm cabin, dark pines, and slow silver reflections.",
    source: "/ascii/moonriver-source.webp",
    motion: "water",
    background: "#03070d",
    glow: "#4f86b8",
  },
  {
    id: "neon-rain",
    category: "cityscape",
    title: "neon rain",
    subtitle: "2:17 a.m. and every window is awake",
    description:
      "A rain-soaked metropolis of neon towers, late traffic, steam, and mirrored streets.",
    source: "/ascii/neon-rain-source.webp",
    motion: "rain",
    background: "#05050b",
    glow: "#e13caa",
  },
  {
    id: "old-growth",
    category: "nature",
    title: "old growth",
    subtitle: "the river remembers every name",
    description:
      "Ancient redwoods surround a luminous waterfall, mossy stones, and drifting fireflies.",
    source: "/ascii/old-growth-source.webp",
    motion: "fireflies",
    background: "#030806",
    glow: "#5d9b74",
  },
  {
    id: "interference",
    category: "pattern",
    title: "interference",
    subtitle: "two signals learning how to touch",
    description:
      "An iridescent field of concentric waves folding through one another in luminous symmetry.",
    source: "/ascii/interference-source.webp",
    motion: "pulse",
    background: "#030309",
    glow: "#754dff",
  },
];
