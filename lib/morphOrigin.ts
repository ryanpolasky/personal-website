// transient client-only store for the project-card morph origin rect.
// the projects rail captures the clicked card's getBoundingClientRect() and
// stashes it here just before pushing the hash that opens the modal; the
// modal reads it on mount and uses it as the spring's start rect (and exit
// rect) so the morph from card → fullscreen actually traces a path through
// space rather than just appearing.
//
// why a module-level singleton instead of React context: the rail and the
// modal are in completely separate component subtrees (rail under main,
// modal under body at layout root). plumbing context through layout would
// require restructuring AccentProvider/SmoothScrollProvider; module state
// is fine because this is purely transient UI state and never reads on
// the server.
//
// the morph origin is intentionally NOT captured via framer-motion's
// layoutId system. layoutId tracks DOM box rects via mount-time + layout
// effects; the rail card is inside a GSAP-transformed parent
// (`gsap.to(rail, { x: ... })`), and FM doesn't observe that transform.
// it ends up reading the card's pre-translate rect as the morph start,
// which is off-screen, visually equivalent to no morph at all. capturing
// the live rect on click sidesteps the whole tracking problem.

export interface MorphOrigin {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

let current: MorphOrigin | null = null;

export function setMorphOrigin(origin: MorphOrigin | null): void {
  current = origin;
}

export function getMorphOrigin(): MorphOrigin | null {
  return current;
}

// the project id currently "owned" by the modal lifecycle. the rail
// hides the matching card while this is set so the modal's exit morph
// back to the card rect doesn't visually double-up with the underlying
// rail card. cleared by the modal AFTER its exit animation completes
// (effect cleanup fires post-AnimatePresence unmount), not when the
// hash clears.
let hiddenCardId: string | null = null;
const hiddenSubs = new Set<(id: string | null) => void>();

export function setHiddenCardId(id: string | null): void {
  hiddenCardId = id;
  hiddenSubs.forEach((l) => l(id));
}

export function getHiddenCardId(): string | null {
  return hiddenCardId;
}

export function subscribeHiddenCardId(
  listener: (id: string | null) => void,
): () => void {
  hiddenSubs.add(listener);
  return () => {
    hiddenSubs.delete(listener);
  };
}

// the modal's "fullscreen" target rect, computed from current viewport.
// matches the tailwind responsive inset on the modal shell:
//   default: inset-4 (16px)
//   sm:      inset-8 (32px)
//   md:      inset-12 (48px)
//   lg:      inset-16 (64px)
// kept in lockstep so the animated end-state lands exactly where the
// modal's CSS would have positioned it had we just rendered statically.
export function getModalTargetRect(): MorphOrigin {
  if (typeof window === "undefined") {
    return { top: 16, left: 16, width: 0, height: 0, borderRadius: 24 };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const inset = w >= 1024 ? 64 : w >= 768 ? 48 : w >= 640 ? 32 : 16;
  return {
    top: inset,
    left: inset,
    width: w - inset * 2,
    height: h - inset * 2,
    borderRadius: 24,
  };
}
