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
