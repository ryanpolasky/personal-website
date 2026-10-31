export const PROJECT_SCROLL_IDLE = 240;

interface ProjectLandingHandlers {
  onLand: () => void;
  onBrowse: () => void;
  onMove: () => void;
  onLeaveAbove: () => void;
  canSnap: () => boolean;
}

export function observeProjectLanding(
  section: HTMLElement,
  { onLand, onBrowse, onMove, onLeaveAbove, canSnap }: ProjectLandingHandlers,
) {
  let timer = 0;
  let touching = false;
  let snapping = false;
  let previousY = window.scrollY;
  let direction = 0;

  const settle = () => {
    if (touching || document.visibilityState === "hidden") return;
    const { top, bottom } = section.getBoundingClientRect();
    const height = window.innerHeight;
    if (
      window.matchMedia("(pointer: coarse)").matches &&
      !snapping && canSnap() && direction > 0 &&
      Math.abs(top) > 3 && Math.abs(top) <= height * 0.36
    ) {
      snapping = true;
      window.scrollTo({ top: window.scrollY + top, behavior: "smooth" });
      schedule();
      return;
    }
    if (snapping && Math.abs(top) > 3) return;
    snapping = false;
    if (top <= height * 0.2 && bottom > 0) {
      if (bottom >= height * 0.5) onLand();
      else onBrowse();
    }
  };
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(settle, PROJECT_SCROLL_IDLE);
  };
  const move = () => {
    onMove();
    if (section.getBoundingClientRect().top > window.innerHeight * 0.32) {
      onLeaveAbove();
    }
    schedule();
  };
  const scroll = () => {
    const y = window.scrollY;
    if (y !== previousY) direction = Math.sign(y - previousY);
    previousY = y;
    move();
  };
  const touchStart = () => {
    touching = true;
    direction = 0;
    if (snapping) {
      window.scrollTo({ top: window.scrollY, behavior: "instant" });
      snapping = false;
    }
    onMove();
    window.clearTimeout(timer);
  };
  const touchEnd = (event: TouchEvent) => {
    touching = event.touches.length > 0;
    if (!touching) schedule();
  };
  const visibility = () => {
    onMove();
    if (document.visibilityState === "hidden") window.clearTimeout(timer);
    else schedule();
  };
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("wheel", move, { passive: true });
  window.addEventListener("touchstart", touchStart, { passive: true });
  window.addEventListener("touchend", touchEnd, { passive: true });
  window.addEventListener("touchcancel", touchEnd, { passive: true });
  window.addEventListener("resize", move);
  document.addEventListener("visibilitychange", visibility);
  schedule();

  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("wheel", move);
    window.removeEventListener("touchstart", touchStart);
    window.removeEventListener("touchend", touchEnd);
    window.removeEventListener("touchcancel", touchEnd);
    window.removeEventListener("resize", move);
    document.removeEventListener("visibilitychange", visibility);
    if (snapping) window.scrollTo({ top: window.scrollY, behavior: "instant" });
  };
}
