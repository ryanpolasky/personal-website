"use client";

import { useEffect } from "react";

// Prints the build signature to the console on load.

declare global {
  interface Window {
    __whois?: () => string;
  }
}

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

      window.__whois = () => {
        const el = document.getElementById("__sig");
        const raw = el?.textContent ?? "";
        let bits = "";
        for (const ch of raw)
          bits += ch === "\u200c" ? "1" : ch === "\u200b" ? "0" : "";
        let out = "";
        for (let i = 0; i + 16 <= bits.length; i += 16)
          out += String.fromCharCode(parseInt(bits.slice(i, i + 16), 2));
        return out || line;
      };
    } catch {}
  }, []);

  return null;
}
