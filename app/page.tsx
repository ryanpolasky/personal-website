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

// v9 landing.
//
//   01. hero          tumbling cluster, dark inset stage, headline left/center
//   02. marquee       full-bleed running text band, brand tokens
//   03. about + experience   3d ribbon (sticky backdrop) behind huge type +
//                            stack chips, then the experience timeline scrolls
//                            over the same ribbon - one continuous tall section.
//   04. kaleidoscope  mood breath, morphs to fullscreen, floating section words
//   05. projects      pinned stage, vertical scroll drives horizontal pan
//   06. contact       fluid particle band IS the contact section - accent-color
//                     finale with section index + headline + CTA + link row
//                     layered above an interactive particle sim.
//   07. footer        magazine-back-cover footer with tucked contact blob demo.

export default function HomePage() {
  return (
    <main id="main" className="relative">
      <Cursor />

      {/* ============================================================== */}
      {/* 01. HERO                                                        */}
      {/* ============================================================== */}
      <section
        id="hero"
        data-snap
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

              {/* hero CTAs extracted into a client component (HeroCtas)
                  so this page can stay a server component. both buttons
                  intercept the native anchor jump and dispatch the
                  'nav:wash' custom event that Nav listens for, so the
                  curtain-wash teleport runs identically to nav clicks. */}
              <HeroCtas />
            </div>
          </div>

          {/* scroll cue - a thin animated indicator pinned bottom-center. */}
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

      {/* ============================================================== */}
      {/* 02. MARQUEE BAND                                                */}
      {/* ============================================================== */}
      <MarqueeBand />

      {/* ============================================================== */}
      {/* 03. ABOUT + EXPERIENCE                                          */}
      {/* one tall section with a sticky 3d ribbon backdrop. the ribbon  */}
      {/* pins to viewport-top and keeps weaving as the user scrolls     */}
      {/* through both blocks. see components/AboutSection.tsx.          */}
      {/* ============================================================== */}
      <AboutSection />

      {/* ============================================================== */}
      {/* 04. KALEIDOSCOPE                                                */}
      {/* ============================================================== */}
      {/* pb on the wrapper gives a cream breath between kaleido's exit
          (where it morphs back to picture-frame card) and the projects
          rail's entry morph. without it, the two pinned sections butt
          straight against each other and the visual contract feels rushed. */}
      <div className="pb-16 sm:pb-24">
        <KaleidoscopeSection />
      </div>

      {/* ============================================================== */}
      {/* 05. PROJECTS RAIL                                               */}
      {/* ============================================================== */}
      <div className="pb-8 sm:pb-12">
        <ProjectsRail />
      </div>

      {/* ============================================================== */}
      {/* 06. CONTACT  (fluid particle band IS the contact finale)        */}
      {/* ============================================================== */}
      <FluidParticleBand />

      {/* ============================================================== */}
      {/* 07. FOOTER                                                      */}
      {/* ============================================================== */}
      <Footer />
    </main>
  );
}
