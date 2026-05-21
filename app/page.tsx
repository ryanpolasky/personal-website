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

      {/* 01. HERO */}
      <section
        id="hero"
        className="relative flex min-h-[100svh] items-center px-4 py-6 sm:px-6 sm:py-8"
        aria-label="intro"
      >
        <HeroStage>
          <HeroClusterView className="pointer-events-none absolute inset-0" />
          <div className="stage-edge" aria-hidden />

          <div className="absolute inset-0 z-30 flex flex-col justify-between p-8 sm:p-12 md:p-16">
            <div className="flex items-start justify-between">
              <p
                className="text-[10.5px] uppercase tracking-[0.32em] text-white/55"
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
                className="mb-5 text-[11px] uppercase tracking-[0.32em] text-white/55"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                software engineer · backend + ai / llm tooling
              </p>
              <HeroHeadline />
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65 sm:text-[17px]">
                ut dallas cs grad (may &apos;26). two summers at apple. most
                recently built{" "}
                <em className="not-italic text-white/85">autopsy</em> - forensic
                memory for ai coding agents.
              </p>

              {/* extracted client component so this page stays server-rendered. */}
              <HeroCtas />
            </div>
          </div>

          {/* scroll cue */}
          <div
            className="pointer-events-none absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2"
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

      {/* 04. KALEIDOSCOPE (pb gives breath before the projects morph in) */}
      <div className="pb-16 sm:pb-24">
        <KaleidoscopeSection />
      </div>

      {/* 05. PROJECTS RAIL */}
      <div className="pb-8 sm:pb-12">
        <ProjectsRail />
      </div>

      {/* 06. CONTACT */}
      <FluidParticleBand />

      {/* 07. FOOTER */}
      <Footer />
    </main>
  );
}
