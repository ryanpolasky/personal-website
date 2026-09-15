"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ASCII_SCENES } from "@/lib/ascii/scenes";
import type { AsciiScene, AsciiTone } from "@/lib/ascii/types";
import styles from "./AsciiGallery.module.css";

const HIDE_CONTROLS_AFTER = 2800;

function sceneDimensions(scene: AsciiScene) {
  const lines = scene.frames[0].split("\n");
  return {
    columns: Math.max(...lines.map((line) => line.length)),
    rows: lines.length,
  };
}

function toneRuns(
  scene: AsciiScene,
  line: string,
  row: number,
): Array<{ text: string; tone: AsciiTone }> {
  const runs: Array<{ text: string; tone: AsciiTone }> = [];

  Array.from(line).forEach((character, column) => {
    const tone = scene.toneAt(row, column, character);
    const previous = runs.at(-1);
    if (previous?.tone === tone) previous.text += character;
    else runs.push({ text: character, tone });
  });

  return runs;
}

export function AsciiGallery() {
  const galleryRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [fontSize, setFontSize] = useState(12);
  const [paused, setPaused] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

  const scene = ASCII_SCENES[sceneIndex];
  const dimensions = useMemo(() => sceneDimensions(scene), [scene]);
  const lines = scene.frames[frameIndex % scene.frames.length].split("\n");

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(
      () => setChromeVisible(false),
      HIDE_CONTROLS_AFTER,
    );
  }, []);

  const moveScene = useCallback((direction: number) => {
    setSceneIndex((current) => {
      const next = (current + direction + ASCII_SCENES.length) % ASCII_SCENES.length;
      return next;
    });
    setFrameIndex(0);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await galleryRef.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    if (paused || scene.frames.length < 2) return;
    const interval = window.setInterval(
      () => setFrameIndex((current) => current + 1),
      scene.frameDuration,
    );
    return () => window.clearInterval(interval);
  }, [paused, scene]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") moveScene(-1);
      else if (event.key === "ArrowRight") moveScene(1);
      else if (event.key.toLowerCase() === "f") void toggleFullscreen();
      else if (event.key === " ") {
        event.preventDefault();
        setPaused((current) => !current);
      } else return;
      revealChrome();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveScene, revealChrome, toggleFullscreen]);

  useEffect(() => {
    const fit = () => {
      const container = sceneRef.current;
      const measure = measureRef.current;
      if (!container || !measure) return;
      const box = container.getBoundingClientRect();
      const measuredCharacter = measure.getBoundingClientRect().width / 10 / 100;
      const next = Math.min(
        box.width / dimensions.columns / measuredCharacter,
        box.height / dimensions.rows,
      );
      setFontSize(Math.max(4, next * 0.965));
    };

    const observer = new ResizeObserver(fit);
    if (sceneRef.current) observer.observe(sceneRef.current);
    void document.fonts.ready.then(fit);
    fit();
    return () => observer.disconnect();
  }, [dimensions]);

  useEffect(() => {
    revealChrome();
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [revealChrome]);

  const paletteStyle = {
    "--ascii-bg": scene.palette.background,
    "--ascii-glow": scene.palette.glow,
    "--ascii-size": `${fontSize}px`,
  } as CSSProperties;

  return (
    <main
      ref={galleryRef}
      className={styles.gallery}
      style={paletteStyle}
      onPointerMove={revealChrome}
      onPointerDown={revealChrome}
    >
      <div ref={sceneRef} className={styles.scene}>
        <pre className={styles.art} aria-hidden="true">
          {lines.map((line, row) => (
            <span className={styles.line} key={`${scene.id}-${row}`}>
              {toneRuns(scene, line, row).map((run, index) => (
                <span
                  key={`${row}-${index}`}
                  className={`${styles.tone} ${
                    run.tone === "fire"
                      ? styles.toneFire
                      : run.tone === "ember"
                        ? styles.toneEmber
                      : run.tone === "snow"
                        ? styles.toneSnow
                        : ""
                  }`}
                  style={
                    {
                      "--tone": scene.palette.tones[run.tone],
                      animationDelay: `${((row * 17 + index * 31) % 1100) * -1}ms`,
                    } as CSSProperties
                  }
                >
                  {run.text}
                </span>
              ))}
            </span>
          ))}
        </pre>
        <span ref={measureRef} className={styles.measure}>
          MMMMMMMMMM
        </span>
      </div>

      <p className="sr-only">{scene.description}</p>

      <div
        className={`${styles.chrome} ${
          chromeVisible ? "" : styles.chromeHidden
        }`}
      >
        <header className={styles.identity}>
          <p className={styles.eyebrow}>ascii rooms · no. {sceneIndex + 1}</p>
          <h1 className={styles.title}>{scene.title}</h1>
          <p className={styles.eyebrow}>{scene.subtitle}</p>
        </header>

        <p className={styles.counter}>
          {String(sceneIndex + 1).padStart(2, "0")} /{" "}
          {String(ASCII_SCENES.length).padStart(2, "0")}
        </p>

        <p className={styles.hint}>← → scenes · space pause · f fullscreen</p>

        <nav className={styles.controls} aria-label="scene controls">
          <button
            className={styles.button}
            type="button"
            aria-label="Previous scene"
            onClick={() => moveScene(-1)}
            disabled={ASCII_SCENES.length < 2}
          >
            ←
          </button>
          <button
            className={styles.button}
            type="button"
            aria-label={paused ? "Play animation" : "Pause animation"}
            onClick={() => setPaused((current) => !current)}
          >
            {paused ? "▶" : "Ⅱ"}
          </button>
          <button
            className={styles.button}
            type="button"
            aria-label="Enter fullscreen"
            onClick={() => void toggleFullscreen()}
          >
            ⛶
          </button>
          <button
            className={styles.button}
            type="button"
            aria-label="Next scene"
            onClick={() => moveScene(1)}
            disabled={ASCII_SCENES.length < 2}
          >
            →
          </button>
        </nav>
      </div>
    </main>
  );
}
