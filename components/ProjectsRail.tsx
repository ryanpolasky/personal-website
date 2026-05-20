"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import { getEnabledProjects, WIDTH_VW } from "@/lib/projects";
import { ProjectPanel } from "@/components/ProjectPanel";
import { useLenis } from "@/components/SmoothScrollProvider";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}


const projects = getEnabledProjects();
const N = projects.length;

const BUDGET_VH = 0.8;

const TRANSITION_S = 0.32;

const TENSION_START = 0.0;
const TENSION_FULL = 0.7;

const SLOT_DWELL_VH = 0;

const SNAP_RADIUS_VH = BUDGET_VH / 2;

const SNAP_IDLE_MS = 280;
const SNAP_DURATION_S = 0.5;
const SNAP_GUARD_MS = 1100;
const SNAP_MIN_PX = 6;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 100 - l)) / 100 / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function projectTint(p: (typeof projects)[number]): string {
  if (p.tintHsl) return hslToHex(p.tintHsl.h, p.tintHsl.s, p.tintHsl.l);
  return "rgba(244,242,238,0.18)";
}

const tints = projects.map(projectTint);
const projectNames = projects.map((p) => p.name);

const projectSpreadCount = projects.map((p) => {
  const sections = p.sections ?? [];
  if (sections.length === 0) return 1;
  const mediaSectionSpreads = sections.filter(
    (s) => (s.media?.length ?? 0) > 0,
  ).length;
  const editorialSpreads =
    sections.some((s) => (s.media?.length ?? 0) === 0) || p.closingMedia
      ? 1
      : 0;
  return 1 + mediaSectionSpreads + editorialSpreads;
});

const rawWidths = projects.map((p, i) =>
  Math.max(WIDTH_VW[p.width] / 100, projectSpreadCount[i]),
);
const slotWidths = rawWidths.map((w) => Math.max(1, w));
const panelStarts: number[] = [0];
for (let i = 0; i < N; i++) panelStarts.push(panelStarts[i] + slotWidths[i]);
const slotBudgets = slotWidths.map((w) => BUDGET_VH * w);
const slotStarts: number[] = [0];
for (let i = 0; i < N; i++) slotStarts.push(slotStarts[i] + slotBudgets[i]);
const totalBudget = slotStarts[N];
const slotPan = slotWidths.map((w) => Math.max(0, w - 1));

export function ProjectsRail() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const nextCueRef = useRef<HTMLDivElement | null>(null);
  const nextCueNameRef = useRef<HTMLSpanElement | null>(null);
  const prevCueRef = useRef<HTMLDivElement | null>(null);
  const prevCueNameRef = useRef<HTMLSpanElement | null>(null);
  const jumpToIdxRef = useRef<(idx: number) => void>(() => {});
  const [activeIdx, setActiveIdx] = useState(0);

  const lenis = useLenis();
  const lenisRef = useRef<Lenis | null>(null);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const rail = railRef.current;
    const nextCue = nextCueRef.current;
    const nextCueName = nextCueNameRef.current;
    const prevCue = prevCueRef.current;
    const prevCueName = prevCueNameRef.current;
    if (!section || !stage || !rail) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduced || coarse) {
      rail.classList.add(
        "overflow-x-auto",
        "snap-x",
        "snap-mandatory",
        "no-scrollbar",
      );
      stage.style.setProperty("--rail-clip-x", "0px");
      stage.style.setProperty("--rail-clip-top", "0px");
      stage.style.setProperty("--rail-clip-bottom", "0px");
      stage.style.setProperty("--rail-radius", "0px");
      stage.style.setProperty("--rail-edge-opacity", "0");
      return;
    }

    const getTravel = () => Math.round(totalBudget * window.innerHeight);

    const restPx = () => Math.round(window.innerHeight * 0.18);

    const setSectionHeight = () => {
      section.style.height = `${window.innerHeight + getTravel() + restPx()}px`;
    };
    setSectionHeight();
    window.addEventListener("resize", setSectionHeight);

    const ro = new ResizeObserver(() => {
      setSectionHeight();
      ScrollTrigger.refresh();
    });
    ro.observe(rail);

    let raf = 0;
    let lastScrollY = window.scrollY;
    let lastActivityAt = -Infinity;
    let lastDirection: 0 | 1 | -1 = 0;
    let lastTickAt = performance.now();
    let lastSnapAt = -Infinity;
    let snapEndsAt = 0;
    let smoothedForward = 0;
    let smoothedBackward = 0;
    let displayForwardName: string | undefined;
    let displayForwardColor: string | undefined;
    let displayBackwardName: string | undefined;
    let displayBackwardColor: string | undefined;
    const ACTIVE_HOLD_MS = 60;
    const FADE_MS = 220;

    const insetX = () =>
      window.innerWidth >= 1024 ? 112 : window.innerWidth >= 640 ? 64 : 24;
    const insetTop = () =>
      window.innerWidth >= 1024 ? 128 : window.innerWidth >= 640 ? 80 : 36;
    const insetBottom = () =>
      window.innerWidth >= 1024 ? 128 : window.innerWidth >= 640 ? 80 : 36;

    const morphTick = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const entry = Math.max(0, Math.min(1, (vh - rect.top) / vh));
      const exitProg = Math.max(0, Math.min(1, rect.bottom / vh));
      const morph = Math.min(entry, exitProg);
      const inv = 1 - morph;
      const ix = insetX();
      const it = insetTop();
      const ib = insetBottom();
      stage.style.setProperty("--rail-clip-x", `${inv * ix}px`);
      stage.style.setProperty("--rail-clip-top", `${inv * it}px`);
      stage.style.setProperty("--rail-clip-bottom", `${inv * ib}px`);
      stage.style.setProperty("--rail-radius", `${inv * 28}px`);
      stage.style.setProperty("--rail-edge-opacity", `${inv}`);

      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTickAt) / 1000);
      lastTickAt = now;

      const cy = window.scrollY;
      if (cy !== lastScrollY) {
        const delta = cy - lastScrollY;
        if (now >= snapEndsAt) {
          if (delta > 0) lastDirection = 1;
          else if (delta < 0) lastDirection = -1;
          lastActivityAt = now;
        }
        lastScrollY = cy;
      }
      const sinceActivity = now - lastActivityAt;
      const activityFactor =
        sinceActivity < ACTIVE_HOLD_MS
          ? 1
          : Math.max(0, 1 - (sinceActivity - ACTIVE_HOLD_MS) / FADE_MS);

      const inRail = rect.top <= 0 && rect.bottom > vh;

      let targetForward = 0;
      let targetBackward = 0;
      let frameNextName: string | undefined;
      let frameNextColor: string | undefined;
      let framePrevName: string | undefined;
      let framePrevColor: string | undefined;

      const inHold = now < cueHoldUntil;
      if (inHold && cueHoldDirection === 1) {
        targetForward = 1;
        frameNextName = cueHoldName;
        frameNextColor = cueHoldColor;
      } else if (inHold && cueHoldDirection === -1) {
        targetBackward = 1;
        framePrevName = cueHoldName;
        framePrevColor = cueHoldColor;
      } else if (inRail && activityFactor > 0) {
        const travelPx = Math.max(1, totalBudget * vh);
        const rawProgress = clamp01(-rect.top / travelPx);
        const budgetProgress = rawProgress * totalBudget;
        const dwellVh = slotPan[currentIdx] > 0 ? SLOT_DWELL_VH : 0;
        const panBudget = slotBudgets[currentIdx] - 2 * dwellVh;
        const panOffset = dwellVh;
        const slotForward = clamp01(
          (budgetProgress - slotStarts[currentIdx] - panOffset) / panBudget,
        );
        const slotProgress = clamp01(
          (budgetProgress - slotStarts[currentIdx]) / slotBudgets[currentIdx],
        );
        const currentSlotWidth = slotWidths[currentIdx] || 1;
        const boundaryTensionStart =
          currentSlotWidth > 1
            ? 1 - SNAP_RADIUS_VH / slotBudgets[currentIdx]
            : TENSION_START;
        const boundaryTensionFull =
          currentSlotWidth > 1
            ? 1 - (SNAP_RADIUS_VH * 0.4) / slotBudgets[currentIdx]
            : TENSION_FULL;
        const nextProject =
          currentIdx < N - 1 ? projects[currentIdx + 1] : undefined;
        const prevProject =
          currentIdx > 0 ? projects[currentIdx - 1] : undefined;
        if (nextProject && lastDirection > 0) {
          targetForward =
            smoothstep(
              boundaryTensionStart,
              boundaryTensionFull,
              slotProgress,
            ) * activityFactor;
          frameNextName = nextProject.name;
          frameNextColor = projectTint(nextProject);
        }
        if (prevProject && lastDirection < 0) {
          targetBackward =
            smoothstep(
              boundaryTensionStart,
              boundaryTensionFull,
              1 - slotProgress,
            ) * activityFactor;
          framePrevName = prevProject.name;
          framePrevColor = projectTint(prevProject);
        }

        if (now >= lockedUntil && slotPan[currentIdx] > 0) {
          const panX =
            -(panelStarts[currentIdx] + slotForward * slotPan[currentIdx]) *
            window.innerWidth;
          gsap.set(rail, { x: panX });
        }
      }

      if (
        inRail &&
        now >= lockedUntil &&
        now - lastSnapAt > SNAP_GUARD_MS &&
        now - lastActivityAt >= SNAP_IDLE_MS
      ) {
        const sectionTopAbs = rect.top + cy;
        const slotStartScroll = sectionTopAbs + slotStarts[currentIdx] * vh;
        const slotEndScroll =
          sectionTopAbs +
          (slotStarts[currentIdx] + slotBudgets[currentIdx]) * vh;
        const dwellPx = SLOT_DWELL_VH * vh;
        let snapTarget: number | null = null;

        if (slotPan[currentIdx] > 0) {
          const startAnchor = slotStartScroll + dwellPx;
          const endAnchor = slotEndScroll - dwellPx;
          if (cy < startAnchor) {
            snapTarget = startAnchor;
          } else if (cy > endAnchor) {
            snapTarget = endAnchor;
          }
        } else {
          snapTarget = (slotStartScroll + slotEndScroll) / 2;
        }

        if (snapTarget !== null && Math.abs(cy - snapTarget) > SNAP_MIN_PX) {
          const lenisNow = lenisRef.current;
          if (lenisNow) {
            lenisNow.scrollTo(snapTarget, {
              duration: SNAP_DURATION_S,
              easing: (t) => 1 - Math.pow(1 - t, 3),
            });
          }
          lastSnapAt = now;
          snapEndsAt = now + SNAP_DURATION_S * 1000 + 60;
        }
      }

      const dampUp = 1 - Math.exp(-dt * 22);
      const dampDown = 1 - Math.exp(-dt * 5);
      const fDamp = targetForward > smoothedForward ? dampUp : dampDown;
      const bDamp = targetBackward > smoothedBackward ? dampUp : dampDown;
      smoothedForward += (targetForward - smoothedForward) * fDamp;
      smoothedBackward += (targetBackward - smoothedBackward) * bDamp;

      if (targetForward > 0.02 && frameNextName) {
        displayForwardName = frameNextName;
        displayForwardColor = frameNextColor;
      }
      if (targetBackward > 0.02 && framePrevName) {
        displayBackwardName = framePrevName;
        displayBackwardColor = framePrevColor;
      }

      renderCue(
        nextCue,
        nextCueName,
        smoothedForward,
        1,
        displayForwardName,
        displayForwardColor,
      );
      renderCue(
        prevCue,
        prevCueName,
        smoothedBackward,
        -1,
        displayBackwardName,
        displayBackwardColor,
      );

      raf = requestAnimationFrame(morphTick);
    };
    raf = requestAnimationFrame(morphTick);

    let currentIdx = 0;
    let lockedUntil = 0;
    let cueHoldUntil = 0;
    let cueHoldDirection: 1 | -1 = 1;
    let cueHoldName: string | undefined;
    let cueHoldColor: string | undefined;
    const CUE_HOLD_MS = 200;
    let lenisResumeTimer: number | null = null;
    // two-step project boundary gate. when a slot crossing is detected we
    // first "wall lock" at the current slot's edge so the user has to
    // explicitly scroll again to advance into the next project. armed
    // direction is preserved across the absorber window; the next crossing
    // in the SAME direction advances. crossing in the opposite direction
    // re-arms the wall on the other side. cleared on programmatic nav
    // (jumpToIdx / landOnEntry).
    let boundaryArmedDir: 1 | -1 | 0 = 0;
    const renderCue = (
      el: HTMLDivElement | null,
      nameEl: HTMLSpanElement | null,
      tension: number,
      direction: 1 | -1,
      name?: string,
      color?: string,
    ) => {
      if (!el || !nameEl) return;
      if (name && nameEl.textContent !== name) nameEl.textContent = name;
      el.style.opacity = `${tension}`;
      el.style.transform = `translate3d(${direction * (1 - tension) * 30}px, 0, 0)`;
      if (color) {
        const gradientDir = direction === 1 ? "to left" : "to right";
        el.style.background = `linear-gradient(${gradientDir}, color-mix(in oklab, ${color} 55%, transparent), color-mix(in oklab, ${color} 18%, transparent) 55%, transparent)`;
      } else {
        el.style.background = "none";
      }
    };

    let wheelBlocker: ((e: WheelEvent) => void) | null = null;
    let tailAbsorber: ((e: WheelEvent) => void) | null = null;

    const hideCues = () => {
      renderCue(nextCue, nextCueName, 0, 1);
      renderCue(prevCue, prevCueName, 0, -1);
    };

    const releaseTailAbsorber = () => {
      if (tailAbsorber) {
        // must match the capture flag from addEventListener or the
        // listener stays attached, leaking handlers across swipes.
        window.removeEventListener("wheel", tailAbsorber, {
          capture: true,
        } as EventListenerOptions);
        tailAbsorber = null;
      }
    };

    const releaseWheelBlock = () => {
      if (wheelBlocker) {
        window.removeEventListener("wheel", wheelBlocker, {
          capture: true,
        } as EventListenerOptions);
        wheelBlocker = null;
      }
      releaseTailAbsorber();
    };

    const lockScrollDuringSwipe = (
      lockMs: number,
      targetScrollY: number,
      _duration: number,
    ) => {
      releaseWheelBlock();

      let lastWheelTime = performance.now();
      let lastWheelDelta = 0;
      let firstSeenAfterLock = false;
      let absorberInstalledAt = 0;

      // CRITICAL: capture + stopImmediatePropagation is what actually keeps
      // wheel events from reaching Lenis. Lenis registers its own wheel
      // listener in bubble phase from SmoothScrollProvider (which mounted
      // before us), so a bubble-phase blocker fires AFTER Lenis - too late;
      // Lenis has already updated targetScroll by the time preventDefault
      // runs. capture phase fires first, and stopImmediatePropagation
      // outright cancels Lenis's bubble listener for the event. without
      // these two changes, momentum still leaks because Lenis silently
      // accumulates input the whole time we think we have it locked out.
      const blocker = (e: WheelEvent) => {
        lastWheelTime = performance.now();
        lastWheelDelta = Math.abs(e.deltaY || e.deltaX);
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      window.addEventListener("wheel", blocker, {
        passive: false,
        capture: true,
      });
      wheelBlocker = blocker;

      const l = lenisRef.current;
      if (l) {
        l.scrollTo(targetScrollY, { immediate: true, force: true });
        l.velocity = 0;
        l.lastVelocity = 0;
        l.stop();
      } else {
        window.scrollTo({ top: targetScrollY, behavior: "auto" });
      }

      if (lenisResumeTimer !== null) window.clearTimeout(lenisResumeTimer);
      lenisResumeTimer = window.setTimeout(() => {
        // drop the hard lock
        if (wheelBlocker) {
          window.removeEventListener("wheel", wheelBlocker, {
            capture: true,
          } as EventListenerOptions);
          wheelBlocker = null;
        }

        // momentum absorber. eats decaying wheel-event tails (trackpad
        // kinetic scroll, OS-level wheel inertia) so they can't pan the
        // newly-entered project. tuned for both extremes:
        //   - trackpad: long decaying tail of small-delta events, ~16ms
        //     apart. heuristic catches them by "delta is not bigger than
        //     last + small fudge" and "<60ms gap since last".
        //   - mousewheel (no real OS inertia): a single click after lock
        //     release should NOT be eaten. heuristic catches it because
        //     the click arrives >60ms after the last absorbed event, OR
        //     the absorber hard-times-out at ABSORBER_MAX_MS.
        //
        // also uses capture+stopImmediatePropagation for the same reason
        // as the blocker above - preventDefault alone leaks to Lenis.
        const ABSORBER_MAX_MS = 850;
        absorberInstalledAt = performance.now();
        const absorber = (e: WheelEvent) => {
          const now = performance.now();
          const delta = Math.abs(e.deltaY || e.deltaX);

          // hard time cap: never absorb past this. catches the case where
          // the user keeps wheeling smoothly through the transition and
          // their genuine input looks identical to the tail.
          if (now - absorberInstalledAt > ABSORBER_MAX_MS) {
            releaseTailAbsorber();
            return;
          }

          // first event after lock release: anchor our reference timing
          // to NOW rather than to the pre-lock lastWheelTime (which would
          // make the gap-since-last check meaningless on the first call).
          if (!firstSeenAfterLock) {
            firstSeenAfterLock = true;
            lastWheelTime = now;
            lastWheelDelta = delta;
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }

          // gap > 60ms or sharp delta spike = new physical input.
          if (now - lastWheelTime > 60 || delta > lastWheelDelta * 1.5 + 4) {
            releaseTailAbsorber();
            return;
          }

          // otherwise: residual momentum. eat it.
          lastWheelTime = now;
          lastWheelDelta = delta;
          e.preventDefault();
          e.stopImmediatePropagation();
        };

        window.addEventListener("wheel", absorber, {
          passive: false,
          capture: true,
        });
        tailAbsorber = absorber;

        const l2 = lenisRef.current;
        if (l2) {
          l2.scrollTo(window.scrollY, { immediate: true, force: true });
          l2.velocity = 0;
          l2.lastVelocity = 0;
          l2.start();
        }
        lenisResumeTimer = null;
      }, lockMs);
    };

    const ctx = gsap.context(() => {

      const jumpToIdx = (rawTarget: number) => {
        const target = Math.max(0, Math.min(N - 1, rawTarget));
        const targetX = -panelStarts[target] * window.innerWidth;
        const currentX = (gsap.getProperty(rail, "x") as number) ?? 0;
        if (target === currentIdx && Math.abs(currentX - targetX) < 1) return;
        lockedUntil = 0;
        cueHoldUntil = 0;
        boundaryArmedDir = 0;
        if (lenisResumeTimer !== null) {
          window.clearTimeout(lenisResumeTimer);
          lenisResumeTimer = null;
        }
        releaseWheelBlock();
        smoothedForward = 0;
        smoothedBackward = 0;
        displayForwardName = undefined;
        displayForwardColor = undefined;
        displayBackwardName = undefined;
        displayBackwardColor = undefined;
        hideCues();
        gsap.killTweensOf(rail);
        currentIdx = target;
        setActiveIdx(target);
        const jumpDuration = 0.55;
        lockedUntil = performance.now() + jumpDuration * 1000 + 50;
        gsap.to(rail, {
          x: targetX,
          duration: jumpDuration,
          ease: "power3.inOut",
        });
        const sectionTop = section.getBoundingClientRect().top + window.scrollY;
        const targetScrollY =
          sectionTop + slotStarts[target] * window.innerHeight;
        const lenisNow = lenisRef.current;
        if (lenisNow) {
          lenisNow.start();
          lenisNow.scrollTo(targetScrollY, {
            duration: jumpDuration,
            force: true,
          });
        } else {
          window.scrollTo({ top: targetScrollY, behavior: "smooth" });
        }
      };
      jumpToIdxRef.current = jumpToIdx;

      const swipeTo = (
        idx: number,
        instant: boolean,
        direction: 0 | 1 | -1 = 0,
      ) => {
        gsap.killTweensOf(rail);
        const isBackwardIntoWideSlot = direction < 0 && slotPan[idx] > 0;
        const targetVw = isBackwardIntoWideSlot
          ? -(panelStarts[idx] + slotPan[idx])
          : -panelStarts[idx];
        const targetX = targetVw * window.innerWidth;
        if (instant) {
          hideCues();
          smoothedForward = 0;
          smoothedBackward = 0;
          cueHoldUntil = 0;
          gsap.set(rail, { x: targetX });
        } else {
          gsap.to(rail, {
            x: targetX,
            duration: TRANSITION_S,
            ease: "power3.inOut",
          });
          const sectionTop =
            section.getBoundingClientRect().top + window.scrollY;
          const vh = window.innerHeight;
          const slotStartY = slotStarts[idx] * vh;
          const slotEndY = (slotStarts[idx] + slotBudgets[idx]) * vh;
          const isBackward = direction < 0;
          const targetSlotY = isBackward ? slotEndY - 1 : slotStartY + 1;
          const targetScrollY = sectionTop + targetSlotY;

          const lockMs = TRANSITION_S * 1000 + 120;
          lockedUntil = performance.now() + lockMs;
          lockScrollDuringSwipe(lockMs, targetScrollY, TRANSITION_S);
        }
      };

      // "wall lock" - the first half of the two-step project boundary
      // gate. when the user crosses (or is about to cross) from one
      // project into another, we first snap the rail to the FAR edge of
      // the current project (last subsection for forward, hero for
      // backward) and absorb their scroll momentum. they then have to
      // make a fresh, deliberate scroll input to actually advance into
      // the next project. without this, a fast wheel/trackpad fling
      // blasts straight through the boundary into the next project's
      // hero with no tactile "you've reached the end" feedback.
      const lockAtWall = (idx: number, dir: 1 | -1) => {
        const sectionTop =
          section.getBoundingClientRect().top + window.scrollY;
        const vh = window.innerHeight;
        const slotStartY = slotStarts[idx] * vh;
        const slotEndY = (slotStarts[idx] + slotBudgets[idx]) * vh;
        const targetSlotY = dir === 1 ? slotEndY - 1 : slotStartY + 1;
        const targetScrollY = sectionTop + targetSlotY;
        const railTargetVw =
          dir === 1
            ? -(panelStarts[idx] + slotPan[idx])
            : -panelStarts[idx];

        gsap.killTweensOf(rail);
        gsap.to(rail, {
          x: railTargetVw * window.innerWidth,
          duration: TRANSITION_S,
          ease: "power3.inOut",
        });

        const lockMs = TRANSITION_S * 1000 + 120;
        lockedUntil = performance.now() + lockMs;
        lockScrollDuringSwipe(lockMs, targetScrollY, TRANSITION_S);
      };

      // shared "land + absorb" used when the user enters the section from
      // outside (from kaleido above or contact below). reuses the exact
      // same lock / momentum-absorber machinery as slot-to-slot swipes so
      // a fast scroll into autopsy (or up into the last project) cannot
      // blow past the entry hero into a mid-pan position.
      const landOnEntry = (idx: number, fromBelow: boolean) => {
        const sectionTop =
          section.getBoundingClientRect().top + window.scrollY;
        const vh = window.innerHeight;
        const slotStartY = slotStarts[idx] * vh;
        const slotEndY = (slotStarts[idx] + slotBudgets[idx]) * vh;
        const targetSlotY = fromBelow ? slotEndY - 1 : slotStartY + 1;
        const targetScrollY = sectionTop + targetSlotY;
        const railTargetVw = fromBelow
          ? -(panelStarts[idx] + slotPan[idx])
          : -panelStarts[idx];

        gsap.killTweensOf(rail);
        gsap.set(rail, { x: railTargetVw * window.innerWidth });
        currentIdx = idx;
        setActiveIdx(idx);
        smoothedForward = 0;
        smoothedBackward = 0;
        cueHoldUntil = 0;
        boundaryArmedDir = 0;
        hideCues();

        const lockMs = TRANSITION_S * 1000 + 120;
        lockedUntil = performance.now() + lockMs;
        lockScrollDuringSwipe(lockMs, targetScrollY, TRANSITION_S);
      };

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => `+=${getTravel()}`,
        invalidateOnRefresh: true,
        // entering from above (down scroll from kaleido). lock to autopsy
        // so trackpad inertia can't carry the user past the first project's
        // hero into a half-revealed second subsection.
        onEnter: () => landOnEntry(0, false),
        // entering from below (up scroll from contact). same treatment for
        // the last project so they land cleanly on its final subsection
        // instead of overshooting into the middle.
        onEnterBack: () => landOnEntry(N - 1, true),
        onUpdate: (self) => {
          if (performance.now() < lockedUntil) return;

          const rect = section.getBoundingClientRect();
          const vh = window.innerHeight;
          if (rect.top > 0 || rect.bottom <= vh) return;

          const budgetProgress = self.progress * totalBudget;
          let requested = N - 1;
          for (let i = 0; i < N; i++) {
            if (budgetProgress < slotStarts[i + 1]) {
              requested = i;
              break;
            }
          }
          if (requested !== currentIdx) {
            const dir: 1 | -1 = requested > currentIdx ? 1 : -1;
            const step = currentIdx + dir;
            const now = performance.now();

            if (boundaryArmedDir === dir) {
              // SECOND crossing in the same direction = user has made a
              // deliberate follow-up scroll after the wall. actually
              // advance into the next project now.
              boundaryArmedDir = 0;
              cueHoldUntil = now + CUE_HOLD_MS;
              cueHoldDirection = dir;
              cueHoldName = projects[step]?.name;
              cueHoldColor = projects[step]
                ? projectTint(projects[step])
                : undefined;
              currentIdx = step;
              setActiveIdx(step);
              swipeTo(step, false, dir);
            } else {
              // FIRST crossing (or direction change) = wall lock. snap to
              // the current project's far edge and absorb momentum. the
              // user must scroll again in the same direction to advance.
              // we DO NOT change currentIdx - they're still "in" the
              // current project, just at its boundary.
              boundaryArmedDir = dir;
              // show the next project's cue as a hint of what they'll
              // get when they scroll again.
              cueHoldUntil = now + CUE_HOLD_MS;
              cueHoldDirection = dir;
              cueHoldName = projects[step]?.name;
              cueHoldColor = projects[step]
                ? projectTint(projects[step])
                : undefined;
              lockAtWall(currentIdx, dir);
            }
          }
        },
        onRefresh: () => {
          swipeTo(currentIdx, true);
        },
      });

      if (window.location.hash === "#projects") {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const sectionTop =
              section.getBoundingClientRect().top + window.scrollY;
            const lenisNow = lenisRef.current;
            if (lenisNow) {
              lenisNow.scrollTo(sectionTop, { immediate: true });
            } else {
              window.scrollTo({ top: sectionTop, behavior: "auto" });
            }
          });
        });
      }
    }, section);

    const onProjectsReset = () => jumpToIdxRef.current(0);
    window.addEventListener("projects:reset", onProjectsReset);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setSectionHeight);
      window.removeEventListener("projects:reset", onProjectsReset);
      ro.disconnect();
      if (lenisResumeTimer !== null) {
        window.clearTimeout(lenisResumeTimer);
        lenisResumeTimer = null;
      }
      releaseWheelBlock();
      lenisRef.current?.start();
      jumpToIdxRef.current = () => {};
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="projects"
      data-snap
      className="relative w-full"
      aria-label="projects"
    >
      <div
        ref={stageRef}
        data-stage="dark"
        className="stage sticky w-full"
        style={{
          top: 0,
          height: "100svh",
          borderRadius: "var(--rail-radius, 28px)",
          clipPath:
            "inset(var(--rail-clip-top, 128px) var(--rail-clip-x, 112px) var(--rail-clip-bottom, 128px) var(--rail-clip-x, 112px) round var(--rail-radius, 28px))",
          WebkitClipPath:
            "inset(var(--rail-clip-top, 128px) var(--rail-clip-x, 112px) var(--rail-clip-bottom, 128px) var(--rail-clip-x, 112px) round var(--rail-radius, 28px))",
        }}
      >
        <div
          className="stage-edge"
          aria-hidden
          style={{
            inset:
              "var(--rail-clip-top, 128px) var(--rail-clip-x, 112px) var(--rail-clip-bottom, 128px) var(--rail-clip-x, 112px)",
            borderRadius: "var(--rail-radius, 28px)",
            opacity: "var(--rail-edge-opacity, 1)",
          }}
        />

        <div
          ref={prevCueRef}
          className="pointer-events-none absolute inset-y-0 left-0 z-40 flex w-[min(30rem,42vw)] items-center opacity-0"
          style={{ willChange: "transform, opacity, background" }}
          aria-hidden
        >
          <div
            className="ml-5 flex items-center gap-4 rounded-full border border-white/25 bg-black/15 px-4 py-3 text-white/90 shadow-[0_0_50px_rgba(255,255,255,0.12)] backdrop-blur-md sm:ml-9"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="text-[18px] leading-none">←</span>
            <span className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-[0.3em] text-white/55">
                previous
              </span>
              <span
                ref={prevCueNameRef}
                className="text-[11px] uppercase tracking-[0.18em]"
              />
            </span>
          </div>
        </div>

        <div
          ref={nextCueRef}
          className="pointer-events-none absolute inset-y-0 right-0 z-40 flex w-[min(30rem,42vw)] items-center justify-end opacity-0"
          style={{ willChange: "transform, opacity, background" }}
          aria-hidden
        >
          <div
            className="mr-5 flex items-center gap-4 rounded-full border border-white/25 bg-black/15 px-4 py-3 text-white/90 shadow-[0_0_50px_rgba(255,255,255,0.12)] backdrop-blur-md sm:mr-9"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="flex flex-col gap-1 text-right">
              <span className="text-[9px] uppercase tracking-[0.3em] text-white/55">
                next
              </span>
              <span
                ref={nextCueNameRef}
                className="text-[11px] uppercase tracking-[0.18em]"
              />
            </span>
            <span className="text-[18px] leading-none">→</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => jumpToIdxRef.current(0)}
          className="absolute left-4 top-4 z-30 cursor-pointer text-[10.5px] uppercase tracking-[0.32em] text-[var(--color-text-faint)] transition-colors hover:text-white/85 sm:left-8 sm:top-8"
          style={{ fontFamily: "var(--font-mono)" }}
          data-hoverable
          aria-label="reset to first project"
        >
          03 - projects
        </button>

        <div ref={railRef} className="flex h-full will-change-transform">
          {projects.map((p, i) => (
            <div
              key={p.id}
              className="h-full shrink-0 overflow-hidden"
              style={{ width: `${slotWidths[i] * 100}svw` }}
            >
              <ProjectPanel
                project={p}
                tintColor={tints[i]}
                index={i}
                total={N}
              />
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-6 px-5 pb-7 sm:px-8 sm:pb-9 md:px-12 lg:px-20">
          <div
            className="pointer-events-auto flex flex-1 gap-1.5"
            role="tablist"
            aria-label="jump to project"
          >
            {projects.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === activeIdx}
                aria-label={`go to project ${String(i + 1).padStart(2, "0")}: ${projectNames[i]}`}
                onClick={() => jumpToIdxRef.current(i)}
                className="group relative -my-3 flex flex-1 items-end py-3"
                style={{ ["--bar-tint" as string]: tints[i] } as CSSProperties}
                data-hoverable
              >
                <span
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2.5 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border bg-black/55 px-2.5 py-1 text-[9.5px] uppercase tracking-[0.22em] text-white/95 opacity-0 backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100"
                  style={{
                    fontFamily: "var(--font-mono)",
                    borderColor:
                      "color-mix(in oklab, var(--bar-tint) 50%, rgba(255,255,255,0.2))",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bar-tint)]"
                    aria-hidden
                  />
                  {projectNames[i]}
                </span>
                <span
                  className={`block h-px w-full transition-colors duration-200 ${
                    i === activeIdx
                      ? "bg-[var(--bar-tint)]"
                      : "bg-white/18 group-hover:bg-[var(--bar-tint)]"
                  }`}
                />
              </button>
            ))}
          </div>
          <p
            className="pointer-events-auto hidden shrink-0 text-[10px] uppercase tracking-[0.28em] text-white/55 sm:block"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            scroll to translate
          </p>
        </div>
      </div>
    </section>
  );
}
