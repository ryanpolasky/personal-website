"use client";

// hero CTAs dispatch the same curtain-wash navigation event as the navbar.

import { MagneticButton } from "@/components/MagneticButton";

function washTo(id: string) {
  window.dispatchEvent(new CustomEvent("nav:wash", { detail: { id } }));
}

export function HeroCtas() {
  return (
    <div className="mt-9 flex flex-wrap items-center gap-3">
      <MagneticButton
        href="#projects"
        onClick={(e) => {
          e.preventDefault();
          washTo("projects");
        }}
        className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[13px] tracking-tight text-[var(--color-stage)] transition-colors hover:bg-[var(--color-accent-soft)]"
      >
        see the projects →
      </MagneticButton>
      <MagneticButton
        href="#contact"
        onClick={(e) => {
          e.preventDefault();
          washTo("contact");
        }}
        className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-[13px] tracking-tight text-white transition-colors hover:border-white/70"
      >
        get in touch
      </MagneticButton>
      {/* resume opens in a new tab and shares the secondary CTA styling. */}
      <MagneticButton
        href="/assets/Ryan_Polasky_Resume.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-[13px] tracking-tight text-white transition-colors hover:border-white/70"
      >
        résumé ↗
      </MagneticButton>
    </div>
  );
}
