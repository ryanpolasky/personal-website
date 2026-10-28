"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RESUME_PDF_HREF } from "@/lib/site";
import { useLenis } from "@/components/SmoothScrollProvider";

const SECTIONS = ["projects", "about", "experience", "contact"];

export function Nav() {
  const pathname = usePathname();
  const lenis = useLenis();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      setScrolled(window.scrollY > 80);
      const threshold = window.innerHeight * 0.4;
      setActive(SECTIONS.findLast((id) => {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        return rect && rect.top <= threshold && rect.bottom > 0;
      }) ?? "");
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const main = document.getElementById("main");
    const previousInert = main?.inert ?? false;
    const overflow = document.body.style.overflow;
    const menuButton = button.current;
    const wasStopped = lenis?.isStopped;
    if (main) main.inert = true;
    document.body.style.overflow = "hidden";
    lenis?.stop();
    menu.current?.querySelector("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const controls = [button.current, ...Array.from(menu.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])].filter((item): item is HTMLButtonElement | HTMLAnchorElement => item !== null);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const desktop = window.matchMedia("(min-width: 640px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      if (main) main.inert = previousInert;
      document.body.style.overflow = overflow;
      if (!wasStopped) lenis?.start();
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", closeOnDesktop);
      menuButton?.focus({ preventScroll: true });
    };
  }, [open, lenis]);

  if (pathname !== "/") return null;

  return (
    <>
      <nav aria-label="primary" className={`studio-nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="studio-nav-inner">
          <a href="#hero" className="studio-wordmark">ryan polasky<span className="studio-wordmark-dot">.</span></a>
          <div className="studio-nav-links">{SECTIONS.map((id) => <a key={id} href={`#${id}`} className={`studio-nav-link ${id === "contact" ? "studio-nav-contact" : ""}`} aria-current={active === id ? "location" : undefined}>{id === "contact" ? <>let’s talk <span aria-hidden>↗</span></> : id}</a>)}</div>
        </div>
      </nav>
      <div className={`studio-mobile-header ${scrolled || open ? "is-scrolled" : ""}`}>
        <a href="#hero" className="studio-wordmark" onClick={() => setOpen(false)}>ryan polasky<span className="studio-wordmark-dot">.</span></a>
        <button ref={button} type="button" className="studio-menu-button" onClick={() => setOpen((value) => !value)} aria-label={open ? "close menu" : "open menu"} aria-expanded={open} aria-controls="mobile-menu">{open ? "close −" : "menu +"}</button>
      </div>
      <div ref={menu} id="mobile-menu" className={`studio-mobile-menu ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open}>
        <nav aria-label="mobile primary">{SECTIONS.map((id, index) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}><span>0{index + 1}</span>{id}<span aria-hidden>↗</span></a>)}</nav>
        <div className="studio-mobile-links"><a href="mailto:ryanpolasky@hotmail.com">email ↗</a><Link href={RESUME_PDF_HREF} target="_blank" rel="noreferrer">résumé ↗</Link></div>
      </div>
    </>
  );
}
