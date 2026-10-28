"use client";

import { MagneticButton } from "@/components/MagneticButton";
import { RESUME_PDF_HREF } from "@/lib/site";

function washTo(id: string) {
  window.dispatchEvent(new CustomEvent("nav:wash", { detail: { id } }));
}

export function HeroCtas() {
  return (
    <div className="hero-actions" data-hero-enter>
      <MagneticButton
        href="#projects"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          washTo("projects");
        }}
        className="studio-button studio-button-primary"
      >
        see the projects <span className="studio-arrow" aria-hidden>↗</span>
      </MagneticButton>
      <div className="contents">
        <MagneticButton
          href="#contact"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            washTo("contact");
          }}
          className="studio-button studio-button-text"
        >
          get in touch
        </MagneticButton>
        <MagneticButton
          href={RESUME_PDF_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="studio-button studio-button-text"
        >
          résumé <span className="studio-arrow" aria-hidden>↗</span>
        </MagneticButton>
      </div>
    </div>
  );
}
