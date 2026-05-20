"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TransitionEvent,
} from "react";
import Link from "next/link";
import { useLenis } from "@/components/SmoothScrollProvider";

// floating nav with active-section tracking and curtain-masked anchor teleports.

const SLIDE_MS = 400;
const DWELL_MS = 140;

type NavPhase = "idle" | "closing" | "closed" | "opening" | "resetting";

const SECTIONS = [
  { id: "about", label: "about" },
  { id: "experience", label: "experience" },
  { id: "projects", label: "projects" },
  { id: "contact", label: "contact" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("");
  const [phase, setPhase] = useState<NavPhase>("idle");
  const transitionTimer = useRef<number | null>(null);
  const pendingTarget = useRef<{ id: string; element: HTMLElement } | null>(
    null,
  );
  const lenis = useLenis();

  // clear pending transition work on unmount.
  useEffect(() => {
    return () => {
      if (transitionTimer.current != null) {
        window.clearTimeout(transitionTimer.current);
        transitionTimer.current = null;
      }
      pendingTarget.current = null;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const y = window.scrollY;
      setScrolled(y > 80);
      // last matching section wins, so nested sections can override wrappers.
      const threshold = window.innerHeight * 0.4;
      let best = "";
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold && rect.bottom >= 0) {
          best = s.id;
        }
      }
      setActive(best);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // shared wash trigger for nav anchors and the global 'nav:wash' event.
  const triggerWashTo = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (transitionTimer.current != null) {
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
    pendingTarget.current = { id, element: target };
    setPhase("closing");
  }, []);

  const handleNavClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, id: string) => {
      // let modifier-clicks / non-primary buttons fall through.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      // the real teleport waits for the curtain's transform transitionend.
      triggerWashTo(id);
    },
    [triggerWashTo],
  );

  // listen for external curtain-wash requests from hero CTAs.
  useEffect(() => {
    const onWash = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      triggerWashTo(id);
    };
    window.addEventListener("nav:wash", onWash);
    return () => window.removeEventListener("nav:wash", onWash);
  }, [triggerWashTo]);

  const handleHomeClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    if (transitionTimer.current != null) {
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }

    pendingTarget.current = { id: "", element: document.body };
    setPhase("closing");
  }, []);

  const handleCurtainTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || e.propertyName !== "transform")
        return;

      if (phase === "closing") {
        const pending = pendingTarget.current;
        if (!pending) return;

        setPhase("closed");

        if (lenis) {
          if (pending.id) {
            lenis.scrollTo(pending.element, { immediate: true });
          } else {
            lenis.scrollTo(0, { immediate: true });
          }
        } else {
          if (pending.id) {
            pending.element.scrollIntoView({ behavior: "auto" });
          } else {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          }
        }
        if (typeof history !== "undefined") {
          history.replaceState(
            null,
            "",
            pending.id ? `#${pending.id}` : window.location.pathname,
          );
        }

        // tell ProjectsRail to reset its rail position to slot 0's hero.
        // without this, the scrollTo above lands scrollY at sectionTopAbs
        // but the rail's internal currentIdx (and gsap rail.x) is still at
        // whatever project the user was previously viewing - the next
        // ScrollTrigger onUpdate tick steps backward through the slots
        // and, because backward entry into an XL slot lands at the slot's
        // *end* (editorial overview spread for apple-triage), the user
        // sees the editorial card on entry instead of the hero. firing
        // this event lets the rail short-circuit to a clean jumpToIdx(0).
        if (pending.id === "projects" && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("projects:reset"));
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            transitionTimer.current = window.setTimeout(() => {
              setPhase("opening");
            }, DWELL_MS);
          });
        });
        return;
      }

      if (phase === "opening") {
        // snap the panel invisibly back to its idle position with a one-frame
        // transition:none window. then immediately re-enter idle so the
        // transition is re-armed for the next click.
        pendingTarget.current = null;
        setPhase("resetting");
        // wait two frames before returning to idle. first frame commits
        // transition:none + translateY(100%) while the panel is already fully
        // offscreen; second frame restores the normal transition. doing this
        // over two frames prevents Chrome/Safari from occasionally coalescing
        // the reset with the end of the opening animation, which made the
        // curtain visibly come back down.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            transitionTimer.current = null;
            setPhase("idle");
          });
        });
      }
    },
    [lenis, phase],
  );

  return (
    <>
      {/* Simple curtain wash transition overlay. A single accent panel sweeps
          up from the bottom, covers the screen for the teleport, and continues
          sweeping up off the top. Clean, minimal. When idle, it snaps instantly
          back to the bottom without animating. */}
      <div
        aria-hidden
        className={`fixed inset-0 z-[200] bg-[var(--color-accent)] ${
          phase === "idle" || phase === "resetting"
            ? "pointer-events-none"
            : "pointer-events-auto"
        }`}
        style={{
          transform:
            phase === "closing" || phase === "closed"
              ? "translate3d(0, 0%, 0)"
              : phase === "opening"
                ? "translate3d(0, -100%, 0)"
                : "translate3d(0, 100%, 0)",
          transition:
            phase === "resetting"
              ? "none"
              : `transform ${SLIDE_MS}ms cubic-bezier(0.83, 0, 0.17, 1)`,
          willChange: "transform",
        }}
        onTransitionEnd={handleCurtainTransitionEnd}
      />
      <nav
        aria-label="primary"
        className={`fixed left-1/2 z-[80] -translate-x-1/2 transition-all duration-500 ease-out ${
          scrolled ? "top-3" : "top-5"
        }`}
      >
        <div
          className={`flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_82%,transparent)] px-2 py-1 backdrop-blur-md shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] transition-all duration-500 ${
            scrolled ? "scale-[0.96]" : "scale-100"
          }`}
        >
          <Link
            href="/"
            onClick={handleHomeClick}
            onClickCapture={handleHomeClick}
            className="px-3 py-1.5 text-[12px] tracking-tight text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
            data-hoverable
          >
            <span className="font-medium">ryan polasky</span>
          </Link>
          <span
            className="mx-1 h-3 w-px bg-[var(--color-line-strong)]"
            aria-hidden
          />
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => handleNavClick(e, s.id)}
              onClickCapture={(e) => handleNavClick(e, s.id)}
              className={`relative px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                active === s.id
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
              data-hoverable
            >
              {s.label}
              {active === s.id && (
                <span
                  className="absolute inset-x-3 -bottom-0.5 h-px bg-[var(--color-accent)]"
                  aria-hidden
                />
              )}
            </a>
          ))}
          <span
            className="mx-1 h-3 w-px bg-[var(--color-line-strong)]"
            aria-hidden
          />
          <span
            className="flex items-center gap-2 rounded-full bg-[var(--color-accent)]/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-accent-warm)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            </span>
            <span className="hidden sm:inline">available may 2026</span>
            <span className="sm:hidden">available</span>
          </span>
        </div>
      </nav>
    </>
  );
}
