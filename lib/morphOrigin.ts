// module-level singleton for the project-card morph origin rect. captured
// by the rail on click, read by the modal on mount. used over layoutId
// because the rail sits inside a GSAP-transformed parent FM doesn't track.

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

// project id "owned" by the modal lifecycle - rail hides the matching
// card while set so the exit morph doesn't double-up over it.
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

// modal's fullscreen target rect - mirrors the modal shell's responsive
// inset (inset-4/8/12/16) so animated end-state matches static layout.
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
