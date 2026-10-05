import Image, { type ImageProps } from "next/image";
import type { ProjectMediaItem } from "@/lib/projects";

type ProjectImageProps = Omit<ImageProps, "src" | "alt"> & {
  item: ProjectMediaItem;
};

export function ProjectImage({ item, ...props }: ProjectImageProps) {
  if (!item.src) return null;

  const image = (
    <Image
      {...props}
      src={item.src}
      alt={item.alt ?? item.label}
      unoptimized={item.animatedSrc ? true : props.unoptimized}
    />
  );

  return item.animatedSrc ? (
    <picture className="contents">
      {item.animatedMobileSrc ? (
        <source
          media="(prefers-reduced-motion: no-preference) and (max-width: 767px)"
          srcSet={item.animatedMobileSrc}
          type="image/webp"
        />
      ) : null}
      <source
        media="(prefers-reduced-motion: no-preference)"
        srcSet={item.animatedSrc}
        type="image/webp"
      />
      {image}
    </picture>
  ) : image;
}
