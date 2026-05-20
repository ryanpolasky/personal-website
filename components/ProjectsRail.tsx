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

// the projects section: a scroll-driven slideshow rail.
//
// shape: same family as KaleidoscopeSection - a tall section with a
// css-sticky stage inside that morphs from inset rounded card to fullscreen
// as the section enters from below. once the stage is stuck at the viewport
// top, vertical scroll progress is divided into N equal "slots" (one per
// project). inside a slot the rail is held perfectly still at -idx*vw so
// the active project owns the entire viewport with no slivers of its
// neighbors visible. crossing a slot boundary fires a quick GSAP swipe to
// the next project's rail position. this is the literal interpretation of
// "the entire section is the one project until u scroll into the next one":
// the rail never sits in a mid-pan state, and there are no continuous
// scrub frames where two projects coexist on screen.
//
// on touch / reduced-motion we fall back to a plain native horizontal scroll
// with the stage frozen at fullscreen, so the section stays usable without
// any morph or scroll-jacking.

const projects = getEnabledProjects();
const N = projects.length;

// vertical scroll budget per VIEWPORT-WIDTH of project, in viewport-heights.
// a standard 1vw-wide project gets BUDGET_VH; an XL (>1vw) project gets
// proportionally more so the horizontal pan rate is constant across project
// sizes. 0.8 is roughly one full mousewheel spin per viewport of horizontal
// travel on a typical screen - "deliberate" without becoming exhausting.
const BUDGET_VH = 0.8;

// duration of the rail's swipe between adjacent projects. short enough
// to feel like a snap-cut rather than a slow pan, long enough to read as
// motion rather than a hard cut.
const TRANSITION_S = 0.32;

// directional glow cue thresholds, expressed as slot-forward fraction.
// TENSION_START is intentionally ~0 so the cue starts ramping the instant
// the user begins scrolling toward the next/prev project from inside a
// slot (rather than only appearing near the slot boundary). TENSION_FULL
// peaks well before the boundary so the cue is fully visible while there's
// still scroll runway, not just for the final frame. for multi-spread XL
// slots, both values are remapped per-slot so the glow only kicks in once
// the user is in the final spread of that slot - see boundaryTensionStart
// in morphTick.
const TENSION_START = 0.0;
const TENSION_FULL = 0.7;

// dwell distance at each end of an XL slot, in vh units. an XL slot's
// rail pan happens only across the middle (slotBudget - 2*SLOT_DWELL_VH)
// of the budget; the leading and trailing SLOT_DWELL_VH each hold the
// rail at the entry / final spread. set to BUDGET_VH / 2 (= 0.4 vh) so
// the same vh-distance works as the "snap radius" for non-XL slots too:
// from a non-XL slot's center anchor, the user needs SLOT_DWELL_VH of
// scroll to reach either boundary - matching the XL trigger distance and
// making "how much do I need to scroll to advance" consistent across the
// whole section.
const SLOT_DWELL_VH = BUDGET_VH / 2;

// snap-on-idle tuning. when the user comes to rest within a slot's dwell
// zone (XL) or anywhere in a non-XL slot, Lenis smoothly pulls scrollY to
// the nearest rest anchor away from the nearest boundary - like a ball
// rolling back down a hill into the valley. the result is that triggering
// the next swipe always requires the same minimum push from rest, so the
// user can't camp 5px from the boundary and trigger with 0 input.
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

// pre-computed tint + name arrays, parallel to `projects`. used by the
// stage-level picker so each bar can hover with its own project's accent
// color and pop a tooltip with its own name, regardless of which panel is
// currently active.
const tints = projects.map(projectTint);
const projectNames = projects.map((p) => p.name);

// number of horizontal viewports a project's content actually renders.
// 1 for the intro panel, plus 1 per media-bearing section (each needs its
// own viewport so the media has room to breathe), plus 1 single combined
// "overview" viewport for all the text-only sections together (they don't
// need a full viewport each). this makes the rail's per-project width
// scale with actual content density: rich media-heavy projects like MM
// expand to 4vw, text-only projects collapse to 2vw or even 1vw.
const projectSpreadCount = projects.map((p) => {
  const sections = p.sections ?? [];
  if (sections.length === 0) return 1;
  const mediaSectionSpreads = sections.filter(
    (s) => (s.media?.length ?? 0) > 0,
  ).length;
  // closingMedia also triggers the combined editorial spread (it renders
  // as a leading accent card next to the text columns), so a project
  // with closingMedia but no editorial sections still needs that spread.
  const editorialSpreads =
    sections.some((s) => (s.media?.length ?? 0) === 0) || p.closingMedia
      ? 1
      : 0;
  return 1 + mediaSectionSpreads + editorialSpreads;
});

// per-project horizontal width as a fraction of viewport (1.0 = full vw).
// data values < 1 (narrow/wide) are clamped to 1 below so a small card
// doesn't end up showing the next project alongside it - the discrete
// "one project at a time" visual contract is preserved. rich projects with
// `sections` get one viewport per content spread so they can expand like a
// horizontal microsite without introducing vertical overflow.
const rawWidths = projects.map((p, i) =>
  Math.max(WIDTH_VW[p.width] / 100, projectSpreadCount[i]),
);
// slot width = how much horizontal space the project's slot occupies in the
// rail, in vw. floor at 1 so narrow/wide projects still get a full viewport
// slot. xl projects get >1 (e.g. 1.16) and pan internally.
const slotWidths = rawWidths.map((w) => Math.max(1, w));
// cumulative left edge of each slot, in vw. panelStarts[i] is where the
// rail's transform must be (negated) for project i's left edge to align with
// the viewport's left edge. panelStarts[N] is the total rail width.
const panelStarts: number[] = [0];
for (let i = 0; i < N; i++) panelStarts.push(panelStarts[i] + slotWidths[i]);
// scroll budget per slot, in vh. proportional to slot width so the user's
// scroll-to-horizontal-pan rate stays consistent across XL and standard
// slots. slotStarts is the cumulative version (scroll position where each
// slot begins, in vh). totalBudget is the section's total vertical travel.
const slotBudgets = slotWidths.map((w) => BUDGET_VH * w);
const slotStarts: number[] = [0];
for (let i = 0; i < N; i++) slotStarts.push(slotStarts[i] + slotBudgets[i]);
const totalBudget = slotStarts[N];
// internal pan distance per slot, in vw. 0 for slots that fit in a single
// viewport (no pan needed - just dwell then snap to next). >0 for XL slots,
// where the rail must continuously translate to reveal the right side of
// the panel as the user scrolls.
const slotPan = slotWidths.map((w) => Math.max(0, w - 1));

export function ProjectsRail() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const nextCueRef = useRef<HTMLDivElement | null>(null);
  const nextCueNameRef = useRef<HTMLSpanElement | null>(null);
  const prevCueRef = useRef<HTMLDivElement | null>(null);
  const prevCueNameRef = useRef<HTMLSpanElement | null>(null);
  // populated by useLayoutEffect with a closure that jumps the rail to any
  // project index. exposed via ref so both the section-index header (which
  // calls jumpToIdxRef.current(0) to reset) and the stage-level picker bars
  // can call into the effect's local state (currentIdx, rail tween, lenis,
  // etc.) without prop drilling.
  const jumpToIdxRef = useRef<(idx: number) => void>(() => {});
  // mirror of the effect's `currentIdx` so the stage-level picker's active
  // bar re-renders on slot transitions. setting React state from inside the
  // effect's closures is fine here - state updates only fire on actual slot
  // changes (a handful per session), not every frame.
  const [activeIdx, setActiveIdx] = useState(0);

  // lenis is wired through a ref rather than the effect dep array so the
  // ScrollTrigger setup doesn't have to tear down + recreate the entire rail
  // when Lenis mounts asynchronously after first paint.
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
      // fallback: native horizontal scroll inside a stage frozen at
      // fullscreen so the visual contract stays consistent with the morphed
      // state desktop users see. zero inset = clip-path is a no-op rect that
      // matches the layout box.
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

    // total vertical scroll budget = sum of per-slot budgets. slots that fit
    // in one viewport contribute BUDGET_VH; XL slots contribute more so the
    // internal pan rate stays consistent. boundary crossings still fire a
    // discrete swipe via onUpdate; within an XL slot the rail also pans
    // continuously (handled in morphTick).
    const getTravel = () => Math.round(totalBudget * window.innerHeight);

    const restPx = () => Math.round(window.innerHeight * 0.18);

    // section height = (one viewport of entry-morph travel) + (horizontal
    // pan distance) + (rest window). this is what css sticky + ScrollTrigger
    // scrub together need in order to: (a) animate the morph as the section
    // rides into view, (b) keep the stage stuck at viewport top while the
    // rail translates, (c) hold the stage pinned for the rest window so the
    // last card lands cleanly, (d) release at the section's bottom.
    const setSectionHeight = () => {
      section.style.height = `${window.innerHeight + getTravel() + restPx()}px`;
    };
    setSectionHeight();
    window.addEventListener("resize", setSectionHeight);

    // re-measure when the rail's own width changes (font swap, images
    // finishing decode, project content reflowing). without this, the
    // first scroll-through could leave the section's css height shorter
    // than the actual pan distance - sticky releases before the last
    // project is reached. resize observer + ScrollTrigger.refresh keeps
    // both the css height and the gsap trigger end in sync.
    const ro = new ResizeObserver(() => {
      setSectionHeight();
      ScrollTrigger.refresh();
    });
    ro.observe(rail);

    // morph + cue driver: ONE rAF loop handles the stage's morph CSS vars
    // AND the tension cue opacity/direction every frame. cues live here
    // (rather than inside ScrollTrigger.onUpdate, which only fires when
    // scroll actually changes) so they can decay to 0 shortly after the
    // user stops scrolling - otherwise the last computed tension would
    // sit on screen indefinitely until the next scroll event.
    //
    // direction is derived from the scrollY delta between frames so the
    // forward / backward cue choice tracks the user's most recent intent.
    // activityFactor holds at 1 for ACTIVE_HOLD_MS after the last delta and
    // fades to 0 over FADE_MS - a quick, deliberate fade that makes the
    // cue feel like it's reacting to live input.
    let raf = 0;
    let lastScrollY = window.scrollY;
    let lastActivityAt = -Infinity;
    let lastDirection: 0 | 1 | -1 = 0;
    let lastTickAt = performance.now();
    // snap-on-idle bookkeeping. lastSnapAt gates how often a snap may
    // re-fire (SNAP_GUARD_MS). snapEndsAt marks when the in-progress snap
    // animation will have settled; while now < snapEndsAt we treat the
    // resulting scroll motion as "ours, not the user's" so it doesn't
    // re-arm lastActivityAt or flip lastDirection (which would otherwise
    // keep restarting the idle counter and prevent settle).
    let lastSnapAt = -Infinity;
    let snapEndsAt = 0;
    // smoothed (rendered) tension values. asymmetric damping below keeps
    // these reactive on the way up (so live scroll feedback is snappy) but
    // slow on the way down so even a one-frame full-tension spike fades over
    // ~200ms instead of vanishing the instant the swipe fires.
    let smoothedForward = 0;
    let smoothedBackward = 0;
    // latched display name/color so the cue keeps showing the project it
    // actually telegraphed while it fades out, instead of snapping to the
    // new currentIdx's next/prev mid-fade.
    let displayForwardName: string | undefined;
    let displayForwardColor: string | undefined;
    let displayBackwardName: string | undefined;
    let displayBackwardColor: string | undefined;
    const ACTIVE_HOLD_MS = 60;
    const FADE_MS = 220;

    // picture-frame inset magnitudes for the UN-morphed (card) state, in px.
    // matches KaleidoscopeSection so the two pinned sections share the same
    // morph language and the entry/exit transitions read as one design system.
    const insetX = () =>
      window.innerWidth >= 1024 ? 112 : window.innerWidth >= 640 ? 64 : 24;
    const insetTop = () =>
      window.innerWidth >= 1024 ? 128 : window.innerWidth >= 640 ? 80 : 36;
    const insetBottom = () =>
      window.innerWidth >= 1024 ? 128 : window.innerWidth >= 640 ? 80 : 36;

    const morphTick = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // entry + exit morph (see KaleidoscopeSection for the same pattern):
      // the stage morphs from inset card to fullscreen on the way in, and
      // back to inset card on the way out, so the section's identity as a
      // "card" rather than "all of the viewport forever" is preserved
      // during the hand-off into the next section.
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
        // ignore scroll motion that's our own snap animation - it shouldn't
        // trigger the directional cue or re-arm the idle timer (which would
        // prevent the very snap that's running from ever "settling").
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

      // only show cues while the section is actively pinned. rect.top <= 0
      // means the stage has reached the top of the viewport; rect.bottom
      // > vh means it hasn't released yet.
      const inRail = rect.top <= 0 && rect.bottom > vh;

      // compute target tensions + the cue's intended name/color this frame.
      // smoothing below decouples these from what's actually rendered.
      let targetForward = 0;
      let targetBackward = 0;
      let frameNextName: string | undefined;
      let frameNextColor: string | undefined;
      let framePrevName: string | undefined;
      let framePrevColor: string | undefined;

      // post-swipe hold window: pin the destination cue at full strength so
      // even a one-frame fast-scroll spike gets a perceptible moment of
      // visibility. checked BEFORE the normal slot math so the hold can
      // override during the lock window when scroll isn't actually moving.
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
        // budgetProgress is the user's scroll position expressed in vh-units
        // of the total per-slot budget. derived from rect.top so the cues
        // stay accurate even when ScrollTrigger.onUpdate isn't firing (e.g.
        // during the post-swipe lock window when lenis is stopped).
        const travelPx = Math.max(1, totalBudget * vh);
        const rawProgress = clamp01(-rect.top / travelPx);
        const budgetProgress = rawProgress * totalBudget;
        // slotForward = how far into the *current* slot the scroll is.
        // 0 = just landed on this project, 1 = right at the boundary.
        // backward direction reads (1 - slotForward) so the cue is
        // strongest when the user is at the START of the slot scrolling
        // back up - i.e. about to cross into the previous project.
        // for XL slots, peel a dwell zone off each end of the vh budget so
        // the entry and exit spreads have time to settle in frame. the rail
        // pan happens only across the middle (1 - start - end) fraction.
        // for non-XL slots, slotPan is 0 so dwell is a no-op anyway.
        const dwellVh = slotPan[currentIdx] > 0 ? SLOT_DWELL_VH : 0;
        const panBudget = slotBudgets[currentIdx] - 2 * dwellVh;
        const panOffset = dwellVh;
        const slotForward = clamp01(
          (budgetProgress - slotStarts[currentIdx] - panOffset) / panBudget,
        );
        // raw position-in-slot, independent of dwell zones. used by the cue
        // so the glow can react to actual distance-from-boundary rather
        // than slotForward (which saturates at 1 throughout the dwell zone
        // and so can't distinguish "at dwell entry" from "at boundary").
        const slotProgress = clamp01(
          (budgetProgress - slotStarts[currentIdx]) / slotBudgets[currentIdx],
        );
        const currentSlotWidth = slotWidths[currentIdx] || 1;
        // for XL slots, anchor the cue thresholds to SLOT_DWELL_VH so the
        // glow only ramps inside the dwell zone, no matter how many spreads
        // the slot contains. start = entry into the dwell zone, full = ~half
        // a dwell from the boundary, so the cue saturates with visible
        // runway left. for non-XL slots the whole slot IS approach distance
        // (always within BUDGET_VH of a boundary), so we keep the existing
        // TENSION_START / TENSION_FULL.
        const boundaryTensionStart =
          currentSlotWidth > 1
            ? 1 - SLOT_DWELL_VH / slotBudgets[currentIdx]
            : TENSION_START;
        const boundaryTensionFull =
          currentSlotWidth > 1
            ? 1 - (SLOT_DWELL_VH * 0.4) / slotBudgets[currentIdx]
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

        // continuous internal pan for XL slots (slotPan > 0). when not in a
        // transition lock window, the rail's x is set every frame from
        // slotProgress so the user sees the panel's right side reveal as
        // they scroll. for standard (1vw) slots, slotPan is 0 and this
        // branch is a no-op - gsap.to() from swipeTo() owns rail.x there.
        if (now >= lockedUntil && slotPan[currentIdx] > 0) {
          const panX =
            -(panelStarts[currentIdx] + slotForward * slotPan[currentIdx]) *
            window.innerWidth;
          gsap.set(rail, { x: panX });
        }
      }

      // snap-on-idle: roll the user back down the dwell-zone slope to a
      // consistent rest anchor so the next swipe always needs the same push
      // to trigger. only runs when (a) the section is pinned, (b) we're not
      // mid-swipe lock, (c) at least SNAP_GUARD_MS has passed since the last
      // snap to prevent re-snap loops, and (d) the user has been idle for
      // SNAP_IDLE_MS (their own scroll updates lastActivityAt; our snap
      // animation does not, per the filter above).
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
          // XL slot: two anchors at SLOT_DWELL_VH from each boundary. the
          // pan range lives between them. snap pulls back from whichever
          // dwell side the user is parked in.
          const startAnchor = slotStartScroll + dwellPx;
          const endAnchor = slotEndScroll - dwellPx;
          if (cy < startAnchor) {
            snapTarget = startAnchor;
          } else if (cy > endAnchor) {
            snapTarget = endAnchor;
          }
        } else {
          // non-XL slot: single center anchor (whole slot is dwell since
          // slotPan is 0). center is equidistant from both boundaries, so
          // the trigger distance matches XL's dwell distance when
          // SLOT_DWELL_VH = BUDGET_VH / 2.
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

      // asymmetric damping: rise fast (~50ms time constant) so live scroll
      // input feels responsive; fall slow (~200ms) so transient peaks remain
      // visible long enough for the eye to register them.
      const dampUp = 1 - Math.exp(-dt * 22);
      const dampDown = 1 - Math.exp(-dt * 5);
      const fDamp = targetForward > smoothedForward ? dampUp : dampDown;
      const bDamp = targetBackward > smoothedBackward ? dampUp : dampDown;
      smoothedForward += (targetForward - smoothedForward) * fDamp;
      smoothedBackward += (targetBackward - smoothedBackward) * bDamp;

      // latch display name/color while the cue is fading (target == 0,
      // smoothed > epsilon). this way the cue keeps showing the project it
      // was telegraphing during the fade instead of snapping to the new
      // currentIdx's next/prev project mid-fade.
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

    // discrete project state machine. unlike a scrubbed pan, the rail does
    // not move continuously with scroll - it sits perfectly still at
    // -currentIdx*vw while the user scrolls through that project's slot,
    // then fires a fast GSAP swipe to the next project the moment scroll
    // crosses the slot boundary. consequence: there is never a frame where
    // two projects are partially visible. the active project owns the whole
    // viewport for its entire slot. ScrollTrigger here has no scrubbed tween
    // attached - it exists purely to track progress and emit onUpdate.
    //
    // currentIdx, lockedUntil, lastDirection, etc. are declared at the
    // useLayoutEffect scope (not inside gsap.context) so the morph + cue
    // rAF loop below can read them every frame.
    let currentIdx = 0;
    // earliest performance.now() at which another index change is allowed.
    // set whenever swipeTo() begins a transition; combined with the wheel
    // preventDefault + lenis.stop() below it actually absorbs trackpad
    // momentum (rather than just delaying it for one TRANSITION_S window).
    let lockedUntil = 0;
    // post-swipe cue hold: pins the destination cue at full tension for
    // CUE_HOLD_MS so the user gets a visible moment of feedback even when
    // their scroll input crossed a slot boundary in a single rAF tick.
    let cueHoldUntil = 0;
    let cueHoldDirection: 1 | -1 = 1;
    let cueHoldName: string | undefined;
    let cueHoldColor: string | undefined;
    const CUE_HOLD_MS = 200;
    let lenisResumeTimer: number | null = null;
    let wheelBlocker: ((e: WheelEvent) => void) | null = null;

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
      }
    };

    const hideCues = () => {
      renderCue(nextCue, nextCueName, 0, 1);
      renderCue(prevCue, prevCueName, 0, -1);
    };

    const releaseWheelBlock = () => {
      if (wheelBlocker) {
        window.removeEventListener("wheel", wheelBlocker);
        wheelBlocker = null;
      }
    };

    const lockScrollDuringSwipe = (
      lockMs: number,
      targetScrollY: number,
      duration: number,
    ) => {
      // belt-and-suspenders wheel blocker: Lenis's own onWheel calls
      // preventDefault while locked, but adding ours guards against
      // any frame where the listener might race the lock state.
      releaseWheelBlock();
      const blocker = (e: WheelEvent) => e.preventDefault();
      window.addEventListener("wheel", blocker, { passive: false });
      wheelBlocker = blocker;

      // smooth-scroll the page to the slot's intended entry edge in lock-
      // step with the rail tween. `lock: true` makes Lenis ignore user
      // wheel input for the animation duration (so a stale momentum tail
      // can't accumulate a new target) while still preventDefault-ing
      // those wheel events - unlike .stop() which leaves native scroll
      // free. Lenis auto-unlocks on tween completion via reset(), so the
      // user is back in control as soon as the rail settles. this is the
      // mechanism that gets the user to land cleanly on the slot's start
      // spread (forward) or end spread (backward) rather than a-tad-past
      // due to wheel momentum.
      const l = lenisRef.current;
      if (l) {
        l.scrollTo(targetScrollY, {
          duration,
          force: true,
          lock: true,
        });
      } else {
        window.scrollTo({ top: targetScrollY, behavior: "smooth" });
      }

      if (lenisResumeTimer !== null) window.clearTimeout(lenisResumeTimer);
      lenisResumeTimer = window.setTimeout(() => {
        releaseWheelBlock();
        lenisResumeTimer = null;
      }, lockMs);
    };

    const ctx = gsap.context(() => {
      gsap.set(rail, { x: 0 });

      // jumpToIdx: arbitrary-target navigation used by both the header
      // (jumpToIdx(0) = reset to first) and the carousel picker bars
      // (jumpToIdx(i) = go directly to project i). does it in one move
      // rather than chaining through the per-swipe lock - the chain takes
      // ~440ms per project, which would be seconds for a long jump.
      const jumpToIdx = (rawTarget: number) => {
        const target = Math.max(0, Math.min(N - 1, rawTarget));
        const targetX = -panelStarts[target] * window.innerWidth;
        const currentX = (gsap.getProperty(rail, "x") as number) ?? 0;
        if (target === currentIdx && Math.abs(currentX - targetX) < 1) return;
        // cancel anything the lock machinery has in flight - we're
        // forcing scroll to a known position and want lenis live again.
        lockedUntil = 0;
        cueHoldUntil = 0;
        if (lenisResumeTimer !== null) {
          window.clearTimeout(lenisResumeTimer);
          lenisResumeTimer = null;
        }
        releaseWheelBlock();
        // wipe cue state so the fade-out can't trail across the jump.
        smoothedForward = 0;
        smoothedBackward = 0;
        displayForwardName = undefined;
        displayForwardColor = undefined;
        displayBackwardName = undefined;
        displayBackwardColor = undefined;
        hideCues();
        // animate the rail to the target slot's start over a slightly
        // longer duration than a single-project swipe so multi-project
        // jumps read as one smooth motion rather than a rushed snap.
        gsap.killTweensOf(rail);
        currentIdx = target;
        setActiveIdx(target);
        const jumpDuration = 0.55;
        // re-lock for the duration of the jump animation. without this,
        // morphTick's XL-slot pan branch would set rail.x every frame
        // (since lockedUntil was just cleared) and fight the gsap.to()
        // interpolation, producing a stutter when jumping into or out of
        // an XL slot. also blocks onUpdate from interpreting any scroll-y
        // changes during the jump as new slot crossings.
        lockedUntil = performance.now() + jumpDuration * 1000 + 50;
        gsap.to(rail, {
          x: targetX,
          duration: jumpDuration,
          ease: "power3.inOut",
        });
        // resync scroll position to the target slot's start so the next
        // ScrollTrigger.onUpdate sees requested === currentIdx and doesn't
        // fire a redundant step.
        const sectionTop = section.getBoundingClientRect().top + window.scrollY;
        const targetScrollY =
          sectionTop + slotStarts[target] * window.innerHeight;
        const lenisNow = lenisRef.current;
        if (lenisNow) {
          lenisNow.start();
          // smooth-scroll over the same window as the rail's gsap.to() so
          // both the vertical scroll and the horizontal pan animate
          // together. without duration (or with immediate: true) the page
          // would teleport to targetScrollY while only the rail panned,
          // which reads as a jarring "snap-then-slide" especially when
          // jumping back to bar 0 from deep in the section.
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
        // target x = align project idx's left edge with viewport left for
        // forward / neutral swipes. for *backward* swipes into a multi-
        // spread (XL) slot we instead land on the slot's RIGHT edge, so the
        // last spread of the previous project is what the user sees on
        // entry - continued upward scrolling then pans backward through the
        // rest of that project. without this, scrolling back into a wide
        // project teleports rail.x to the first spread, then the morph rAF
        // immediately snaps it to the last spread (because scrollY sits at
        // the end of that slot's budget), producing the visible "pulls to
        // start, then jumps to end" glitch.
        const isBackwardIntoWideSlot = direction < 0 && slotPan[idx] > 0;
        const targetVw = isBackwardIntoWideSlot
          ? -(panelStarts[idx] + slotPan[idx])
          : -panelStarts[idx];
        const targetX = targetVw * window.innerWidth;
        if (instant) {
          // resize / refresh: no cue afterglow makes sense here, snap
          // everything to zero so the rail's new layout looks clean.
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
          // resolve the target scrollY for this entry direction so the rail
          // tween and the page scroll animate to matched destinations.
          // forward entry -> slot start + 1px (lands the user cleanly on
          // the first spread, regardless of how much wheel momentum carried
          // scrollY past the boundary).
          // backward entry -> slot end minus 1px (lands on the last spread,
          // but stays strictly inside the slot so the next onUpdate tick
          // doesn't see scrollY at slotStarts[idx+1] and re-step forward).
          // NOTE: backward targeting must NOT be gated on slotPan > 0 - for
          // a non-XL slot, slotPan is 0 but the slot still occupies a vh
          // range. previously this branch landed backward entries at the
          // slot START, which pulled scrollY DOWN through the entire slot
          // and let the next wheel tick exit to the project before it -
          // the "goes two projects back" bug.
          const sectionTop =
            section.getBoundingClientRect().top + window.scrollY;
          const vh = window.innerHeight;
          const slotStartY = slotStarts[idx] * vh;
          const slotEndY = (slotStarts[idx] + slotBudgets[idx]) * vh;
          const isBackward = direction < 0;
          const targetSlotY = isBackward ? slotEndY - 1 : slotStartY + 1;
          const targetScrollY = sectionTop + targetSlotY;

          // a single "transition window": ~swipe duration + a small buffer
          // to cover the tail of trackpad inertia. during this window we
          // both gate the index step (onUpdate early-returns) AND smoothly
          // animate the page to the destination edge (lockScrollDuringSwipe
          // above) so the chain of auto-advancing swipes is impossible and
          // the user always lands cleanly on the intended spread.
          const lockMs = TRANSITION_S * 1000 + 120;
          lockedUntil = performance.now() + lockMs;
          lockScrollDuringSwipe(lockMs, targetScrollY, TRANSITION_S);
        }
      };

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => `+=${getTravel()}`,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (performance.now() < lockedUntil) return;

          // skip if the section is no longer pinned at the viewport top.
          // ScrollTrigger fires onUpdate at the boundaries (progress 0 / 1)
          // even when the user has scrolled completely out of the rail's
          // range - e.g. after a nav-bar curtain teleport to #experience.
          // proceeding would call swipeTo() -> lockScrollDuringSwipe() ->
          // lenis.scrollTo(slotEdge), which yanks the page back into the
          // projects section and traps the user. checking rect here is
          // identical to the inRail gate used by morphTick for cues.
          const rect = section.getBoundingClientRect();
          const vh = window.innerHeight;
          if (rect.top > 0 || rect.bottom <= vh) return;

          // map scroll progress -> slot index via cumulative slot budgets.
          // can't use Math.floor here because slots have variable widths
          // (XL slots cover more scroll than standard slots).
          const budgetProgress = self.progress * totalBudget;
          let requested = N - 1;
          for (let i = 0; i < N; i++) {
            if (budgetProgress < slotStarts[i + 1]) {
              requested = i;
              break;
            }
          }
          if (requested !== currentIdx) {
            // clamp to a single step. heavy scrolls become a chain of
            // single-project swipes instead of jumping over intermediates,
            // so every project gets at least TRANSITION_S of screen time.
            const step =
              requested > currentIdx ? currentIdx + 1 : currentIdx - 1;
            const dir: 1 | -1 = step > currentIdx ? 1 : -1;
            // arm the cue hold BEFORE flipping currentIdx so it captures the
            // destination project (projects[step]) before the slot math
            // would compute against the new currentIdx. this is what
            // guarantees the user sees the destination cue at full strength
            // even on flicks that crossed the boundary in a single frame.
            cueHoldUntil = performance.now() + CUE_HOLD_MS;
            cueHoldDirection = dir;
            cueHoldName = projects[step]?.name;
            cueHoldColor = projects[step]
              ? projectTint(projects[step])
              : undefined;
            currentIdx = step;
            setActiveIdx(step);
            swipeTo(step, false, dir);
          }
        },
        onRefresh: () => {
          // on window resize, vw changes - rail.x for currentIdx needs to
          // be re-pinned instantly (no animation) so we don't see a phantom
          // swipe during layout reflow.
          swipeTo(currentIdx, true);
        },
      });

      // cold-load deep-link fix: when the page loads with `#projects` in
      // the URL, the browser does its native anchor jump BEFORE this
      // useLayoutEffect runs - at that point the section's css height is
      // still its un-measured initial value, so the browser lands scrollY
      // somewhere inside what will eventually become the rail's pinned
      // range. by the time we measure and grow the section, scrollY is
      // stranded in the middle of the first or second project instead of
      // at the rail's start. re-align scroll to the section's top so deep
      // links to /#projects always start on project 01's intro spread.
      // double-rAF waits for ScrollTrigger.refresh + any layout settle.
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

    // listener for the navbar's "projects:reset" event. when the user
    // clicks the projects nav link, Nav.tsx scrolls scrollY to the
    // section top instantly but the rail's currentIdx + rail.x remain
    // wherever they were - the next ScrollTrigger.onUpdate tick steps
    // backward into slot 0 and lands at the slot's *end* (backward entry
    // into XL slot rule), which is apple-triage's editorial overview
    // rather than its hero. on reset we short-circuit through jumpToIdx(0)
    // so explicit navbar nav always lands on the hero regardless of
    // where the user was previously parked.
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
      {/* no per-project snap markers and no custom snap effect: this rail
          is a discrete slideshow rather than a scrubbed pan, so there is
          no "mid-transition" position to snap away from. the rail's
          ScrollTrigger inside useLayoutEffect handles slot-boundary swipes
          directly. */}
      <div
        ref={stageRef}
        data-stage="dark"
        className="stage sticky w-full"
        style={{
          // constant layout box: stage is always full-viewport pinned at
          // top. clip-path is what visually morphs between picture-frame
          // card and fullscreen. defaults match the un-morphed state so
          // first paint doesn't flash.
          top: 0,
          height: "100svh",
          borderRadius: "var(--rail-radius, 28px)",
          clipPath:
            "inset(var(--rail-clip-top, 128px) var(--rail-clip-x, 112px) var(--rail-clip-bottom, 128px) var(--rail-clip-x, 112px) round var(--rail-radius, 28px))",
          WebkitClipPath:
            "inset(var(--rail-clip-top, 128px) var(--rail-clip-x, 112px) var(--rail-clip-bottom, 128px) var(--rail-clip-x, 112px) round var(--rail-radius, 28px))",
        }}
      >
        {/* stage-edge repositioned to match the clip-path so the soft inner
            glow + 1px rim land on the visible card boundaries during the
            un-morphed state. opacity fades with morph so the rim doesn't
            sit at the viewport border in fullscreen. */}
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

        {/* section index doubles as a reset-to-first affordance. clicking
            it snaps the rail back to project 1 and re-anchors scroll to the
            section top in one move. */}
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

        {/* the rail. GSAP translates this on the X axis as the user scrolls
            vertically. on touch/reduced-motion it falls back to native
            horizontal scrolling (classes are added in the effect). */}
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

        {/* stage-level picker: rendered OUTSIDE the rail's translating parent
            so it stays anchored to the stage's bottom regardless of the
            rail's horizontal pan. driven by activeIdx React state which the
            effect updates on every slot transition. */}
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
                {/* hover tooltip: pops above the bar with the project name +
                    a tint dot. border uses color-mix so each tooltip's frame
                    subtly carries that project's accent color. */}
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
