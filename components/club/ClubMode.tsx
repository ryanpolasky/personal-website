"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { useLenis } from "@/components/SmoothScrollProvider";
import { PROJECTS } from "@/lib/projects";
import { createRShape } from "@/lib/rShape";
import { RESUME_PDF_HREF } from "@/lib/site";
import { ClubWindow, type ClubSection } from "./ClubWindow";
import { ShardField } from "./ShardField";
import { playClubSfx, setSfxEnabled } from "./sfx";
import styles from "./club.module.css";

type Theme = { bg: string; bg2: string };

const MINT: Theme = { bg: "#a1c8bc", bg2: "#8fbcae" };
const THEMES: Record<ClubSection, Theme> = {
  about: { bg: "#0FA968", bg2: "#0d985e" },
  work: { bg: "#2D2BC8", bg2: "#2826b4" },
  projects: { bg: "#FF5A36", bg2: "#e65131" },
  contact: { bg: "#7A2DEE", bg2: "#6e29d6" },
};
const NAV_ITEMS: { id: ClubSection; label: string; line: string }[] = [
  { id: "about", label: "about", line: "cs @ ut dallas '26 // apple camera & edits" },
  { id: "work", label: "work", line: "06 roles // 2021 → now" },
  {
    id: "projects",
    label: "projects",
    line: `${PROJECTS.filter((project) => project.enabled).length} builds // click one`,
  },
  { id: "contact", label: "contact", line: "ryanpolasky@hotmail.com" },
];
const MUSIC = [
  { title: "kintsugi", src: "/assets/music/audio/kintsugi.mp3" },
  { title: "ride on time - lofi", src: "/assets/music/audio/rideontime.mp3" },
  { title: "dropped", src: "/assets/music/audio/dropped.mp3" },
  { title: "gazing", src: "/assets/music/audio/gazing.mp3" },
  { title: "ripple", src: "/assets/music/audio/ripple.mp3" },
  { title: "mistral hues - demo", src: "/assets/music/audio/mistralhues.mp3" },
];
const UPDATES = [
  {
    title: "Now at Apple",
    detail: "camera & edits team, cupertino",
    href: undefined,
  },
  {
    title: "Marralhinha is live",
    detail: "my family's marble game, rebuilt for the browser",
    href: "https://marralhinha.app",
  },
  {
    title: "Autopsy took 3rd",
    detail: "cognition company challenge",
    href: "https://autopsy.surf",
  },
  {
    title: "rycord",
    detail: "cache-first 3d record room",
    href: "https://rycord.dev",
  },
];

function shapePath() {
  const shape = createRShape();
  const contours = [shape.getPoints(48), shape.holes[0].getPoints(48)];
  return contours
    .map((points) =>
      points
        .map(
          (point, index) =>
            `${index ? "L" : "M"}${point.x.toFixed(4)} ${point.y.toFixed(4)}`,
        )
        .join(" ") + " Z",
    )
    .join(" ");
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" />
      <ellipse cx="10" cy="10" rx="3" ry="7.2" />
      <path d="M3 10h14M4.5 6h11M4.5 14h11" />
    </svg>
  );
}

function SocialIcon({ label }: { label: string }) {
  if (label === "linkedin") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 7.5v8M4 4.5v.1M8 15.5v-8h3v1.3c.6-1 3.8-2 4 1.5v5.2M8 11c0-2.2 1.2-3.5 3-3.5" />
      </svg>
    );
  }
  if (label === "spotify") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.4" />
        <path d="M5.7 7.5c3.3-1 6.4-.5 8.7.8M6.4 10c2.6-.7 5.2-.3 7.1.8M7 12.5c1.9-.5 3.8-.2 5.4.7" />
      </svg>
    );
  }
  if (label === "gallery") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="1" />
        <circle cx="7" cy="7" r="1.2" />
        <path d="m4 15 4.5-4.5 2.6 2 2.4-3 3.5 4.5" />
      </svg>
    );
  }
  if (label === "résumé") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 2.8h7l3 3v11.4H5zM12 2.8v3h3M7.5 9h5M7.5 12h5M7.5 15h3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 16c1-3 2.5-4.8 5-4.8 1.8 0 2.4 1.2 3.8 1.2 1.3 0 2.4-1 2.4-2.5 0-1.3-.9-2.2-2.2-2.2-.5-2.2-2.2-3.8-4.5-3.8-2.5 0-4.3 1.9-4.3 4.4C3 8.7 2 9.7 2 11c0 1.2.9 2.2 2.1 2.2" />
      <circle cx="8" cy="9" r=".7" />
      <circle cx="12" cy="9" r=".7" />
    </svg>
  );
}

function ClubBadge() {
  return (
    <div className={styles.badge}>
      <svg className={styles.badgeMark} viewBox="0 0 170 70" aria-label="RY Club">
        <ellipse cx="85" cy="35" rx="82" ry="32" />
        <ellipse cx="85" cy="35" rx="66" ry="22" />
        <text x="85" y="33" textAnchor="middle" className={styles.badgeRy}>
          RY
        </text>
        <text x="85" y="52" textAnchor="middle" className={styles.badgeClub}>
          CLUB
        </text>
      </svg>
      <div className={styles.welcome}>
        <span>welcome, <strong>visitor</strong></span>
        <span className={styles.globe}><GlobeIcon /></span>
      </div>
    </div>
  );
}

function UpdatesPanel({
  open,
}: {
  open: boolean;
}) {
  return (
    <section className={styles.updates} data-open={open}>
      <div className={styles.updatesLabel}>updates ◍</div>
      <ul>
        {UPDATES.map((item) => (
          <li key={item.title}>
            {item.href ? (
              <a href={item.href} target="_blank" rel="noreferrer">
                <h2>{item.title}</h2>
                <p>{item.detail}</p>
              </a>
            ) : (
              <div>
                <h2>{item.title}</h2>
                <p>{item.detail}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.scrollTrack}><span /></div>
    </section>
  );
}

export function ClubMode({ onExit }: { onExit: () => void }) {
  const lenis = useLenis();
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const timerStartedAt = useRef<number | null>(null);
  const bootSkipped = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedMusic = useRef(false);
  const queueRef = useRef<typeof MUSIC>([]);
  const [bootStep, setBootStep] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hovered, setHovered] = useState<ClubSection | null>(null);
  const [windowSection, setWindowSection] = useState<ClubSection | null>(null);
  const [windowOffset, setWindowOffset] = useState({ x: 0, y: 0 });
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [typing, setTyping] = useState("");
  const [musicOn, setMusicOn] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [sfxOn, setSfxOn] = useState(true);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const targetTheme = windowSection
    ? THEMES[windowSection]
    : hovered
      ? THEMES[hovered]
      : MINT;
  const currentTrack = queueRef.current[trackIndex];
  const rPath = useMemo(shapePath, []);

  const finishExit = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setMusicOn(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    playClubSfx("close");
  }, [closing]);

  useEffect(() => {
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    lenis?.stop();
    html.style.overflow = "hidden";
    document.body.classList.add("club-open");
    return () => {
      html.style.overflow = previousOverflow;
      document.body.classList.remove("club-open");
      lenis?.start();
    };
  }, [lenis]);

  useEffect(() => {
    const href =
      "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=BIZ+UDMincho:wght@400;700&display=swap";
    let link = document.querySelector<HTMLLinkElement>('link[data-ry-club-fonts]');
    const created = !link;
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.ryClubFonts = "true";
      document.head.appendChild(link);
    }
    let cancelled = false;
    const fontLink = link;
    const stylesheetReady = fontLink.sheet
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          fontLink.addEventListener("load", () => resolve(), { once: true });
          fontLink.addEventListener("error", () => resolve(), { once: true });
        });
    const loaded = stylesheetReady
      .then(() =>
        Promise.all([
          document.fonts.load('900 16px "Archivo"'),
          document.fonts.load('400 16px "BIZ UDMincho"'),
        ]),
      )
      .then(() => undefined)
      .catch(() => undefined);
    let timeoutId = 0;
    const timeout = new Promise<void>((resolve) => {
      timeoutId = window.setTimeout(resolve, 1500);
    });
    void Promise.race([loaded, timeout]).then(() => {
      window.clearTimeout(timeoutId);
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
      if (created) link?.remove();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setBootStep(5);
      return;
    }
    const setStep = (step: number) => {
      if (!bootSkipped.current) setBootStep(step);
    };
    const timers = [
      window.setTimeout(() => setStep(1), 300),
      window.setTimeout(() => {
        if (bootSkipped.current) return;
        setStep(2);
        playClubSfx("shatter");
      }, 1500),
      window.setTimeout(() => setStep(3), 2200),
      window.setTimeout(() => setStep(4), 2400),
      window.setTimeout(() => setStep(5), 3200),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [reducedMotion]);

  useEffect(() => {
    const skipBoot = () => {
      if (bootStep < 5) {
        bootSkipped.current = true;
        setBootStep(5);
      }
    };
    const onClick = () => skipBoot();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (windowSection) {
          setWindowSection(null);
          setWindowOffset({ x: 0, y: 0 });
          setHovered(null);
          playClubSfx("close");
        } else {
          finishExit();
        }
        return;
      }
      skipBoot();
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [bootStep, finishExit, windowSection]);

  useEffect(() => {
    if (!fontsReady || bootStep < 4) return;
    if (timerStartedAt.current === null) {
      timerStartedAt.current = performance.now();
    }
    const started = timerStartedAt.current;
    const timer = window.setInterval(() => {
      if (timerRef.current) {
        timerRef.current.textContent = (
          (performance.now() - started) /
          1000
        ).toFixed(2);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [bootStep, fontsReady]);

  useEffect(() => {
    const item = NAV_ITEMS.find((nav) => nav.id === hovered);
    if (!item || windowSection) {
      setTyping("");
      return;
    }
    setTyping("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyping(item.line.slice(0, index));
      playClubSfx("typing");
      if (index >= item.line.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [hovered, windowSection]);

  useEffect(() => {
    setSfxEnabled(sfxOn);
  }, [sfxOn]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = 0;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicOn || !currentTrack) return;
    audio.src = currentTrack.src;
    audio.currentTime = 0;
    audio.volume = 0;
    const onEnded = () => {
      if (trackIndex + 1 >= queueRef.current.length) {
        queueRef.current = [...MUSIC].sort(() => Math.random() - 0.5);
        setTrackIndex(0);
      } else {
        setTrackIndex((index) => index + 1);
      }
    };
    audio.addEventListener("ended", onEnded);
    let fade = 0;
    let active = true;
    void audio.play().then(() => {
      if (!active || !musicOn) {
        audio.pause();
        return;
      }
      hasPlayedMusic.current = true;
      const started = performance.now();
      fade = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - started) / 400);
        audio.volume = 0.35 * progress;
        if (progress >= 1) window.clearInterval(fade);
      }, 20);
    }).catch(() => undefined);
    return () => {
      active = false;
      audio.removeEventListener("ended", onEnded);
      if (fade) window.clearInterval(fade);
    };
  }, [currentTrack, musicOn, trackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (musicOn || !audio || !hasPlayedMusic.current) return;
    const started = performance.now();
    const initialVolume = audio.volume;
    const fade = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / 400);
      audio.volume = initialVolume * (1 - progress);
      if (progress >= 1) {
        window.clearInterval(fade);
        audio.pause();
        audio.currentTime = 0;
        hasPlayedMusic.current = false;
      }
    }, 20);
    return () => window.clearInterval(fade);
  }, [musicOn]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onExit, 600);
    return () => window.clearTimeout(timer);
  }, [closing, onExit]);

  const onNavEnter = (section: ClubSection) => {
    if (windowSection) return;
    setHovered(section);
    playClubSfx("hover");
  };
  const openWindow = (section: ClubSection) => {
    setHovered(section);
    setWindowSection(section);
    setWindowOffset({ x: 0, y: 0 });
    playClubSfx("open");
  };
  const closeWindow = () => {
    setWindowSection(null);
    setWindowOffset({ x: 0, y: 0 });
    setHovered(null);
    playClubSfx("close");
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 768 || event.button !== 0) return;
    event.preventDefault();
    const element = event.currentTarget.parentElement;
    if (!element) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = windowOffset;
    const maxX = Math.max(0, (window.innerWidth - element.offsetWidth) / 2 - 8);
    const maxY = Math.max(0, (window.innerHeight - element.offsetHeight) / 2 - 8);
    const move = (pointer: globalThis.PointerEvent) => {
      setWindowOffset({
        x: Math.max(-maxX, Math.min(maxX, origin.x + pointer.clientX - startX)),
        y: Math.max(-maxY, Math.min(maxY, origin.y + pointer.clientY - startY)),
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };
  const toggleMusic = () => {
    if (!musicOn) {
      if (!queueRef.current.length) {
        queueRef.current = [...MUSIC].sort(() => Math.random() - 0.5);
        setTrackIndex(0);
      }
      playClubSfx("click");
      setMusicOn(true);
      return;
    }
    playClubSfx("click");
    setMusicOn(false);
  };
  const themeStyle = {
    "--club-bg": targetTheme.bg,
    "--club-bg2": targetTheme.bg2,
    "--club-cursor": `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34"><path d="M3 2v25l6-6 5 10 5-2-5-10h9z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/></svg>')}") 3 2`,
    "--club-go-cursor": `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="white" stroke="black" stroke-width="2"/><path d="M18 8v20M8 18h20M13 13l10 10m0-10L13 23" stroke="black" stroke-width="2"/></svg>')}") 18 18`,
    "--club-grab-cursor": `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="36" viewBox="0 0 32 36"><path d="M10 17V8a2 2 0 0 1 4 0v8-11a2 2 0 0 1 4 0v11-9a2 2 0 0 1 4 0v10-7a2 2 0 0 1 4 0v10c0 7-3 12-10 12h-1c-3 0-5-2-7-5l-4-6a2 2 0 0 1 3-3l3 4" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>')}") 14 16`,
    "--club-grabbing-cursor": `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="36" viewBox="0 0 32 36"><path d="M8 17V9a3 3 0 0 1 6 0v8-11a3 3 0 0 1 6 0v11-9a3 3 0 0 1 6 0v10-7a3 3 0 0 1 6 0v9c0 9-5 14-12 14h-2c-4 0-7-2-9-6l-4-7a3 3 0 0 1 5-3l3 4" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>')}") 16 18`,
  } as CSSProperties;
  const explodeShards = bootStep >= 2 && bootStep < 5;
  const showHome = fontsReady && bootStep >= 4;
  const currentTrackName = musicOn ? currentTrack?.title : "";
  const rootClasses = [
    styles.club,
    bootStep === 0 ? styles.bootZero : "",
    bootStep === 1 ? styles.bootR : "",
    bootStep === 2 ? styles.bootBurst : "",
    bootStep === 3 ? styles.bootFlood : "",
    bootStep === 4 ? styles.bootSlam : "",
    bootStep >= 5 ? styles.bootHome : "",
    reducedMotion ? styles.reducedMotion : "",
    closing ? styles.closing : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClasses}
      data-step={bootStep}
      data-home={showHome}
      style={themeStyle}
      onPointerDown={() => {
        if (bootStep < 5) {
          bootSkipped.current = true;
          setBootStep(5);
        }
      }}
    >
      <div className={styles.grid} aria-hidden />
      <div className={styles.glyphs} aria-hidden>
        <span>R</span>
        <span>Y</span>
        <span>R</span>
      </div>
      <div className={styles.canvasLayer} aria-hidden>
        <ShardField color={targetTheme.bg} explode={explodeShards} />
      </div>
      {bootStep < 3 && (
        <div className={styles.bootMark} aria-hidden>
          <svg viewBox="-150 -105 300 210">
            <ellipse cx="0" cy="0" rx="142" ry="85" />
            <ellipse cx="0" cy="0" rx="128" ry="73" />
            <path d={rPath} transform="scale(66 -78)" fill="#000" fillRule="evenodd" />
            <path d={rPath} transform="scale(66 -78)" fill="none" stroke="#fff" strokeWidth=".022" fillRule="evenodd" />
          </svg>
        </div>
      )}
      <div className={styles.hatch} aria-hidden />
      <div className={styles.hatchSecond} aria-hidden />

      <div className={styles.ui} data-visible={showHome}>
        <div className={styles.topbar} data-slam style={{ "--slam-order": 0 } as CSSProperties}>
          <ClubBadge />
          <div className={styles.audioButtons}>
            <button
              className={styles.audioButton}
              onClick={toggleMusic}
              aria-label={musicOn ? "Stop music" : "Play music"}
              title={musicOn ? "stop music" : "play music"}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M12 3v10.2a3 3 0 1 1-2-2.8V6l7-1.5v6.7a3 3 0 1 1-2-2.8V3.7z" />
              </svg>
            </button>
            <button
              className={styles.audioButton}
              onClick={() => {
                setSfxOn((value) => !value);
                playClubSfx("click");
              }}
              aria-label={sfxOn ? "Mute sound effects" : "Enable sound effects"}
              title={sfxOn ? "sound effects on" : "sound effects off"}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 8h3l4-3v10l-4-3H3z" />
                {sfxOn ? (
                  <path d="M13 7c2 1.5 2 4.5 0 6m2-8c3.5 2.5 3.5 7.5 0 10" />
                ) : (
                  <path d="m13 8 4 4m0-4-4 4" />
                )}
              </svg>
            </button>
            {currentTrackName && (
              <span className={styles.nowPlaying}>now playing: {currentTrackName}</span>
            )}
          </div>
        </div>

        <div className={styles.updatesWrap} data-open={updatesOpen} data-slam style={{ "--slam-order": 1 } as CSSProperties}>
          <UpdatesPanel open={updatesOpen} />
        </div>
        <button
          className={styles.updatesTab}
          onClick={() => setUpdatesOpen((value) => !value)}
          aria-expanded={updatesOpen}
          data-slam
          style={{ "--slam-order": 1 } as CSSProperties}
        >
          updates ◍
        </button>

        <div className={styles.hatchCopy} aria-live="polite" data-slam style={{ "--slam-order": 2 } as CSSProperties}>
          <span>{typing}</span>
        </div>
        <nav className={styles.nav} aria-label="Ry Club sections">
          {NAV_ITEMS.map((item, index) => (
            <button
              className={`${styles.navItem} ${hovered === item.id || windowSection === item.id ? styles.navActive : ""}`}
              key={item.id}
              onPointerEnter={() => onNavEnter(item.id)}
              onPointerLeave={() => {
                if (!windowSection) setHovered(null);
              }}
              onFocus={() => onNavEnter(item.id)}
              onBlur={() => {
                if (!windowSection) setHovered(null);
              }}
              onClick={() => openWindow(item.id)}
              data-slam
              style={{ "--slam-order": 3 + index } as CSSProperties}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.socials} data-slam style={{ "--slam-order": 7 } as CSSProperties}>
          {[
            ...[
              { label: "github", href: "https://github.com/ryanpolasky" },
              { label: "linkedin", href: "https://www.linkedin.com/in/ryan-polasky/" },
              { label: "spotify", href: "/spotify.html" },
              { label: "gallery", href: "/gallery" },
            ],
            { label: "résumé", href: RESUME_PDF_HREF },
          ].map((link) => (
            <a
              href={link.href}
              key={link.label}
              aria-label={link.label}
              onPointerEnter={() => playClubSfx("hover")}
            >
              <SocialIcon label={link.label} />
              <span>{link.label}</span>
            </a>
          ))}
        </div>

        <div className={styles.footerRow}>
          <div className={styles.timer} data-slam style={{ "--slam-order": 8 } as CSSProperties}>
            you&apos;ve been in the club for <span ref={timerRef}>0.00</span> seconds
          </div>
          <div className={styles.version} data-slam style={{ "--slam-order": 9 } as CSSProperties}>
            <button onClick={finishExit}>✕ exit</button>
            <span>ryan@cupertino // ver. 2.0.0</span>
          </div>
        </div>
      </div>

      {musicOn && currentTrackName && (
        <div className={styles.nowPlayingMobile}>now playing: {currentTrackName}</div>
      )}
      {windowSection && !closing && (
        <div className={styles.windowLayer}>
          <ClubWindow
            section={windowSection}
            offset={windowOffset}
            onClose={closeWindow}
            onDragStart={startDrag}
          />
        </div>
      )}
      {bootStep === 2 && <div className={styles.flash} aria-hidden />}
    </div>
  );
}
