"use client";

import { useRef, type ReactNode } from "react";

export function ClubTapTrigger({ children }: { children: ReactNode }) {
  const taps = useRef<number[]>([]);

  return (
    <p
      className="text-[10.5px] uppercase tracking-[0.32em] text-white/75 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)] sm:text-white/55 sm:[text-shadow:none]"
      style={{ fontFamily: "var(--font-mono)" }}
      data-no-cycle
      onClick={() => {
        const now = Date.now();
        taps.current = [...taps.current.filter((time) => now - time < 2000), now];
        if (taps.current.length >= 5) {
          taps.current = [];
          window.dispatchEvent(new CustomEvent("club:open"));
        }
      }}
    >
      {children}
    </p>
  );
}
