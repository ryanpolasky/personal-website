export type AsciiMotion = "water" | "rain" | "fireflies" | "pulse";

export interface AsciiScene {
  id: string;
  category: "landscape" | "cityscape" | "nature" | "pattern";
  title: string;
  subtitle: string;
  description: string;
  source: string;
  motion: AsciiMotion;
  background: string;
  glow: string;
}
