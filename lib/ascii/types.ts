export type AsciiTone =
  | "ink"
  | "shadow"
  | "wood"
  | "warm"
  | "ember"
  | "fire"
  | "moon"
  | "snow"
  | "leaf"
  | "fabric";

export interface AsciiPalette {
  background: string;
  glow: string;
  tones: Record<AsciiTone, string>;
}

export interface AsciiScene {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  frames: string[];
  frameDuration: number;
  palette: AsciiPalette;
  toneAt: (row: number, column: number, character: string) => AsciiTone;
}
