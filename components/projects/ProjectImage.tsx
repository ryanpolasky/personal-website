"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ProjectMediaItem } from "@/lib/projects";

type ProjectImageProps = Omit<ImageProps, "src" | "alt"> & {
  item: ProjectMediaItem;
};

// animated media is mp4, not animated webp: a few hundred multi-MP frames
// decoded on the CPU janked the whole rail. video decodes on the GPU.
function AnimatedProjectMedia({ item, ...props }: ProjectImageProps) {
  const { fill, className, onClick, width, height, style } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduced || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { rootMargin: "200px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduced]);

  if (reduced) {
    return (
      <Image
        {...props}
        src={item.src!}
        alt={item.alt ?? item.label}
        unoptimized
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className={`${fill ? "absolute inset-0 h-full w-full " : ""}${className ?? ""}`}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={style}
      onClick={
        onClick as unknown as React.MouseEventHandler<HTMLVideoElement>
      }
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="metadata"
      poster={item.src}
      role="img"
      aria-label={item.alt ?? item.label}
    >
      {item.animatedMobileSrc ? (
        <source
          src={item.animatedMobileSrc}
          media="(max-width: 767px)"
          type="video/mp4"
        />
      ) : null}
      <source src={item.animatedSrc} type="video/mp4" />
    </video>
  );
}

export function ProjectImage({ item, ...props }: ProjectImageProps) {
  if (!item.src) return null;

  if (item.animatedSrc) {
    return <AnimatedProjectMedia item={item} {...props} />;
  }

  return (
    <Image
      {...props}
      src={item.src}
      alt={item.alt ?? item.label}
      unoptimized={props.unoptimized}
    />
  );
}
