"use client";

// nimby loading-screen parade. four player forms walk left-to-right
// across the strip, staggered. constants pulled from the godot source
// (Globals/SceneManager.gd) so the cadence matches the in-game loop.

import { useEffect, useState } from "react";

// per-walksheet frame aspect (sheet w / sheet h / 6). preserves
// each form's in-game silhouette proportion.
const FORMS = [
  {
    label: "druid",
    src: "/assets/projects/nimby/nim_druid_walk.webp",
    frameAspect: 444 / 580, // sheet 2664x3480 -> frame ~444x580
    targetHeight: 0.75,
    speedMul: 1.0,
  },
  {
    label: "fox",
    src: "/assets/projects/nimby/nim_fox_walk.webp",
    frameAspect: 640 / 534, // 3840x3204 -> ~640x534
    targetHeight: 0.6,
    speedMul: 1.0,
  },
  {
    label: "bear",
    src: "/assets/projects/nimby/nim_bear_walk.webp",
    frameAspect: 536 / 498, // 3216x2988 -> ~536x498
    targetHeight: 0.8,
    speedMul: 1.0,
  },
  {
    label: "frog",
    src: "/assets/projects/nimby/nim_frog_walk.webp",
    frameAspect: 634 / 608, // 3804x3648 -> ~634x608
    targetHeight: 0.5,
    speedMul: 1.7,
  },
] as const;

const COLUMNS = 6;
const ROWS = 6;
// STAGGER chosen so at most ~2 forms share the strip (overlap window
// = TRAVEL - STAGGER = 1.4s). LOOP_SEC must stay >= TRAVEL_SEC so a
// form fully exits before its next cycle begins.
const FPS = 17;
const STAGGER_SEC = 1.6;
const TRAVEL_SEC = 3.0;
const LOOP_SEC = STAGGER_SEC * FORMS.length;
const TOTAL_FRAMES = COLUMNS * ROWS;

export function LoadingMarch() {
  // seed elapsed > 0 so first frame already has form 0 on stage rather
  // than parked off-screen left. covers reduced-motion (rAF never starts)
  // and avoids a ~250ms cold-render gap before form 0 slides in.
  const [elapsed, setElapsed] = useState(STAGGER_SEC);
  // gate the marching divs on sprite preload completion. without this, the
  // divs render with `background-image: url(...)` while the sprite is still
  // downloading. background-image requests are LOW priority in the browser,
  // so on a cold cache the strip stays blank for ~150-400ms and the first
  // pass looks broken (user-reported "didn't load first try"). preloading
  // via new Image() promotes the request to standard image priority and
  // populates the http cache so the css background lookup is a cache hit
  // by the time the divs paint.
  const [spritesReady, setSpritesReady] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    Promise.all(
      FORMS.map(
        (form) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            // resolve on error too - a missing sprite shouldn't block the
            // other forms from marching, and the broken bg image will
            // render as empty (same as the pre-fix state for that form).
            img.onerror = () => resolve();
            img.src = form.src;
          }),
      ),
    ).then(() => {
      if (!cancelled) setSpritesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // hold the rAF until sprites are decoded so `elapsed` starts ticking
    // from the moment the user actually sees motion, not from mount.
    if (!spritesReady) return;
    let raf = 0;
    let lastT = performance.now();
    const tick = (now: number) => {
      setElapsed((prev) => prev + (now - lastT) / 1000);
      lastT = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spritesReady]);
  if (!spritesReady) {
    // empty strip placeholder. layout space is reserved so the parent
    // container's grid doesn't reflow when the forms appear.
    return (
      <div className="relative h-full w-full overflow-hidden" aria-hidden />
    );
  }
  return (
    <div className="relative h-full w-full overflow-hidden">
      {FORMS.map((form, i) => {
        // form i starts at rawTime = -i*stagger; cycles every LOOP_SEC
        // once positive. negative rawTime hides the form pre-entry.
        const rawTime = elapsed - i * STAGGER_SEC;
        const formTime = ((rawTime % LOOP_SEC) + LOOP_SEC) % LOOP_SEC;
        const onStage = rawTime >= 0 && formTime <= TRAVEL_SEC;
        if (!onStage) return null;
        const t = Math.min(1, formTime / TRAVEL_SEC);
        // -10% to 110%: form enters from offscreen-left, exits offscreen-right.
        const xPct = -10 + t * 120;
        const frame = Math.floor(rawTime * FPS * form.speedMul) % TOTAL_FRAMES;
        const col = frame % COLUMNS;
        const row = Math.floor(frame / COLUMNS);
        const bgX = (col / Math.max(1, COLUMNS - 1)) * 100;
        const bgY = (row / Math.max(1, ROWS - 1)) * 100;
        return (
          <div
            key={form.label}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${xPct}%`,
              bottom: "4%",
              height: `${form.targetHeight * 100}%`,
              aspectRatio: `${form.frameAspect}`,
              transform: "translateX(-50%)",
              backgroundImage: `url(${form.src})`,
              backgroundSize: `${COLUMNS * 100}% ${ROWS * 100}%`,
              backgroundPosition: `${bgX}% ${bgY}%`,
              backgroundRepeat: "no-repeat",
              imageRendering: "pixelated",
            }}
          />
        );
      })}
    </div>
  );
}
