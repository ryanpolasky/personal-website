import Image, { type ImageProps } from "next/image";
import mediaDimensions from "@/lib/mediaDimensions.json";

const dimensions: Record<string, { w: number; h: number } | undefined> = mediaDimensions;

export function ProjectStill({ src, sizes, alt, ...props }: ImageProps & { src: string }) {
  const width = dimensions[src]?.w;
  const candidates = width
    ? [640, 1280, 1920].filter((size) => size < width).map((size) => `${src.replace(/\.(png|webp|jpe?g)$/i, `.${size}w.webp`)} ${size}w`).concat(`${src} ${width}w`).join(", ")
    : undefined;
  return (
    <picture style={props.fill ? { position: "absolute", inset: 0 } : undefined}>
      {candidates ? <source type="image/webp" srcSet={candidates} sizes={sizes} /> : null}
      <Image {...props} src={src} sizes={sizes} alt={alt} />
    </picture>
  );
}
