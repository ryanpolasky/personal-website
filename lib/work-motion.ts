const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function workMotion(sectionTop: number, viewportHeight: number) {
  const progress = clamp(1 - sectionTop / Math.max(1, viewportHeight * 0.65));
  return {
    charge: Math.sin(progress * Math.PI) * 0.6,
    reveal: progress * progress * (3 - 2 * progress),
  };
}
