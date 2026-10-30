export type RGB = readonly [number, number, number];
export type ProjectPalette = { surface: RGB; ink: RGB };

export function luminance(rgb: RGB) {
  return rgb.reduce((sum, channel, index) => {
    const value = channel / 255;
    return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

export function contrast(a: RGB, b: RGB) {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function blendPalette(from: ProjectPalette, to: ProjectPalette, progress: number): ProjectPalette {
  const t = Math.max(0, Math.min(1, progress));
  const mix = (a: RGB, b: RGB) => a.map((value, index) => Math.round(value + (b[index] - value) * t)) as unknown as RGB;
  const surface = mix(from.surface, to.surface);
  const ink = mix(from.ink, to.ink);
  return { surface, ink: contrast(surface, ink) >= 4.5 ? ink : luminance(surface) > 0.179 ? [0, 0, 0] : [255, 255, 255] };
}

export const rgb = (values: RGB) => `rgb(${values.join(" ")})`;
export const paletteStyle = (palette: ProjectPalette) => ({ "--project-surface": rgb(palette.surface), "--project-ink": rgb(palette.ink) });
