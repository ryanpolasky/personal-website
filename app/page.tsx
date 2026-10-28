import { preload } from "react-dom";
import { Cursor } from "@/components/Cursor";
import { HeroClusterLazy } from "@/components/HeroClusterLazy";
import { HeroCtas } from "@/components/HeroCtas";
import { HeroHeadline } from "@/components/HeroHeadline";
import { HeroStage } from "@/components/HeroStage";
import { StudioReveals } from "@/components/StudioReveals";
import { MarqueeBand } from "@/components/MarqueeBand";
import { AboutSection } from "@/components/AboutSection";
import { ProjectsRail } from "@/components/ProjectsRail";
import { FluidParticleBand } from "@/components/FluidParticleBand";
import { Footer } from "@/components/Footer";
import { OilFilmRippleUnlock } from "@/components/OilFilmRippleUnlock";
import { HDRI_STUDIO_HREF } from "@/lib/site";

export default function HomePage() {
  // the hero can't render until the env map lands, so start that fetch with
  // the html instead of after js parse -> hydrate -> canvas mount -> suspend.
  // as=fetch + anonymous matches three's FileLoader (cors, same-origin creds)
  // so the browser can actually reuse the preloaded response.
  preload(HDRI_STUDIO_HREF, { as: "fetch", crossOrigin: "anonymous" });

  return (
    <main id="main" className="relative">
      <Cursor />
      <StudioReveals />

      <section
        id="hero"
        className="hero-frame"
        aria-label="intro"
      >
        <HeroStage>
          <HeroClusterLazy className="pointer-events-none absolute inset-0" />
          <OilFilmRippleUnlock />
          <div className="stage-edge" aria-hidden />

          {/* mobile-only legibility tint: dark gradient weighted to the bottom
              where the headline + body + ctas live. desktop has more breathing
              room so the R's can speak for themselves. */}
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.05)_60%,rgba(0,0,0,0.18)_100%)] sm:hidden"
            aria-hidden
          />

          <div className="hero-content absolute inset-0 z-30 flex flex-col justify-between">
            <div className="hero-meta" data-hero-enter>
              <p className="hero-index">
                00 - ryan polasky
              </p>
              <p className="hero-location">
                cupertino, california · pdt
              </p>
            </div>

            <div>
              <p className="hero-kicker" data-hero-enter>
                software engineer · backend + ai / llm tooling
              </p>
              <HeroHeadline />
              <p className="hero-description" data-hero-enter>
                ut dallas cs grad, now a software engineer on apple&apos;s
                camera & edits team. most recently built{" "}
                <em className="not-italic text-white">marralhinha</em> - a
                traditional marble game, rebuilt for the browser.
              </p>

              <HeroCtas />
            </div>
          </div>

          <div
            className="hero-scroll-cue"
            data-hero-enter
            aria-hidden
          >
            <span>scroll to explore</span>
            <span className="hero-scroll-arrow">↓</span>
          </div>
        </HeroStage>
      </section>

      {/* 02. MARQUEE */}
      <MarqueeBand />

      {/* 03. ABOUT + EXPERIENCE */}
      <AboutSection />

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
