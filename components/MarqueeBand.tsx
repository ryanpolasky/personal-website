// horizontal marquee band. pure css keyframe loop: steady speed, no scroll
// coupling. it just exists, drifting left at a fixed cadence, regardless of
// what the user is doing with the page.

import type { CSSProperties } from "react";

const TOKENS = [
  "BACKEND",
  "AI / LLM TOOLING",
  "DEVELOPER PRODUCTIVITY",
  "PYTHON",
  "TYPESCRIPT",
  "REACT",
  "SQL / NOSQL",
  "DOCKER",
  "KUBERNETES",
];

const SEPARATOR = "·";

export function MarqueeBand() {
  // duplicate the row so the css keyframe can translate -50% and tile.
  const row = TOKENS.flatMap((t, i) => [
    <span
      key={`t-${i}`}
      className="display whitespace-nowrap px-[0.42em] text-[var(--color-text)]"
      style={{
        fontStyle: i % 3 === 0 ? "italic" : "normal",
        fontVariationSettings:
          i % 3 === 0
            ? '"opsz" 144, "SOFT" 80, "WONK" 1'
            : '"opsz" 144, "SOFT" 30',
        fontWeight: i % 3 === 0 ? 400 : 600,
      }}
    >
      {t}
    </span>,
    <span
      key={`s-${i}`}
      aria-hidden
      className="px-[0.4em] text-[var(--color-accent)] opacity-80"
    >
      {SEPARATOR}
    </span>,
  ]);

  const style: CSSProperties = { animationDuration: "46s" };

  return (
    <section
      aria-label="skills"
      className="rule-top rule-bottom relative overflow-hidden bg-[var(--color-bg)] py-6 sm:py-8"
      data-marquee-dir="forward"
    >
      <div
        className="marquee-track text-[clamp(2.6rem,8.5vw,7.5rem)] leading-none tracking-[-0.045em]"
        style={style}
      >
        <div className="flex shrink-0 items-center pr-[0.4em]">{row}</div>
        <div className="flex shrink-0 items-center pr-[0.4em]" aria-hidden>
          {row}
        </div>
      </div>
    </section>
  );
}
