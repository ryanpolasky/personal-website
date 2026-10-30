export function projectSequence<T extends { id: string }>(projects: T[], id: string): T[] {
  const start = Math.max(0, projects.findIndex((project) => project.id === id));
  return [...projects.slice(start), ...projects.slice(0, start)];
}

export function trackPosition(scroll: number, start: number, distance: number) {
  return Math.max(0, Math.min(Math.max(0, distance), scroll - start));
}

export function activeTrackIndex(offsets: number[], position: number, viewport: number) {
  let active = 0;
  for (let index = 1; index < offsets.length; index++) {
    if (offsets[index] > position + viewport * 0.3) break;
    active = index;
  }
  return active;
}

function handoffRange(offsets: number[], index: number, viewport: number) {
  const travel = Math.max(1, Math.min(viewport * 0.72, (offsets[index] - offsets[index - 1]) * 0.7));
  return { start: offsets[index] - travel, travel, effort: travel * 0.95 / 0.72 };
}

export function trackScroll(position: number, offsets: number[], viewport: number) {
  const x = Math.max(0, position);
  let extra = 0;
  for (let index = 1; index < offsets.length; index++) {
    const { start, travel, effort } = handoffRange(offsets, index, viewport);
    if (x < start) return x + extra;
    if (x <= offsets[index]) return start + extra + Math.cbrt((x - start) / travel) * effort;
    extra += effort - travel;
  }
  return x + extra;
}

export function trackHandoff(scroll: number, offsets: number[], viewport: number, distance: number) {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const bounded = (value: number) => Math.max(0, Math.min(distance, value));
  let extra = 0;
  for (let index = 1; index < offsets.length; index++) {
    const { start, travel, effort } = handoffRange(offsets, index, viewport);
    if (scroll < start + extra) return { position: bounded(scroll - extra), from: index - 1, to: index - 1, pressure: 0, blend: 0 };
    if (scroll < start + extra + effort) {
      const pressure = clamp((scroll - start - extra) / effort);
      const t = clamp((pressure - 0.55) / 0.45);
      return { position: bounded(start + pressure ** 3 * travel), from: index - 1, to: index, pressure, blend: t * t * (3 - 2 * t) };
    }
    extra += effort - travel;
  }
  return { position: bounded(scroll - extra), from: offsets.length - 1, to: offsets.length - 1, pressure: 0, blend: 0 };
}
