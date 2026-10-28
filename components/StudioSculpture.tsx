"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { preload } from "react-dom";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { useAccent } from "@/components/AccentProvider";
import { HDRI_STUDIO_HREF } from "@/lib/site";

const View = dynamic(() => import("./scenes/HeroSculptureView").then((module) => module.HeroSculptureView), { ssr: false });

class SculptureBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const hue: Record<string, number> = { cobalt: 0, ember: 130, plasma: 80, iris: 23, monstera: -85, pollen: 160, lagoon: -50 };

export function StudioSculpture() {
  const accent = useAccent();
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const showLive = useCallback(() => setReady(true), []);
  const showPoster = useCallback(() => { setFailed(true); setReady(false); }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const sync = () => {
      const eligible = !media.matches && !connection?.saveData;
      if (eligible) preload(HDRI_STUDIO_HREF, { as: "fetch", crossOrigin: "anonymous" });
      setEnabled(eligible);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return (
    <div className={`studio-sculpture ${ready && enabled && !failed ? "is-live" : ""}`}>
      <Image src="/assets/hero-sculpture.webp" alt="" fill sizes="(max-width: 639px) 100vw, 55vw" priority className="sculpture-poster" style={{ filter: `hue-rotate(${hue[accent.name] ?? 0}deg)` }} />
      {enabled && !failed ? <SculptureBoundary onError={showPoster}><View onReady={showLive} onError={showPoster} /></SculptureBoundary> : null}
    </div>
  );
}
