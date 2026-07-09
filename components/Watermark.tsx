"use client";

import { useEffect } from "react";

// prints the build signature to the console. window.__whois() is owned by
// lib/rollout.ts (syncRolloutState); this only prints the banner.

const WHO = [82, 121, 97, 110, 32, 80, 111, 108, 97, 115, 107, 121];
const NET = [
  114, 121, 97, 110, 112, 111, 108, 97, 115, 107, 121, 46, 99, 111, 109,
];
const asText = (codes: number[]) =>
  codes.map((c) => String.fromCharCode(c)).join("");

export function Watermark() {
  useEffect(() => {
    try {
      const who = asText(WHO);
      const line = `${who} \u00b7 https://${asText(NET)} \u00b7 original author`;

      console.log(
        `%c ${who} `,
        "background:#08090C;color:#F4F4F5;font:600 13px/1.7 ui-monospace,monospace;padding:6px 12px;border-radius:6px",
      );
      console.log(
        `%c${line}`,
        "color:#8A8F98;font:12px/1.7 ui-monospace,monospace",
      );
    } catch {}
  }, []);

  return null;
}
