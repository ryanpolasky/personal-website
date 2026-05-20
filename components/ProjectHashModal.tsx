"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PROJECTS } from "@/lib/projects";
import { ProjectFullView, projectTint } from "@/components/ProjectFullView";
import { useLenis } from "@/components/SmoothScrollProvider";
import {
  getModalTargetRect,
  getMorphOrigin,
  setHiddenCardId,
  setMorphOrigin,
  type MorphOrigin,
} from "@/lib/morphOrigin";

// hash-driven project modal. lives at the root of the layout, listens to
// `window.location.hash`, and renders a fullscreen project view when the
// hash matches `#projects/<id>`. closes by clearing the hash (or by browser
// back, since hash changes create history entries).
//
// this is the static-export-compatible replacement for the intercepting
// route version that next/cloudflare-pages couldn't support. trade-off:
// URLs read `/#projects/autopsy` instead of `/projects/autopsy`. functionally
// equivalent - shareable, browser-back-friendly, deep-linkable on cold
// load.

const HASH_PREFIX = "#projects/";

function parseHash(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const id = hash.slice(HASH_PREFIX.length);
  if (!id) return null;
  return id;
}

export function ProjectHashModal() {
  // openId is the project currently visible in the modal. null when no
  // modal is open. derived purely from window.location.hash.
  const [openId, setOpenId] = useState<string | null>(null);
  const lenis = useLenis();

  // sync state to location.hash. fires on initial mount (so cold-load
  // deep links work), on `hashchange`, and on programmatic hash updates
  // we dispatch ourselves from the rail card click handler.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setOpenId(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const close = useCallback(() => {
    if (typeof window === "undefined") return;
    // try browser back first - if the modal was opened via a card click
    // (which pushed history), back closes it cleanly and the URL hash
    // clears naturally. otherwise fall back to explicit hash clear.
    const hadModalInHistory = window.history.state?.modalOpened === true;
    if (hadModalInHistory && window.history.length > 1) {
      window.history.back();
    } else {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      setOpenId(null);
      // hashchange doesn't fire for replaceState, dispatch manually so
      // any other listeners (analytics, future modals) react.
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, []);

  // body scroll lock via lenis while the modal is open. data-lenis-prevent
  // on the modal's scrollable content (in ProjectFullView) lets the user
  // scroll within the modal without triggering lenis.
  useEffect(() => {
    if (!lenis) return;
    if (openId) {
      lenis.stop();
    } else {
      lenis.start();
    }
  }, [lenis, openId]);

  // esc to close
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  const project = openId ? PROJECTS.find((p) => p.id === openId) : null;

  return (
    <AnimatePresence>
      {project && (
        <ProjectModalShell
          key={project.id}
          projectId={project.id}
          onClose={close}
        >
          <ProjectFullView project={project} tintColor={projectTint(project)} />
        </ProjectModalShell>
      )}
    </AnimatePresence>
  );
}

// modal shell: backdrop + morphing card container + close button. captures
// the morphOrigin singleton ONCE at mount time and uses it as the spring's
// start + end rect, so the entire enter/exit animation drives off a single
// stable origin (even if the user happens to mutate the rail between open
// and close - which shouldn't happen since lenis is paused, but defensive).
//
// the morph is driven by animating top/left/width/height directly rather
// than via framer-motion's layoutId shared layout. layoutId reads the
// source element's rect via FM's internal layout-effect tracking, which
// doesn't observe GSAP transforms - so it would have read the rail card's
// pre-translate (off-screen) rect as the morph start. capturing the live
// rect on click bypasses that.
function ProjectModalShell({
  projectId,
  onClose,
  children,
}: {
  projectId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // snapshot both rects at mount. origin can be null on cold-load (the
  // user landed at /#projects/foo directly, no card was clicked) - in that
  // case fall back to a fade+scale-from-center initial so the modal still
  // arrives gently rather than popping.
  const { initialRect, targetRect, hasOrigin } = useMemo(() => {
    const origin = getMorphOrigin();
    const target = getModalTargetRect();
    if (!origin) {
      // cold-load fallback: scale-from-90% centered at the target rect.
      // gives a "rise into view" feel without needing an actual origin.
      const cx = target.left + target.width / 2;
      const cy = target.top + target.height / 2;
      const w = target.width * 0.9;
      const h = target.height * 0.9;
      return {
        initialRect: {
          top: cy - h / 2,
          left: cx - w / 2,
          width: w,
          height: h,
          borderRadius: target.borderRadius,
        } satisfies MorphOrigin,
        targetRect: target,
        hasOrigin: false,
      };
    }
    return { initialRect: origin, targetRect: target, hasOrigin: true };
  }, []);

  // hide the rail card matching this project for the entire modal
  // lifecycle (mount → exit animation → unmount). cleanup runs only after
  // AnimatePresence finishes the exit animation, so the card stays hidden
  // while the modal morphs back to its rect - avoiding the "two copies of
  // the same content visible at once" doubling the user was seeing.
  // also clears the morphOrigin singleton at the same time so subsequent
  // cold-loads / direct hash URLs don't inherit a stale rect.
  useEffect(() => {
    setHiddenCardId(projectId);
    return () => {
      setHiddenCardId(null);
      setMorphOrigin(null);
    };
  }, [projectId]);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onClick={onClose}
        aria-hidden
      />

      <motion.div
        // position: fixed + top/left/width/height all animatable. spring
        // tuned to feel substantial without dragging - 180/26 lands ~450ms
        // for typical viewport-sized morphs, which is the sweet spot
        // between "snappy" and "watch the morph happen."
        initial={{
          position: "fixed",
          top: initialRect.top,
          left: initialRect.left,
          width: initialRect.width,
          height: initialRect.height,
          borderRadius: initialRect.borderRadius,
          opacity: hasOrigin ? 1 : 0,
        }}
        animate={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          borderRadius: targetRect.borderRadius,
          opacity: 1,
        }}
        exit={{
          top: initialRect.top,
          left: initialRect.left,
          width: initialRect.width,
          height: initialRect.height,
          borderRadius: initialRect.borderRadius,
          opacity: hasOrigin ? 1 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 180,
          damping: 26,
          mass: 0.9,
          // border-radius needs a tween, not a spring (spring overshoot
          // looks weird on corner radius).
          borderRadius: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
        }}
        className="z-[101] flex flex-col overflow-hidden border border-[var(--color-line-invert)] bg-[color-mix(in_oklab,var(--color-stage-soft)_70%,transparent)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`project-${projectId}-name`}
      >
        {/* inner content wrapper fades independently of the outer shell's
            morph. on close, ProjectFullView's clamp(...vw...) typography +
            grid reflow continuously as the modal shrinks toward the rail
            card's rect - at the very end of the morph the modal lands at
            card dimensions but is still showing the modal layout (huge
            display headline compressed, grid collapsed). when AnimatePresence
            then unmounts the modal and the card unhides, the card's totally
            different layout snaps in at the same position, reading as a
            jarring "formatting shift." fading the content out by ~0.22s
            into the ~0.45s morph lets the user watch the shell shrink fully
            while hiding the reflow weirdness, so when the card reveals it
            replaces empty (transparent) content rather than a mis-formatted
            ProjectFullView. */}
        <motion.div
          className="flex flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // open: snappy fade-in once the morph is underway. close: slower,
          // ease-out fade that stays visible through most of the shrink and
          // finishes just before the morph lands at card-rect dimensions -
          // gradual enough to read as a "content dissolves" beat instead of
          // a snap, but still ends before the reflow-at-card-size would
          // become visible.
          transition={{
            opacity: {
              duration: 0.36,
              ease: [0.16, 1, 0.3, 1],
            },
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="close project"
            data-hoverable
            className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line-invert-strong)] text-[var(--color-text-invert)] transition-colors hover:border-[var(--color-accent-soft)] hover:text-[var(--color-accent-soft)] sm:right-6 sm:top-6"
            style={{ fontFamily: "var(--font-mono)", fontSize: "14px" }}
          >
            ×
          </button>
          {children}
        </motion.div>
      </motion.div>
    </>
  );
}
