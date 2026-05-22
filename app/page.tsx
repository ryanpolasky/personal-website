import { Cursor } from "@/components/Cursor";
import { HeroClusterView } from "@/components/scenes/HeroClusterView";
import { HeroCtas } from "@/components/HeroCtas";
import { HeroHeadline } from "@/components/HeroHeadline";
import { HeroStage } from "@/components/HeroStage";
import { MarqueeBand } from "@/components/MarqueeBand";
import { AboutSection } from "@/components/AboutSection";
import { KaleidoscopeSection } from "@/components/KaleidoscopeSection";
import { ProjectsRail } from "@/components/ProjectsRail";
import { FluidParticleBand } from "@/components/FluidParticleBand";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <main id="main" className="relative">
      <Cursor />

      {/* 01. HERO - exactly 100svh tall with padded frame on all sides.
          stage uses h-full so it fits the inner box (svh minus padding). */}
      <section
        id="hero"
        className="relative flex h-[100dvh] items-stretch pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:min-h-[100svh] sm:items-center sm:px-6 sm:py-8"
        aria-label="intro"
      >
        <HeroStage>
          <HeroClusterView className="pointer-events-none absolute inset-0" />
          <div className="stage-edge" aria-hidden />

          {/* mobile-only legibility tint: dark gradient weighted to the bottom
              where the headline + body + ctas live. desktop has more breathing
              room so the R's can speak for themselves. */}
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.05)_60%,rgba(0,0,0,0.18)_100%)] sm:hidden"
            aria-hidden
          />

          <div className="absolute inset-0 z-30 flex flex-col justify-between p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-12 md:p-16">
            <div className="flex items-start justify-between">
              <p
                className="text-[10.5px] uppercase tracking-[0.32em] text-white/75 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)] sm:text-white/55 sm:[text-shadow:none]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                00 - ryan polasky
              </p>
              <p
                className="hidden text-[10.5px] uppercase tracking-[0.32em] text-white/55 sm:block"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                north dakota · cdt
              </p>
            </div>

            <div>
              <p
                className="mb-5 text-[11px] uppercase tracking-[0.32em] text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)] sm:text-white/55 sm:[text-shadow:none]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                software engineer · backend + ai / llm tooling
              </p>
              <HeroHeadline />
              <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.5)] sm:mt-5 sm:text-[17px] sm:text-white/65 sm:[text-shadow:none]">
                ut dallas cs grad (may &apos;26). two summers at apple. most
                recently built{" "}
                <em className="not-italic text-white">autopsy</em> - forensic
                memory for ai coding agents.
              </p>

              {/* extracted client component so this page stays server-rendered. */}
              <HeroCtas />
            </div>
          </div>

          {/* scroll cue - desktop only; mobile users already know to scroll
              and the cue clutters the tight viewport. */}
          <div
            className="pointer-events-none absolute bottom-5 left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
            aria-hidden
          >
            <span
              className="text-[9.5px] uppercase tracking-[0.4em] text-white/45"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              scroll
            </span>
            <span className="h-7 w-px bg-gradient-to-b from-white/0 via-white/45 to-white/0" />
          </div>
        </HeroStage>
      </section>

      {/* 02. MARQUEE */}
      <MarqueeBand />

      {/* 03. ABOUT + EXPERIENCE */}
      <AboutSection />

      {/* 04. KALEIDOSCOPE - returns null on touch; breathing pb lives inside. */}
      <KaleidoscopeSection />

      {/* 05. PROJECTS RAIL */}
      <div className="xl:pb-12">
        <ProjectsRail />
      </div>

      {/* 06. CONTACT */}
      <FluidParticleBand />

      {/* 07. FOOTER */}
      <Footer />
    </main>
  );
}
