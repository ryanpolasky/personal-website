"use client";

// hero CTAs dispatch the same curtain-wash navigation event as the navbar.

import { MagneticButton } from "@/components/MagneticButton";

function washTo(id: string) {
  window.dispatchEvent(new CustomEvent("nav:wash", { detail: { id } }));
}

export function HeroCtas() {
  return (
    // mobile: column, items-center. "see the projects" is row 1 (centered alone),
    //   the inner wrapper holds get-in-touch + resume as row 2 (also centered).
    // desktop (sm+): wrapper uses `sm:contents` so its children become direct
    //   flex items of the parent row, reproducing the original 3-pill layout.
    <div className="mt-7 flex flex-col items-center gap-2.5 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-3">
      <MagneticButton
        href="#projects"
        onClick={(e) => {
          e.preventDefault();
          washTo("projects");
        }}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 py-3 text-[13px] tracking-tight text-[var(--color-stage)] transition-colors hover:bg-[var(--color-accent-soft)] sm:py-3.5"
      >
        see the projects →
      </MagneticButton>
      <div className="flex items-center justify-center gap-2.5 sm:contents">
        <MagneticButton
          href="#contact"
          onClick={(e) => {
            e.preventDefault();
            washTo("contact");
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-[12.5px] tracking-tight text-white transition-colors hover:border-white/70 sm:px-6 sm:py-3.5 sm:text-[13px]"
        >
          get in touch
        </MagneticButton>
        {/* resume opens in a new tab and shares the secondary CTA styling. */}
        <MagneticButton
          href="/assets/Ryan_Polasky_Resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-[12.5px] tracking-tight text-white transition-colors hover:border-white/70 sm:px-6 sm:py-3.5 sm:text-[13px]"
        >
          résumé ↗
        </MagneticButton>
      </div>
    </div>
  );
}
