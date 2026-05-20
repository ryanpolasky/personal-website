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

// hash-driven project modal (static-export replacement for intercepting
// routes). renders when window.location.hash matches `#projects/<id>`.

const HASH_PREFIX = "#projects/";

function parseHash(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const id = hash.slice(HASH_PREFIX.length);
  if (!id) return null;
  return id;
}

export function ProjectHashModal() {
  const [openId, setOpenId] = useState<string | null>(null);
  const lenis = useLenis();

  // sync state to location.hash (cold-load deep links + hashchange).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setOpenId(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const close = useCallback(() => {
    if (typeof window === "undefined") return;
    // prefer back if a card click pushed history; else clear hash directly.
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
      // hashchange doesn't fire for replaceState; dispatch for listeners.
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, []);

  // pause lenis while modal is open; data-lenis-prevent on the inner
  // scroll area lets modal content scroll normally.
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

// modal shell. captures the morphOrigin singleton at mount and animates
// top/left/width/height directly (FM layoutId doesn't observe the rail's
// GSAP transform, so it would read an off-screen start rect).
function ProjectModalShell({
  projectId,
  onClose,
  children,
}: {
  projectId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // snapshot both rects at mount. origin is null on cold-load (direct hash)
  // - fall back to scale-from-90% centered at the target rect.
  const { initialRect, targetRect, hasOrigin } = useMemo(() => {
    const origin = getMorphOrigin();
    const target = getModalTargetRect();
    if (!origin) {
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

  // hide the matching rail card for the full modal lifecycle so the exit
  // morph back to its rect doesn't double-render. cleanup also clears the
  // morphOrigin so future cold-loads don't inherit a stale rect.
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
        // spring tuned ~450ms for viewport-sized morphs.
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
          // tween borderRadius (spring overshoot looks weird on corners).
          borderRadius: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
        }}
        className="z-[101] flex flex-col overflow-hidden border border-[var(--color-line-invert)] bg-[color-mix(in_oklab,var(--color-stage-soft)_70%,transparent)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`project-${projectId}-name`}
      >
        {/* fade content independently of the shell's morph so the user
            doesn't see the modal layout reflow into card dimensions on close. */}
        <motion.div
          className="flex flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
