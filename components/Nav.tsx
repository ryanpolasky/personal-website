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

function destLabelFor(id: string): string {
  if (!id) return "welcome";
  const sec = SECTIONS.find((s) => s.id === id);
  return sec?.label ?? id;
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("");
  const [phase, setPhase] = useState<NavPhase>("idle");
  const [destLabel, setDestLabel] = useState("welcome");
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
    // active-section + scrolled flag, driven by scroll events rather than a
    // permanent 60fps rAF. rAF-coalesced so a fast wheel doesn't run the
    // measure multiple times per frame; result-cached so unchanged values
    // don't re-render the whole nav (and its curtain) every tick.
    let rafId = 0;
    let queued = false;
    let lastScrolled = false;
    let lastActive = "";
    const measure = () => {
      queued = false;
      const y = window.scrollY;
      const nextScrolled = y > 80;
      if (nextScrolled !== lastScrolled) {
        lastScrolled = nextScrolled;
        setScrolled(nextScrolled);
      }
      const threshold = window.innerHeight * 0.4;
      let best = "";
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold && rect.bottom >= 0) best = s.id;
      }
      if (best !== lastActive) {
        lastActive = best;
        setActive(best);
      }
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      rafId = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
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
    setDestLabel(destLabelFor(id));
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
    setDestLabel("welcome");
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

        // notify ProjectsRail (and any other listeners) that the next scroll
        // change is a curtain-masked teleport, not user-driven; rail uses this
        // to skip onEnter/onEnterBack landings that would hijack the teleport.
        window.dispatchEvent(new CustomEvent("nav:teleport"));

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

        // tell ProjectsRail to reset to slot 0; without this the rail's
        // internal currentIdx stays at the previously-viewed project.
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
        // reset to idle over two frames - one to commit transition:none
        // + translateY(100%), one to restore the normal transition.
        pendingTarget.current = null;
        setPhase("resetting");
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
      {/* curtain wash overlay: accent panel sweeps up, covers, sweeps off top. */}
      <div
        aria-hidden
        className={`fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-[var(--color-accent)] ${
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
      >
        <span
          className="display select-none text-white"
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(3.5rem, 12vw, 10rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
            opacity:
              phase === "closing" || phase === "closed" ? 1 : 0,
            transition: `opacity ${SLIDE_MS - 80}ms ease ${phase === "closing" ? 120 : 0}ms`,
          }}
        >
          {destLabel}
        </span>
      </div>
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
