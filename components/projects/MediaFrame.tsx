"use client";

// shared media primitive for every layout that displays a screenshot.

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import type { ProjectMediaItem } from "@/lib/projects";
import { LoadingMarch } from "./LoadingMarch";

export interface MediaFrameProps {
  item?: ProjectMediaItem;
  className: string;
  sizes: string;
  onOpen?: (item: ProjectMediaItem) => void;
  // 'contain' = natural aspect + blurred backdrop; 'cover' = crop to fill.
  fit?: "contain" | "cover";
}

// steps a spritesheet via background-position. respects reduced-motion.
interface SpriteAnimationProps {
  src: string;
  alt: string;
  columns: number;
  rows: number;
  fps: number;
}

function SpriteAnimation({
  src,
  alt,
  columns,
  rows,
  fps,
}: SpriteAnimationProps) {
  const totalFrames = Math.max(1, columns * rows);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ms = Math.max(16, Math.round(1000 / Math.max(1, fps)));
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % totalFrames);
    }, ms);
    return () => window.clearInterval(id);
  }, [totalFrames, fps]);
  // bg-position % is relative to (image - container) extra space, so
  // frame K maps to (K / (N-1)) * 100%. clamp N-1 to 1 for single-axis.
  const col = frame % columns;
  const row = Math.floor(frame / columns);
  const xPct = (col / Math.max(1, columns - 1)) * 100;
  const yPct = (row / Math.max(1, rows - 1)) * 100;
  const style: CSSProperties = {
    backgroundImage: `url(${src})`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${xPct}% ${yPct}%`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
  return (
    <div
      role="img"
      aria-label={alt}
      className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.015]"
      style={style}
    />
  );
}

export function MediaFrame({
  item,
  className,
  sizes,
  onOpen,
  fit = "contain",
}: MediaFrameProps) {
  const label = item?.label ?? "preview";
  // item.cover overrides the layout-supplied fit so individual screenshots
  // can opt into cropping. lightbox still serves the uncropped original.
  const effectiveFit = item?.cover ? "cover" : fit;
  // sprite and march bypass the next/image render path entirely.
  const isSprite = !!item?.src && !!item?.sprite;
  const isMarch = !!item?.march;
  // animated content drops the card chrome (border/bg/shadow) so pixel
  // art doesn't look gallery-framed.
  const isAnimated = isSprite || isMarch;
  const chromeClass = isAnimated
    ? ""
    : "rounded-[1.65rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.11),rgba(255,255,255,0.035)),radial-gradient(circle_at_24%_18%,color-mix(in_oklab,var(--project-tint)_34%,transparent),transparent_42%)] shadow-[0_24px_70px_-48px_rgba(0,0,0,0.9)]";
  const wrapperClass =
    `group relative block w-full overflow-hidden ${chromeClass} ${className}`.trim();
  const interactive = !!item?.src && !!onOpen;

  // march short-circuits: self-contained component, hardcoded sprites.
  if (isMarch) {
    return (
      <div className={wrapperClass}>
        <LoadingMarch />
      </div>
    );
  }

  const inner = item?.src ? (
    isSprite && item.sprite ? (
      <SpriteAnimation
        src={item.src}
        alt={item.alt ?? label}
        columns={item.sprite.columns}
        rows={item.sprite.rows}
        fps={item.sprite.fps}
      />
    ) : effectiveFit === "cover" ? (
      <Image
        src={item.src}
        alt={item.alt ?? label}
        fill
        sizes={sizes}
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
      />
    ) : (
      <>
        <Image
          src={item.src}
          alt=""
          fill
          sizes={sizes}
          aria-hidden="true"
          className="scale-110 object-cover opacity-35 blur-xl saturate-125 transition-transform duration-700 ease-out group-hover:scale-[1.14]"
        />
        <div className="absolute inset-2.5 sm:inset-3.5">
          <Image
            src={item.src}
            alt={item.alt ?? label}
            fill
            sizes={sizes}
            className="object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.28)] transition-transform duration-700 ease-out group-hover:scale-[1.015]"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.10),transparent_44%),linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_34%,rgba(0,0,0,0.18))]" />
      </>
    )
  ) : (
    <div className="flex h-full flex-col justify-between p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
        </div>
        <div
          className="text-[9px] uppercase tracking-[0.22em] text-[var(--color-text-invert-faint)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          img slot
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="h-2 w-3/5 rounded-full bg-white/20" />
        <div className="h-2 w-4/5 rounded-full bg-white/12" />
        <div className="h-2 w-2/5 rounded-full bg-white/10" />
      </div>
      <div
        className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-invert-faint)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
    </div>
  );

  if (interactive) {
    // div+role=button instead of <button> to avoid UA-default padding /
    // inline-block sizing that subtly shrinks the box around <Image fill>.
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen!(item!)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen!(item!);
          }
        }}
        className={`${wrapperClass} cursor-zoom-in`}
        aria-label={`open ${label} preview`}
        data-hoverable
      >
        {inner}
      </div>
    );
  }

  return <div className={wrapperClass}>{inner}</div>;
}
