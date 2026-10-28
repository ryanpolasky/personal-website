"use client";

import Link from "next/link";
import { useAccent, useAccentCycle } from "@/components/AccentProvider";
import { RESUME_PDF_HREF } from "@/lib/site";
import { UtdWebringButtons } from "@/components/UtdWebringButtons";

export function StudioContact() {
  const cycle = useAccentCycle();
  const accent = useAccent();
  const [r, g, b] = accent.base.match(/[a-f\d]{2}/gi)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (
    <footer id="contact" className="studio-contact" style={{ color: luminance > 0.179 ? "#0e0d0b" : "#fff" }}>
      <div className="section-label"><span>04 / the next thing</span><span>let’s make it a good one.</span></div>
      <a className="contact-invitation" href="mailto:ryanpolasky@hotmail.com" data-cursor="say hi"><span>let’s build</span><span>something<span className="contact-arrow" aria-hidden>↗</span></span></a>
      <div className="contact-bottom"><a href="mailto:ryanpolasky@hotmail.com">ryanpolasky@hotmail.com</a><button onClick={cycle} className="contact-play">a different mood <span aria-hidden>↻</span></button></div>
      <div className="contact-links"><Link href="https://github.com/ryanpolasky" target="_blank" rel="noreferrer">github ↗</Link><Link href="https://www.linkedin.com/in/ryan-polasky/" target="_blank" rel="noreferrer">linkedin ↗</Link><Link href="https://open.spotify.com/user/ryanpolasky" target="_blank" rel="noreferrer">spotify ↗</Link><Link href={RESUME_PDF_HREF} target="_blank" rel="noreferrer">résumé ↗</Link><Link href="/gallery/">the archives ↗</Link></div>
      <div className="contact-colophon"><span>ryan polasky.<br />software &amp; other experiments.</span><UtdWebringButtons /><span>cupertino, california<br />built with a little too much care.</span></div>
    </footer>
  );
}
