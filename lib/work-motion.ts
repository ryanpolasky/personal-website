export const HOLD_DURATION = 800;
export const REVEAL_DURATION = 1200;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function workMotion(heldFor: number, revealedFor: number | null) {
  const charge = revealedFor === null ? clamp(heldFor / HOLD_DURATION) : 1;
  const timed = revealedFor === null ? 0 : 1 - Math.pow(1 - clamp(revealedFor / REVEAL_DURATION), 3);
  return { charge, reveal: timed };
}
