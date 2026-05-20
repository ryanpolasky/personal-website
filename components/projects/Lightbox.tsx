"use client";

// fullscreen lightbox. portal'd to body so it escapes the rail transform.
// dismisses on ESC, backdrop click, or close button.

import Image from "next/image";
import { useEffect } from "react";
import type { ProjectMediaItem } from "@/lib/projects";

export interface LightboxProps {
  item: ProjectMediaItem;
  onClose: () => void;
}

export function Lightbox({ item, onClose }: LightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // lock body scroll while open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!item.src) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.alt ?? item.label}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-[11px] uppercase tracking-[0.28em] text-white backdrop-blur transition-colors hover:bg-white/20"
        style={{ fontFamily: "var(--font-mono)" }}
        aria-label="close preview"
        data-hoverable
      >
        <span aria-hidden>✕</span>
        <span>close</span>
      </button>
      <div
        className="relative flex max-h-full max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={item.src}
          alt={item.alt ?? item.label}
          width={2400}
          height={1500}
          unoptimized
          className="max-h-[88vh] max-w-[94vw] rounded-2xl object-contain shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
        />
        {item.label ? (
          <div
            className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/85 backdrop-blur"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {item.label}
          </div>
        ) : null}
      </div>
    </div>
  );
}
