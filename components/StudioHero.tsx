"use client";

import { useEffect, useState } from "react";
import { StudioSculpture } from "@/components/StudioSculpture";
import { OilFilmRippleUnlock } from "@/components/OilFilmRippleUnlock";
import { useAccentCycle } from "@/components/AccentProvider";

export function StudioHero() {
  const cycle = useAccentCycle();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const reveal = () => setReady(true);
    const curtain = document.getElementById("__boot-curtain");
    if (!curtain || curtain.dataset.ready === "true") reveal();
    window.addEventListener("site:ready", reveal, { once: true });
    return () => window.removeEventListener("site:ready", reveal);
  }, []);

  return (
    <section id="hero" className={`atelier-hero ${ready ? "is-ready" : ""}`} aria-labelledby="hero-title">
      <div className="hero-topline"><span>software engineer</span><span>cupertino, california</span></div>
      <div className="atelier-sculpture" aria-hidden>
        <StudioSculpture />
        <OilFilmRippleUnlock />
      </div>
      <div className="atelier-intro">
        <p className="atelier-eyebrow">hey, i’m ryan.</p>
        <h1 id="hero-title" aria-label="i build stuff.">
          <span className="hero-word"><span>i build</span></span>
          <span className="hero-word"><span>stuff<span className="hero-period">.</span></span></span>
        </h1>
        <div className="hero-bottom-copy">
          <p>software engineer on apple’s camera &amp; edits team. backend systems, ai tooling, and things that are fun to use.</p>
          <a href="#projects" className="round-link"><span className="round-link-icon" aria-hidden>↓</span>explore the work</a>
        </div>
      </div>
      <button className="sculpture-control" onClick={cycle} aria-label="Change the sculpture color"><span aria-hidden>↻</span> change the mood</button>
      <div className="hero-baseline"><span>small, useful things. on purpose.</span><span>scroll to explore ↓</span></div>
    </section>
  );
}
