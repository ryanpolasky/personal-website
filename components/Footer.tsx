"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ContactBlobView } from "@/components/scenes/ContactBlobView";

// magazine-back-cover footer. oversize wordmark + three-col meta block,
// sits flush against the bottom of the contact band so there's no exposed
// page-bg gap between the two sections. the wordmark itself ends in a
// decorative WebGL blob period (see inline span below). renders the
// current year client-side after mount to dodge SSR drift.

export function Footer() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);

  return (
    <footer className="relative px-4 pb-10 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <h2
          className="display mt-4 select-none text-[clamp(3.5rem,18vw,18rem)] leading-[0.85] tracking-[-0.045em] text-[var(--color-text)] sm:mt-6"
          aria-label="ryan polasky."
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 50',
            }}
          >
            ryan
          </span>{" "}
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            polasky
          </span>
          {/* contact blob as the wordmark's decorative period. inline-block
              with baseline alignment + em-relative size so the dot scales
              with the wordmark on desktop; the max() floor of 1.5rem keeps
              the canvas large enough on mobile to actually render the blob
              recognizably (below ~24px the 3D shape becomes mush). the
              translateY shifts the sphere's visual center down toward the
              text baseline - without it, the sphere floats at the height
              of lowercase letter middles because three.js centers the mesh
              inside the canvas box rather than at the box's bottom. */}
          <span
            className="relative inline-block align-baseline"
            style={{
              width: "max(1.5rem, 0.25em)",
              height: "max(1.5rem, 0.25em)",
              transform: "translateY(0.1em)",
            }}
            aria-hidden
          >
            <ContactBlobView className="absolute inset-0" />
          </span>
        </h2>

        <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-12">
          <div
            className="space-y-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <p className="text-[var(--color-text-muted)]">colophon</p>
            <p>site v15.0 · feat/full-rebuild</p>
            <p>inter · fraunces · jetbrains mono</p>
            <p>next.js · react three fiber · gsap</p>
          </div>

          <div
            className="space-y-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <p className="text-[var(--color-text-muted)]">elsewhere</p>
            <a
              href="https://www.linkedin.com/in/ryan-polasky/"
              target="_blank"
              rel="noreferrer noopener"
              className="block transition-colors hover:text-[var(--color-text)]"
              data-hoverable
            >
              linkedin →
            </a>
            <a
              href="https://github.com/ryanpolasky"
              target="_blank"
              rel="noreferrer noopener"
              className="block transition-colors hover:text-[var(--color-text)]"
              data-hoverable
            >
              github →
            </a>
            <a
              href="/spotify.html"
              className="block transition-colors hover:text-[var(--color-text)]"
              data-hoverable
            >
              spotify →
            </a>
            <Link
              href="/gallery"
              className="block transition-colors hover:text-[var(--color-text)]"
              data-hoverable
            >
              gallery →
            </Link>
          </div>

          <div
            className="flex flex-col gap-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-faint)] sm:items-end sm:text-right"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <p className="text-[var(--color-text-muted)]">say hi</p>
            <a
              href="mailto:ryanpolasky@hotmail.com"
              className="transition-colors hover:text-[var(--color-text)]"
              data-hoverable
            >
              ryanpolasky@hotmail.com
            </a>
            <a
              href="/assets/Ryan_Polasky_Resume.pdf"
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-[var(--color-text)]"
              data-hoverable
            >
              resume.pdf
            </a>
            <p className="mt-4 text-[var(--color-text-faint)]">
              © {year ?? new Date().getFullYear()} north dakota
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
