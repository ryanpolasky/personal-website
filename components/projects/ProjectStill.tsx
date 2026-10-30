import Image, { type ImageProps } from "next/image";
import mediaDimensions from "@/lib/mediaDimensions.json";

const dimensions: Record<string, { w: number; h: number } | undefined> = mediaDimensions;

export function ProjectStill({ src, sizes, alt, viewportCover, ...props }: ImageProps & { src: string; viewportCover?: boolean }) {
  const width = dimensions[src]?.w;
  const height = dimensions[src]?.h;
  const displaySizes = viewportCover && width && height
    ? `(max-aspect-ratio: ${width}/${height}) ${width / height * 100}svh, 100vw`
    : sizes;
  const candidates = width
    ? [640, 1280, 1920].filter((size) => size < width).map((size) => `${src.replace(/\.(png|webp|jpe?g)$/i, `.${size}w.webp`)} ${size}w`).concat(`${src} ${width}w`).join(", ")
    : undefined;
  return (
    <picture style={props.fill ? { position: "absolute", inset: 0 } : undefined}>
      {candidates ? <source type="image/webp" srcSet={candidates} sizes={displaySizes} /> : null}
      <Image {...props} src={src} sizes={displaySizes} alt={alt} />
    </picture>
  );
}
