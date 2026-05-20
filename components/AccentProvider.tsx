"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// per-visit random accent. writes CSS vars (--color-accent*) globally and
// exposes the triplet via context for R3F scenes. hero click cycles.

type Accent = {
  name: string;
  base: string; // primary
  warm: string; // brighter, for hover / highlight
  soft: string; // very light tint
};

const ACCENTS: ReadonlyArray<Accent> = [
  /* electric blue - the v8 default */
  { name: "cobalt", base: "#2D2BC8", warm: "#4A48E4", soft: "#C5C4F2" },
  /* hot orange - homage to the v1 site */
  { name: "ember", base: "#FF5A36", warm: "#FF7A56", soft: "#FCD0BE" },
  /* deep magenta */
  { name: "plasma", base: "#D6189E", warm: "#F23BB7", soft: "#F8C5E5" },
  /* electric violet */
  { name: "iris", base: "#7A2DEE", warm: "#9054F6", soft: "#DCC9FA" },
  /* emerald */
  { name: "monstera", base: "#0FA968", warm: "#23C781", soft: "#BBE9D2" },
  /* sun yellow */
  { name: "pollen", base: "#E0A60E", warm: "#F2BD33", soft: "#F4E2A6" },
  /* deep teal */
  { name: "lagoon", base: "#1E7A8E", warm: "#2C9AB0", soft: "#B6D9E1" },
];

type AccentContextValue = Accent;

const AccentContext = createContext<AccentContextValue>(ACCENTS[0]);
const AccentCycleContext = createContext<() => void>(() => {});

export function useAccent(): AccentContextValue {
  return useContext(AccentContext);
}

/** Advance to the next accent in the palette. Used by the hero click toy. */
export function useAccentCycle(): () => void {
  return useContext(AccentCycleContext);
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
  // SSR renders index 0; randomized on client mount (CSS vars only change
  // post-hydration so no mismatch).
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * ACCENTS.length));
  }, []);

  const accent = ACCENTS[index];

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-accent", accent.base);
    root.style.setProperty("--color-accent-warm", accent.warm);
    root.style.setProperty("--color-accent-soft", accent.soft);
    root.setAttribute("data-accent", accent.name);
  }, [accent]);

  const cycle = useCallback(() => {
    setIndex((i) => (i + 1) % ACCENTS.length);
  }, []);

  return (
    <AccentContext.Provider value={accent}>
      <AccentCycleContext.Provider value={cycle}>
        {children}
      </AccentCycleContext.Provider>
    </AccentContext.Provider>
  );
}
