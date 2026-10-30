export type WorkFieldItem = { x: number; y: number; z: number; scale: number };
export const WORK_FIELD_DRIFT = 0.08;

const halton = (index: number, base: number) => {
  let value = 0;
  let fraction = 1 / base;
  while (index > 0) {
    value += fraction * (index % base);
    index = Math.floor(index / base);
    fraction /= base;
  }
  return value;
};

export function createWorkFieldLayout(aspect: number, radius: number): WorkFieldItem[] {
  const halfHeight = 13 * Math.tan((38 * Math.PI) / 360);
  const halfWidth = halfHeight * aspect;
  const portrait = aspect < 0.75;
  const size = portrait
    ? Math.min(0.56, 0.48 * Math.sqrt(aspect / 0.46))
    : Math.min(1.12, 0.78 * Math.sqrt(aspect / 1.44));
  const target = portrait ? 20 : aspect > 1.9 ? 30 : 24;
  const items: WorkFieldItem[] = [];

  for (let i = 1; i <= 2400 && items.length < target; i++) {
    const z = Math.sin(i * 2.73) * 1.5;
    const scale = size * (0.9 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 0.2);
    const bound = radius * scale;
    const x = (halton(i, 2) * 2 - 1) * (halfWidth * (13 - z) / 13 - bound - 0.17);
    const y = (halton(i, 3) * 2 - 1) * (halfHeight * (13 - z) / 13 - bound - 0.17);
    const projected = 13 / (13 - z);

    if (items.some((item) => {
      const distance = Math.hypot(x - item.x, y - item.y, z - item.z);
      const otherBound = radius * item.scale;
      const otherProjected = 13 / (13 - item.z);
      const screenDistance = Math.hypot(x * projected - item.x * otherProjected, y * projected - item.y * otherProjected);
      return distance < bound + otherBound + 0.32 ||
        screenDistance < 0.74 * (bound * projected + otherBound * otherProjected);
    })) continue;

    items.push({ x, y, z, scale });
  }

  return items;
}
