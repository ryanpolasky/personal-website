"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// decorative WebGL "period" at end of wordmark; ssr:false keeps three out of footer chunk.
const ContactBlobView = dynamic(
  () =>
    import("@/components/scenes/ContactBlobView").then((m) => ({
      default: m.ContactBlobView,
    })),
  { ssr: false },
);

// magazine-back-cover footer: oversize wordmark + three-col meta block.

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
          {/* the blob lives INSIDE the "polasky" span as an absolutely-
              positioned sibling so it contributes zero width to line layout.
              previously it was an inline-block with width = max(1.5rem,
              0.25em); at the wordmark's large display sizes that ~0.25em
              pushed the wordmark over the container's right edge on wide
              monitors and the blob wrapped to a second line. anchoring it
              at left: 100% of "polasky" plants it just past the y, never
              consumes inline budget, and naturally follows wherever the
              text breaks if the line ever does wrap. */}
          <span
            className="relative inline-block"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            polasky
            <span
              className="absolute"
              style={{
                left: "100%",
                bottom: "0.05em",
                width: "max(1.5rem, 0.25em)",
                height: "max(1.5rem, 0.25em)",
              }}
              aria-hidden
            >
              <ContactBlobView className="absolute inset-0" />
            </span>
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
