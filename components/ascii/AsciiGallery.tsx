"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ASCII_SCENES } from "@/lib/ascii/scenes";
import type { AsciiScene } from "@/lib/ascii/types";
import styles from "./AsciiGallery.module.css";

const HIDE_CONTROLS_AFTER = 2800;
const FRAME_INTERVAL = 1000 / 15;
const ASCII_RAMP = "....,,,,::::;;;;iiii1111ttttffffLLLLCCCCGGGG00008888@@@@";

function noise(column: number, row: number): number {
  const value = Math.sin(column * 12.9898 + row * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function AsciiCanvas({
  scene,
  paused,
}: {
  scene: AsciiScene;
  paused: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    const sampler = document.createElement("canvas");
    const sampleContext = sampler.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });
    if (!context || !sampleContext) return;

    const image = new Image();
    let animationFrame = 0;
    let lastFrame = 0;
    let sampledPixels: Uint8ClampedArray | null = null;
    let columns = 0;
    let rows = 0;
    let cellWidth = 0;
    let cellHeight = 0;
    let fontSize = 0;
    let fontFamily = "ui-monospace, monospace";
    let renderedWidth = 0;
    let renderedHeight = 0;

    const sampleImage = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      fontSize = Math.max(7, Math.min(12, width / 118));
      fontFamily = window.getComputedStyle(canvas).fontFamily;
      cellWidth = fontSize * 0.59;
      cellHeight = fontSize * 0.94;
      columns = Math.ceil(width / cellWidth);
      rows = Math.ceil(height / cellHeight);
      renderedWidth = width;
      renderedHeight = height;

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      sampler.width = columns;
      sampler.height = rows;

      const imageAspect = image.naturalWidth / image.naturalHeight;
      const viewportAspect = width / height;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.naturalWidth;
      let sourceHeight = image.naturalHeight;

      if (imageAspect > viewportAspect) {
        sourceWidth = image.naturalHeight * viewportAspect;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = image.naturalWidth / viewportAspect;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
      }

      sampleContext.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        columns,
        rows,
      );
      sampledPixels = sampleContext.getImageData(
        0,
        0,
        columns,
        rows,
      ).data;
    };

    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      if (
        image.complete &&
        image.naturalWidth > 0 &&
        (sampledPixels === null ||
          Math.round(rect.width) !== renderedWidth ||
          Math.round(rect.height) !== renderedHeight)
      ) {
        sampleImage();
      }

      if (sampledPixels && (paused || time - lastFrame >= FRAME_INTERVAL)) {
        lastFrame = time;
        const phase = time / 1000;
        context.fillStyle = scene.background;
        context.fillRect(0, 0, renderedWidth, renderedHeight);
        context.font = `500 ${fontSize}px ${fontFamily}`;
        context.textBaseline = "top";

        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const offset = (row * columns + column) * 4;
            let red = sampledPixels[offset];
            let green = sampledPixels[offset + 1];
            let blue = sampledPixels[offset + 2];
            let luminance =
              (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
            const random = noise(column, row);

            if (scene.motion === "water" && row > rows * 0.61) {
              luminance *=
                0.88 +
                Math.sin(column * 0.29 + row * 0.7 + phase * 2.1) * 0.16;
            } else if (
              scene.motion === "fireflies" &&
              random > 0.992 &&
              row < rows * 0.8
            ) {
              const flicker = Math.max(
                0,
                Math.sin(phase * 2.4 + random * 40),
              );
              luminance = Math.max(luminance, 0.65 + flicker * 0.35);
              red = 239;
              green = 224;
              blue = 108;
            } else if (scene.motion === "pulse") {
              luminance *=
                0.88 +
                Math.sin(
                  Math.hypot(
                    column - columns / 2,
                    row - rows / 2,
                  ) *
                    0.18 -
                    phase * 2.2,
                ) *
                  0.18;
            }

            const mappedLuminance = Math.pow(
              Math.max(0.015, luminance),
              0.56,
            );
            let character =
              ASCII_RAMP[
                Math.min(
                  ASCII_RAMP.length - 1,
                  Math.max(
                    0,
                    Math.floor(
                      mappedLuminance * (ASCII_RAMP.length - 1),
                    ),
                  ),
                )
              ];

            if (
              scene.motion === "rain" &&
              (column * 7 + row * 13 + Math.floor(phase * 22)) % 97 === 0
            ) {
              character = row % 3 === 0 ? "│" : "╎";
              red = Math.max(red, 92);
              green = Math.max(green, 185);
              blue = 255;
              luminance = Math.max(luminance, 0.72);
            }

            const colorLift = 1.1 + mappedLuminance * 0.34;
            context.fillStyle = `rgb(${Math.min(
              255,
              (red + 9) * colorLift,
            )} ${Math.min(255, (green + 12) * colorLift)} ${Math.min(
              255,
              (blue + 18) * colorLift,
            )})`;
            context.globalAlpha = Math.min(
              1,
              0.26 + mappedLuminance * 0.82,
            );
            context.fillText(
              character,
              column * cellWidth,
              row * cellHeight,
            );
          }
        }
        context.globalAlpha = 1;
      }

      if (!paused) animationFrame = window.requestAnimationFrame(draw);
    };

    image.addEventListener("load", () => {
      sampleImage();
      draw(performance.now());
    });
    image.src = scene.source;

    const observer = new ResizeObserver(() => {
      sampledPixels = null;
      if (image.complete && image.naturalWidth > 0) draw(performance.now());
    });
    observer.observe(canvas);

    if (!paused) animationFrame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [paused, scene]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      role="img"
      aria-label={scene.description}
    />
  );
}

export function AsciiGallery() {
  const galleryRef = useRef<HTMLElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

  const scene = ASCII_SCENES[sceneIndex];

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(
      () => setChromeVisible(false),
      HIDE_CONTROLS_AFTER,
    );
  }, []);

  const selectScene = useCallback((index: number) => {
    setSceneIndex(index);
  }, []);

  const moveScene = useCallback((direction: number) => {
    setSceneIndex(
      (current) =>
        (current + direction + ASCII_SCENES.length) % ASCII_SCENES.length,
    );
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await galleryRef.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPaused(true);
    }
  }, []);

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
    revealChrome();
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [revealChrome]);

  const paletteStyle = {
    "--ascii-bg": scene.background,
    "--ascii-glow": scene.glow,
  } as CSSProperties;

  return (
    <main
      ref={galleryRef}
      className={styles.gallery}
      style={paletteStyle}
      onPointerMove={revealChrome}
      onPointerDown={revealChrome}
    >
      <div key={scene.id} className={styles.scene}>
        <AsciiCanvas scene={scene} paused={paused} />
      </div>

      <div
        className={`${styles.chrome} ${
          chromeVisible ? "" : styles.chromeHidden
        }`}
      >
        <header className={styles.identity}>
          <p className={styles.eyebrow}>ascii atlas · {scene.category}</p>
          <h1 className={styles.title}>{scene.title}</h1>
          <p className={styles.eyebrow}>{scene.subtitle}</p>
        </header>

        <p className={styles.counter}>
          no. {String(sceneIndex + 1).padStart(2, "0")} /{" "}
          {String(ASCII_SCENES.length).padStart(2, "0")}
        </p>

        <p className={styles.hint}>← → scenes · space pause · f fullscreen</p>

        <nav className={styles.sceneRail} aria-label="Choose a scene">
          {ASCII_SCENES.map((item, index) => (
            <button
              key={item.id}
              className={`${styles.sceneDot} ${
                index === sceneIndex ? styles.sceneDotActive : ""
              }`}
              type="button"
              aria-label={`View ${item.title}, ${item.category}`}
              aria-current={index === sceneIndex ? "true" : undefined}
              onClick={() => selectScene(index)}
            />
          ))}
        </nav>

        <nav className={styles.controls} aria-label="scene controls">
          <button
            className={styles.button}
            type="button"
            aria-label="Previous scene"
            onClick={() => moveScene(-1)}
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
          >
            →
          </button>
        </nav>
      </div>
    </main>
  );
}
