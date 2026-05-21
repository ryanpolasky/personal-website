"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useSectionTravel } from "@/lib/scroll";

// dynamic-import keeps three.js + drei out of the initial chunk; the
// decorative ribbon streams in after hydration.
const RibbonView3D = dynamic(
  () =>
    import("@/components/scenes/RibbonView3D").then((m) => ({
      default: m.RibbonView3D,
    })),
  { ssr: false },
);

// css-only ribbon for touch devices. svg path with an accent gradient stroke
// that draws in as the section scrolls (stroke-dashoffset on pathLength=100)
// and drifts + scales for parallax. mirrors the 3D ribbon's grow-from-top
// behavior without the webgl cost. crucially: an internal raf loop reads a
// live progress ref and writes the path's style attrs directly, bypassing
// react reconciliation per frame so updates track scroll 1:1 without the lag
// a css transition would introduce.
function RibbonFallback({
  className,
  progress,
}: {
  className?: string;
  progress: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const progressRef = useRef(progress);
  // keep the ref synced every render; raf reads from it without rerendering.
  progressRef.current = progress;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = Math.max(0, Math.min(1, progressRef.current));
      const path = pathRef.current;
      if (path) {
        const drawn = 12 + p * 88; // 12 -> 100 over scroll
        const offset = 100 - drawn;
        const driftY = -p * 14; // % shift up as you scroll past
        const scale = 0.95 + p * 0.1; // slight grow-into-view
        path.style.strokeDashoffset = `${offset}`;
        path.style.transform = `translate3d(0, ${driftY}%, 0) scale(${scale})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ssr / first paint values (matches what raf will write on its first tick).
  const initialP = Math.max(0, Math.min(1, progress));
  const initialOffset = 100 - (12 + initialP * 88);

  return (
    <div
      className={className}
      style={{
        background:
          "radial-gradient(60% 80% at 80% 10%, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 65%), radial-gradient(50% 70% at 15% 90%, color-mix(in oklab, var(--color-accent-warm) 18%, transparent), transparent 60%)",
      }}
    >
      <svg
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        // svg roots clip at viewBox by default; allow the path to render
        // past the left edge so it can fully start off-screen.
        style={{ overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <linearGradient id="ribbon-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-soft)" />
            <stop offset="55%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-accent-warm)" />
          </linearGradient>
        </defs>
        <path
          ref={pathRef}
          // start at x=-45 (45% of viewport width off the left edge) so the
          // first ~20% of the stroke draws entirely off-screen; the visible
          // entry into the viewport happens as scroll progress passes that
          // threshold, giving the ribbon a strong "sweeping in" reveal.
          d="M -45 12 C -10 22, 25 2, 55 32 S 100 80, 70 110 S 30 165, 110 195"
          stroke="url(#ribbon-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={initialOffset}
          style={{
            filter:
              "drop-shadow(0 0 18px color-mix(in oklab, var(--color-accent) 35%, transparent))",
            transformOrigin: "50% 50%",
            willChange: "stroke-dashoffset, transform",
          }}
        />
      </svg>
    </div>
  );
}

// about + experience share a sticky 3D ribbon backdrop. progress is fed
// externally because the sticky container's own bounding rect is fixed at
// viewport top during pin, stalling internal measurement.

interface Role {
  company: string;
  title: string;
  type: string;
  location: string;
  when: string;
  body: string;
  metric: { value: string; label: string };
}

const ROLES: Role[] = [
  {
    company: "Apple",
    title: "At-Home Advisor",
    type: "customer engineering",
    location: "remote",
    when: "may 2023 → present",
    body: "worked remotely alongside school, sustaining a 6.87% escalation rate well below department average through independent research and advanced troubleshooting. 0.27 min average call wrap time, 15% above department-average csat, and 2× applecare excellence award recipient (2024, 2025).",
    metric: { value: "+15%", label: "csat vs dept avg" },
  },
  {
    company: "ACM UTD",
    title: "Development Lead · Education Mentor",
    type: "student leadership",
    location: "dallas",
    when: "may 2025 → may 2026",
    body: "served as development lead within acm at ut dallas. mentored 1,200+ hackutd participants and debugged critical issues for 60+ teams. led meteormate, a react, fastapi, and postgres roommate-matching platform. also mentored four underclassmen through internship preparation.",
    metric: { value: "1,200+", label: "hackers mentored" },
  },
  {
    company: "Apple",
    title: "Camera API Test Automation",
    type: "intern",
    location: "cupertino",
    when: "may–aug 2025",
    body: "built automated parsing for thousands of on-device camera and photos tests, integrated llms into the failure-triage pipeline, and shipped a unified bug-report generator that attached relevant failure artifacts.",
    metric: { value: "4,800%", label: "manual triage reduction" },
  },
  {
    company: "Apple",
    title: "WTE Tools Engineer",
    type: "intern",
    location: "cupertino",
    when: "jun–nov 2024",
    body: "built an llm-powered chat interface and python package for translating natural language into sql and nosql queries. migrated internal services from java 11 to jdk 21, addressed security vulnerabilities, designed aws/gcp ci/cd pipelines, and optimized an ios log analyzer for real-time rendering.",
    metric: { value: "nl → sql", label: "schema-aware planner" },
  },
  {
    company: "Altru Health System",
    title: "IT Intern",
    type: "intern",
    location: "grand forks",
    when: "jun 2021 → jul 2022",
    body: "repaired, imaged, and deployed hundreds of machines for a critical healthcare-system expansion. handled urgent hardware deliveries during peak demand and set the department intake record at 300+ devices.",
    metric: { value: "300+", label: "intake record" },
  },
];

// skill categories, mirrors the original.html skill matrix.
const SKILL_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "languages",
    items: [
      "Python",
      "TypeScript",
      "HTML/CSS",
      "Swift",
      "JavaScript",
      "Java",
      "C++",
      "SwiftUI",
      "R",
      "Obj-C",
    ],
  },
  {
    label: "data",
    items: [
      "PostgreSQL",
      "OpenSearch",
      "Redis",
      "MySQL",
      "SQLite",
      "Vector DBs",
      "MongoDB",
    ],
  },
  {
    label: "ai / llms",
    items: [
      "LLM Integration",
      "RAG Systems",
      "Vertex AI",
      "Fine-tuning",
      "Function Calling",
      "Embeddings",
    ],
  },
  {
    label: "devops",
    items: [
      "Kubernetes",
      "CI/CD",
      "AWS/GCP",
      "Docker",
      "Helm",
      "Terraform",
      "Jenkins",
    ],
  },
];

export function AboutSection() {
  const { ref, progress } = useSectionTravel<HTMLElement>();
  // touch devices get the static svg ribbon instead of the r3f one; both
  // share the same sticky backdrop slot so layout doesn't shift.
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  return (
    <section
      ref={ref}
      id="about"
      className="relative px-4 sm:px-6"
      aria-label="about"
    >
      {/* sticky ribbon backdrop. negative mb cancels the sticky's height
          so siblings stack on top. overflow-hidden is on the sticky child
          (not the section), or sticky degrades to relative per css spec. */}
      <div className="pointer-events-none sticky top-0 -mx-4 -mb-[100svh] h-[100svh] overflow-hidden sm:-mx-6">
        <div className="absolute inset-0 -my-16 sm:-my-32">
          {coarse ? (
            <RibbonFallback
              progress={progress}
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <RibbonView3D
              progress={progress}
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
      </div>

      {/* ───── primary about block ───── */}
      <div className="relative z-10 mx-auto max-w-7xl pt-28 sm:pt-40 md:pt-48">
        {/* frosted-glass panel keeps the index + headline + body legible on top
            of the colorful ribbon backdrop (esp. on mobile where the ribbon is
            denser per-px). matches the experience card treatment below for
            consistency. */}
        <div className="relative isolate overflow-hidden rounded-[1.75rem] border border-[rgba(14,13,11,0.08)] bg-[rgba(248,247,243,0.62)] px-5 py-8 shadow-[0_18px_60px_-30px_rgba(14,13,11,0.28),inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-[14px] backdrop-saturate-[1.15] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.55),rgba(255,255,255,0.05)_55%,rgba(255,255,255,0.22))] sm:px-8 sm:py-10 md:px-10 md:py-12">
          <p
            className="section-index"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            01 - about
          </p>

          <h2 className="display mt-6 w-full text-[clamp(3rem,11.5vw,16rem)] leading-[0.85] tracking-tight text-[var(--color-text)]">
            small,
            <br />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
              }}
              className="text-[var(--color-accent)] pr-[0.1em]"
            >
              useful
            </span>{" "}
            things,
            <br />
            on purpose.
          </h2>

          <div className="mt-12 grid max-w-5xl gap-10 sm:mt-20 sm:grid-cols-2">
            <p className="text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
              i&apos;m a computer science graduate from ut dallas (&apos;26). i
              spent my last two summers as a software engineering intern at
              apple, building out ai tooling for the wireless tech (WTE) & the
              camera & photos organizations.
            </p>
            <p className="text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
              i enjoy backend, devops, and making llms actually do what you
              want them to do. i also have a bad habit of rebuilding this
              website. this is version eleven, but the older ones{" "}
              <Link
                href="/gallery"
                className="text-[var(--color-text-muted)] underline decoration-[var(--color-line-strong)] underline-offset-4 transition-colors hover:text-[var(--color-text)] hover:decoration-[var(--color-text-faint)]"
                data-hoverable
              >
                are still around
              </Link>{" "}
              if you want to see them.
            </p>
          </div>
        </div>

        {/* skill matrix - grouped chips by category. */}
        <div className="mt-10 grid max-w-5xl gap-x-10 gap-y-7 sm:mt-14 sm:grid-cols-2 md:gap-x-14">
          {SKILL_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className="section-index"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {group.label}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {group.items.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* experience timeline - shares the sticky ribbon backdrop. */}
      <div
        id="experience"
        className="relative z-10 mx-auto max-w-7xl pt-32 pb-28 sm:pt-48 sm:pb-40"
      >
        <p className="section-index" style={{ fontFamily: "var(--font-mono)" }}>
          02 - experience
        </p>

        <h3 className="display mt-6 max-w-[14ch] text-[clamp(2.4rem,7vw,6rem)] leading-[0.9] tracking-tight text-[var(--color-text)]">
          places i&apos;ve{" "}
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
            }}
            className="text-[var(--color-accent)] pr-[0.1em]"
          >
            been
          </span>
          .
        </h3>

        <div className="mt-16 sm:mt-24">
          {ROLES.map((role, i) => (
            <article
              key={`${role.company}-${role.title}`}
              className="relative isolate grid items-start gap-8 overflow-hidden rounded-[1.75rem] border border-[rgba(14,13,11,0.08)] bg-[rgba(248,247,243,0.62)] px-5 py-8 shadow-[0_18px_60px_-30px_rgba(14,13,11,0.28),inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-[14px] backdrop-saturate-[1.15] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.55),rgba(255,255,255,0.05)_55%,rgba(255,255,255,0.22))] sm:grid-cols-[1fr_220px] sm:gap-12 sm:px-8 sm:py-10 md:px-10 md:py-12 [&+article]:mt-4 sm:[&+article]:mt-5"
            >
              <div>
                <p
                  className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--color-text-faint)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  0{i + 1}.
                </p>
                <h4 className="display mt-3 text-[clamp(1.8rem,4vw,3.4rem)] leading-[0.95] tracking-tight text-[var(--color-text)]">
                  {role.company}{" "}
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontStyle: "italic",
                      fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
                    }}
                    className="text-[var(--color-accent)]"
                  >
                    {role.title.toLowerCase()}
                  </span>
                </h4>
                <p
                  className="mt-3 text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {role.type} · {role.location} · {role.when}
                </p>
                <p className="mt-6 max-w-[60ch] text-[15px] leading-relaxed text-[var(--color-text-muted)] sm:text-base">
                  {role.body}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="display text-[clamp(2.2rem,4.5vw,3.6rem)] leading-none tracking-tight text-[var(--color-accent)]">
                  {role.metric.value}
                </p>
                <p
                  className="mt-2 text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-text-faint)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {role.metric.label}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
