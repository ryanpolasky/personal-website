"use client";

import { useEffect, useState } from "react";

const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

type RippleComponent = typeof import("./OilFilmRipple").OilFilmRipple;

export function OilFilmRippleUnlock() {
  const [Ripple, setRipple] = useState<RippleComponent | null>(null);

  useEffect(() => {
    let progress = 0;
    let cancelled = false;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      progress =
        key === KONAMI_CODE[progress]
          ? progress + 1
          : key === KONAMI_CODE[0]
            ? 1
            : 0;
      if (progress !== KONAMI_CODE.length) return;

      window.removeEventListener("keydown", onKeyDown);
      void import("./OilFilmRipple").then((module) => {
        if (!cancelled) setRipple(() => module.OilFilmRipple);
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return Ripple ? <Ripple /> : null;
}
