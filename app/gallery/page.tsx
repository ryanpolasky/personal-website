import type { Metadata } from "next";
import { Suspense } from "react";
import { Gallery } from "@/components/Gallery";

export const metadata: Metadata = {
  title: "Ryan Polasky · Gallery",
  description:
    "Ten visual interpretations of the same portfolio. Pick the one that resonates.",
};

export default function GalleryPage() {
  return (
    <Suspense fallback={null}>
      <Gallery />
    </Suspense>
  );
}
